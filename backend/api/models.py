"""
Database models for the Splitwise clone.

Each class below maps to one PostgreSQL table. Django's ORM generates the SQL.
The design follows AI_CONTEXT.md:
  - Users belong to Groups (via GroupMember join table)
  - Expenses are split among members (ExpenseSplit rows)
  - Balance is a CACHED pairwise net-debt table, recomputed by the debt engine
  - Settlements record payments that reduce debts
"""

from django.contrib.auth.models import AbstractUser
from django.db import models
from django.conf import settings


class User(AbstractUser):
    """
    Custom user. Extends Django's built-in user (which already provides
    `username`, `password`, `is_active`, etc.) and adds:
      - email made unique (used as a real identifier)
      - `name`: the person's display/full name
    Username is still unique (inherited) and is what we SEARCH BY when adding
    members to a group (per Q20).
    """
    email = models.EmailField(unique=True)
    name = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.username} ({self.email})"


class Group(models.Model):
    """A shared-expense group, e.g. 'Goa Trip' or 'Flat 304'."""
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="groups_created",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.name


class GroupMember(models.Model):
    """
    Join table linking Users <-> Groups (many-to-many with extra data).
    A user can be in many groups; a group has many members.
    """
    group = models.ForeignKey(
        Group, on_delete=models.CASCADE, related_name="members"
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="group_memberships",
    )
    joined_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        # A user can only be in a group once.
        unique_together = ("group", "user")

    def __str__(self):
        return f"{self.user.username} in {self.group.name}"


class Expense(models.Model):
    """
    A single expense paid by ONE person (payer) and split among participants.
    The split breakdown lives in related ExpenseSplit rows.
    """
    SPLIT_EQUAL = "equal"
    SPLIT_UNEQUAL = "unequal"
    SPLIT_PERCENTAGE = "percentage"
    SPLIT_TYPE_CHOICES = [
        (SPLIT_EQUAL, "Equal"),
        (SPLIT_UNEQUAL, "Unequal"),
        (SPLIT_PERCENTAGE, "Percentage"),
    ]

    group = models.ForeignKey(
        Group, on_delete=models.CASCADE, related_name="expenses"
    )
    payer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="expenses_paid",
    )
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    description = models.CharField(max_length=255)
    category = models.CharField(max_length=50, blank=True)  # simple string, e.g. "Food"
    split_type = models.CharField(max_length=20, choices=SPLIT_TYPE_CHOICES)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]  # newest first

    def __str__(self):
        return f"{self.description} - {self.amount} ({self.group.name})"


class ExpenseSplit(models.Model):
    """
    How much ONE participant owes for ONE expense.
    Includes the payer's own share (the payer absorbs any rounding remainder),
    but the payer's own split is excluded from debt calculation since they paid.
    """
    expense = models.ForeignKey(
        Expense, on_delete=models.CASCADE, related_name="splits"
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="expense_splits",
    )
    amount_owed = models.DecimalField(max_digits=12, decimal_places=2)

    class Meta:
        unique_together = ("expense", "user")

    def __str__(self):
        return f"{self.user.username} owes {self.amount_owed} for '{self.expense.description}'"


class Settlement(models.Model):
    """
    A recorded payment from one user to another within a group.
    Recording a settlement reduces what `from_user` owes `to_user`.
    Single-party: no accept/reject workflow (per Q10).
    """
    group = models.ForeignKey(
        Group, on_delete=models.CASCADE, related_name="settlements"
    )
    from_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="settlements_made",
    )
    to_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="settlements_received",
    )
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.from_user.username} paid {self.to_user.username} {self.amount}"


class ExpenseComment(models.Model):
    """
    A comment on an expense (the simplified 'chat' / discussion thread, per Q5).
    Fetched on page load; no WebSockets.
    """
    expense = models.ForeignKey(
        Expense, on_delete=models.CASCADE, related_name="comments"
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="expense_comments",
    )
    comment_text = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at"]  # oldest first, like a chat

    def __str__(self):
        return f"{self.user.username}: {self.comment_text[:30]}"


class Balance(models.Model):
    """
    CACHED pairwise net balance between two users within a group.

    Canonical form to avoid duplicate (A,B)/(B,A) rows:
      user_low  = the user with the smaller id
      user_high = the user with the larger id
      net_amount > 0  => user_low owes user_high
      net_amount < 0  => user_high owes user_low (by abs(net_amount))
      net_amount == 0 => settled

    Recomputed entirely by the debt engine whenever expenses/settlements change.
    """
    group = models.ForeignKey(
        Group, on_delete=models.CASCADE, related_name="balances"
    )
    user_low = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="balances_as_low",
    )
    user_high = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="balances_as_high",
    )
    net_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    last_updated = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ("group", "user_low", "user_high")

    def __str__(self):
        return f"[{self.group.name}] low={self.user_low_id} high={self.user_high_id} net={self.net_amount}"


class Wallet(models.Model):
    """One wallet per user. Balance in rupees, never goes negative."""
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="wallet",
    )
    balance = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.user.username}'s wallet: ₹{self.balance}"


class WalletTransaction(models.Model):
    DEPOSIT = "deposit"
    TRANSFER = "transfer"
    TYPE_CHOICES = [(DEPOSIT, "Deposit"), (TRANSFER, "Transfer")]

    wallet = models.ForeignKey(
        Wallet, on_delete=models.CASCADE, related_name="transactions"
    )
    transaction_type = models.CharField(max_length=20, choices=TYPE_CHOICES)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    counterpart = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="received_transfers",
    )
    note = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.wallet.user.username} {self.transaction_type} ₹{self.amount}"


class Notification(models.Model):
    """In-app notification (no emails, per scope). e.g. 'Alice added a ₹500 expense'."""
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="notifications",
    )
    message = models.TextField()
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"To {self.user.username}: {self.message[:30]}"
