"""
The debt-calculation engine — the core of the app.

Two responsibilities:
  1. compute_splits(): given an amount + split type, produce the exact
     per-user amounts owed, with money-safe rounding (works in integer paise).
  2. recompute_group_balances(): rebuild the cached pairwise Balance rows for a
     group from scratch (all expenses + all settlements). Correctness-first.

Working in integer paise (1 rupee = 100 paise) avoids floating-point/decimal
rounding drift, so splits ALWAYS sum back to the original total.
"""

from collections import defaultdict
from decimal import Decimal, ROUND_HALF_UP, ROUND_DOWN

from django.core.exceptions import ValidationError

from .models import ExpenseSplit, Settlement, Balance, GroupMember

TWO_PLACES = Decimal("0.01")


# ---------------------------------------------------------------------------
# Money helpers
# ---------------------------------------------------------------------------
def to_paise(amount) -> int:
    """Convert a rupee Decimal/str to integer paise, rounding half-up."""
    return int((Decimal(str(amount)) * 100).to_integral_value(rounding=ROUND_HALF_UP))


def from_paise(paise: int) -> Decimal:
    """Convert integer paise back to a 2-decimal rupee Decimal."""
    return (Decimal(paise) / 100).quantize(TWO_PLACES)


# ---------------------------------------------------------------------------
# Split computation
# Each function returns {user_id: Decimal(amount_owed)} that sums to `amount`.
# `payer_id` receives any leftover paise first (per Q6).
# ---------------------------------------------------------------------------
def _order_payer_first(user_ids, payer_id):
    """Return user_ids with the payer first (so they absorb rounding remainder)."""
    if payer_id in user_ids:
        return [payer_id] + [u for u in user_ids if u != payer_id]
    return list(user_ids)


def compute_equal_splits(amount, participant_ids, payer_id):
    """Split `amount` evenly; leftover paise go to the payer first."""
    if not participant_ids:
        raise ValidationError("Equal split needs at least one participant.")
    total = to_paise(amount)
    n = len(participant_ids)
    base, remainder = divmod(total, n)
    ordered = _order_payer_first(participant_ids, payer_id)
    result = {}
    for i, uid in enumerate(ordered):
        result[uid] = from_paise(base + (1 if i < remainder else 0))
    return result


def compute_unequal_splits(amount, amount_map):
    """
    amount_map: {user_id: rupee amount}. Must sum exactly to `amount`.
    """
    if not amount_map:
        raise ValidationError("Unequal split needs at least one participant.")
    total = to_paise(amount)
    given = sum(to_paise(v) for v in amount_map.values())
    if given != total:
        raise ValidationError(
            f"Unequal split amounts ({from_paise(given)}) must sum to the total ({from_paise(total)})."
        )
    return {uid: from_paise(to_paise(v)) for uid, v in amount_map.items()}


def compute_percentage_splits(amount, pct_map, payer_id):
    """
    pct_map: {user_id: percentage}. Percentages must sum to 100.
    Amounts are floored then leftover paise distributed payer-first, so the
    total is exact even when percentages don't divide evenly.
    """
    if not pct_map:
        raise ValidationError("Percentage split needs at least one participant.")
    pct_sum = sum(Decimal(str(p)) for p in pct_map.values())
    if pct_sum != Decimal("100"):
        raise ValidationError(f"Percentages must sum to 100 (got {pct_sum}).")

    total = to_paise(amount)
    result_paise = {}
    allocated = 0
    for uid, pct in pct_map.items():
        share = int((Decimal(str(pct)) / 100 * total).to_integral_value(rounding=ROUND_DOWN))
        result_paise[uid] = share
        allocated += share

    remainder = total - allocated
    ordered = _order_payer_first(list(pct_map.keys()), payer_id)
    i = 0
    while remainder > 0:
        result_paise[ordered[i % len(ordered)]] += 1
        remainder -= 1
        i += 1

    return {uid: from_paise(p) for uid, p in result_paise.items()}


def build_splits(amount, split_type, splits_input, payer_id):
    """
    Normalize API input into {user_id: Decimal(amount_owed)}.

    splits_input is a list of dicts:
      equal:      [{"user": id}, ...]
      unequal:    [{"user": id, "amount": "50.00"}, ...]
      percentage: [{"user": id, "percentage": "50"}, ...]
    """
    if not splits_input:
        raise ValidationError("At least one participant is required.")

    if split_type == "equal":
        ids = [s["user"] for s in splits_input]
        return compute_equal_splits(amount, ids, payer_id)

    if split_type == "unequal":
        amap = {s["user"]: s["amount"] for s in splits_input}
        return compute_unequal_splits(amount, amap)

    if split_type == "percentage":
        pmap = {s["user"]: s["percentage"] for s in splits_input}
        return compute_percentage_splits(amount, pmap, payer_id)

    raise ValidationError(f"Unknown split_type: {split_type}")


# ---------------------------------------------------------------------------
# Pairwise balance recomputation (cached Balance table)
# ---------------------------------------------------------------------------
def _add_debt(net, debtor_id, creditor_id, amount):
    """
    Record that `debtor` owes `creditor` `amount` (may be negative), folding it
    into the canonical (low, high) pair where net>0 means low owes high.
    """
    if debtor_id == creditor_id:
        return
    low, high = sorted([debtor_id, creditor_id])
    if debtor_id == low:
        net[(low, high)] += Decimal(str(amount))
    else:
        net[(low, high)] -= Decimal(str(amount))


def recompute_group_balances(group):
    """
    Rebuild ALL Balance rows for `group` from scratch.
    Called after any expense or settlement change. O(expenses + settlements).
    """
    net = defaultdict(lambda: Decimal("0"))

    # Expenses: each non-payer split means that user owes the payer.
    splits = (
        ExpenseSplit.objects
        .filter(expense__group=group)
        .select_related("expense")
    )
    for s in splits:
        payer_id = s.expense.payer_id
        if s.user_id == payer_id:
            continue  # the payer's own share is not a debt
        _add_debt(net, s.user_id, payer_id, s.amount_owed)

    # Settlements: from_user paying to_user reduces what from_user owes to_user.
    for st in Settlement.objects.filter(group=group):
        _add_debt(net, st.from_user_id, st.to_user_id, -st.amount)

    # Replace cached rows (simple + guaranteed consistent).
    Balance.objects.filter(group=group).delete()
    rows = [
        Balance(group=group, user_low_id=low, user_high_id=high,
                net_amount=amount.quantize(TWO_PLACES))
        for (low, high), amount in net.items()
        if amount != 0
    ]
    Balance.objects.bulk_create(rows)
    return rows


def directional_balances(group):
    """
    Return balances as a friendly directional list for the API:
      [{"from_user_id": X, "to_user_id": Y, "amount": Decimal}, ...]
    meaning X owes Y `amount` (always positive).
    """
    out = []
    for b in Balance.objects.filter(group=group).exclude(net_amount=0):
        if b.net_amount > 0:
            out.append({"from_user_id": b.user_low_id,
                        "to_user_id": b.user_high_id,
                        "amount": b.net_amount})
        else:
            out.append({"from_user_id": b.user_high_id,
                        "to_user_id": b.user_low_id,
                        "amount": -b.net_amount})
    return out
