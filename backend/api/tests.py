"""
Tests for the debt engine — the critical, make-or-break logic.

Run: python manage.py test api
"""

from decimal import Decimal

from django.test import TestCase
from django.contrib.auth import get_user_model

from .models import Group, GroupMember, Expense, ExpenseSplit, Settlement, Balance
from .services import (
    compute_equal_splits, compute_unequal_splits, compute_percentage_splits,
    recompute_group_balances, directional_balances,
)

User = get_user_model()
D = Decimal


class SplitMathTests(TestCase):
    """Pure split-calculation tests (no DB needed for the math itself)."""

    def test_equal_split_100_by_3_rounding(self):
        # Q6: ₹100 / 3 -> payer 33.34, others 33.33; total exactly 100.
        result = compute_equal_splits(D("100.00"), [1, 2, 3], payer_id=1)
        self.assertEqual(result[1], D("33.34"))  # payer absorbs the extra paisa
        self.assertEqual(result[2], D("33.33"))
        self.assertEqual(result[3], D("33.33"))
        self.assertEqual(sum(result.values()), D("100.00"))

    def test_equal_split_100_by_7_totals_exactly(self):
        result = compute_equal_splits(D("100.00"), [1, 2, 3, 4, 5, 6, 7], payer_id=1)
        self.assertEqual(sum(result.values()), D("100.00"))
        # 10000 paise / 7 = 1428 base, 4 remainder -> four get 14.29, three get 14.28
        self.assertEqual(sorted(result.values()),
                         sorted([D("14.29")] * 4 + [D("14.28")] * 3))

    def test_unequal_split_valid(self):
        result = compute_unequal_splits(
            D("300.00"), {1: D("100.00"), 2: D("150.00"), 3: D("50.00")}
        )
        self.assertEqual(sum(result.values()), D("300.00"))

    def test_unequal_split_invalid_sum_raises(self):
        from django.core.exceptions import ValidationError
        with self.assertRaises(ValidationError):
            compute_unequal_splits(D("300.00"), {1: D("100.00"), 2: D("100.00")})

    def test_percentage_split(self):
        result = compute_percentage_splits(
            D("1000.00"), {1: D("50"), 2: D("30"), 3: D("20")}, payer_id=1
        )
        self.assertEqual(result[1], D("500.00"))
        self.assertEqual(result[2], D("300.00"))
        self.assertEqual(result[3], D("200.00"))
        self.assertEqual(sum(result.values()), D("1000.00"))

    def test_percentage_split_uneven_totals_exactly(self):
        # 33.33% x 3 would lose a paisa without remainder handling.
        result = compute_percentage_splits(
            D("100.00"),
            {1: D("33.34"), 2: D("33.33"), 3: D("33.33")},
            payer_id=1,
        )
        self.assertEqual(sum(result.values()), D("100.00"))

    def test_percentage_must_sum_to_100(self):
        from django.core.exceptions import ValidationError
        with self.assertRaises(ValidationError):
            compute_percentage_splits(D("100.00"), {1: D("50"), 2: D("40")}, payer_id=1)


class BalanceEngineTests(TestCase):
    """End-to-end balance tests against the database."""

    def setUp(self):
        self.alice = User.objects.create_user(username="alice", email="a@x.com", password="pw")
        self.bob = User.objects.create_user(username="bob", email="b@x.com", password="pw")
        self.charlie = User.objects.create_user(username="charlie", email="c@x.com", password="pw")
        self.group = Group.objects.create(name="Trip", created_by=self.alice)
        for u in (self.alice, self.bob, self.charlie):
            GroupMember.objects.create(group=self.group, user=u)

    def _add_expense(self, payer, amount, splits):
        exp = Expense.objects.create(
            group=self.group, payer=payer, amount=amount,
            description="x", split_type="equal",
        )
        for uid, amt in splits.items():
            ExpenseSplit.objects.create(expense=exp, user_id=uid, amount_owed=amt)
        recompute_group_balances(self.group)
        return exp

    def test_simple_equal_expense_balances(self):
        # Alice pays 300, split equally 100 each. Bob & Charlie each owe Alice 100.
        self._add_expense(self.alice, D("300.00"),
                          {self.alice.id: D("100.00"),
                           self.bob.id: D("100.00"),
                           self.charlie.id: D("100.00")})
        bals = {(b["from_user_id"], b["to_user_id"]): b["amount"]
                for b in directional_balances(self.group)}
        self.assertEqual(bals[(self.bob.id, self.alice.id)], D("100.00"))
        self.assertEqual(bals[(self.charlie.id, self.alice.id)], D("100.00"))

    def test_bidirectional_debt_collapses_to_net(self):
        # Alice owes Bob 50, Bob owes Alice 20 -> net Alice owes Bob 30 (Q's example).
        # Bob pays 100, Alice's share 50 -> Alice owes Bob 50.
        e1 = Expense.objects.create(group=self.group, payer=self.bob, amount=D("100.00"),
                                    description="dinner", split_type="unequal")
        ExpenseSplit.objects.create(expense=e1, user=self.bob, amount_owed=D("50.00"))
        ExpenseSplit.objects.create(expense=e1, user=self.alice, amount_owed=D("50.00"))
        # Alice pays 40, Bob's share 20 -> Bob owes Alice 20.
        e2 = Expense.objects.create(group=self.group, payer=self.alice, amount=D("40.00"),
                                    description="snacks", split_type="unequal")
        ExpenseSplit.objects.create(expense=e2, user=self.alice, amount_owed=D("20.00"))
        ExpenseSplit.objects.create(expense=e2, user=self.bob, amount_owed=D("20.00"))
        recompute_group_balances(self.group)

        bals = {(b["from_user_id"], b["to_user_id"]): b["amount"]
                for b in directional_balances(self.group)}
        # Net: Alice owes Bob 50 - 20 = 30
        self.assertEqual(bals.get((self.alice.id, self.bob.id)), D("30.00"))
        # And no reverse entry
        self.assertNotIn((self.bob.id, self.alice.id), bals)

    def test_settlement_reduces_balance(self):
        # Bob owes Alice 100, then pays 100 -> settled (no balance row).
        self._add_expense(self.alice, D("200.00"),
                          {self.alice.id: D("100.00"), self.bob.id: D("100.00")})
        Settlement.objects.create(group=self.group, from_user=self.bob,
                                  to_user=self.alice, amount=D("100.00"))
        recompute_group_balances(self.group)
        self.assertEqual(len(directional_balances(self.group)), 0)

    def test_partial_settlement(self):
        # Bob owes Alice 100, pays 60 -> Bob still owes 40.
        self._add_expense(self.alice, D("200.00"),
                          {self.alice.id: D("100.00"), self.bob.id: D("100.00")})
        Settlement.objects.create(group=self.group, from_user=self.bob,
                                  to_user=self.alice, amount=D("60.00"))
        recompute_group_balances(self.group)
        bals = {(b["from_user_id"], b["to_user_id"]): b["amount"]
                for b in directional_balances(self.group)}
        self.assertEqual(bals[(self.bob.id, self.alice.id)], D("40.00"))
