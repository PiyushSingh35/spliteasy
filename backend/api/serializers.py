"""
Serializers: convert model instances <-> JSON and validate incoming payloads.
"""

from decimal import Decimal

from django.contrib.auth import get_user_model
from rest_framework import serializers

from .models import (
    Group, GroupMember, Expense, ExpenseSplit,
    Settlement, ExpenseComment, Notification,
)

User = get_user_model()


# ---------------------------------------------------------------------------
# Users / Auth
# ---------------------------------------------------------------------------
class UserSerializer(serializers.ModelSerializer):
    """Public-safe view of a user (never exposes password)."""
    class Meta:
        model = User
        fields = ["id", "username", "email", "name"]


class RegisterSerializer(serializers.ModelSerializer):
    """Signup payload. Password is write-only and properly hashed."""
    password = serializers.CharField(write_only=True, min_length=6)

    class Meta:
        model = User
        fields = ["id", "username", "email", "name", "password"]

    def create(self, validated_data):
        password = validated_data.pop("password")
        user = User(**validated_data)
        user.set_password(password)  # hashes the password
        user.save()
        return user


# ---------------------------------------------------------------------------
# Groups
# ---------------------------------------------------------------------------
class GroupMemberSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)

    class Meta:
        model = GroupMember
        fields = ["id", "user", "joined_at"]


class GroupSerializer(serializers.ModelSerializer):
    created_by = UserSerializer(read_only=True)
    members = GroupMemberSerializer(many=True, read_only=True)
    member_count = serializers.SerializerMethodField()

    class Meta:
        model = Group
        fields = ["id", "name", "description", "created_by",
                  "members", "member_count", "created_at"]
        read_only_fields = ["created_by", "created_at"]

    def get_member_count(self, obj):
        return obj.members.count()


# ---------------------------------------------------------------------------
# Expenses
# ---------------------------------------------------------------------------
class ExpenseSplitSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)

    class Meta:
        model = ExpenseSplit
        fields = ["id", "user", "amount_owed"]


class ExpenseCommentSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)

    class Meta:
        model = ExpenseComment
        fields = ["id", "user", "comment_text", "created_at"]
        read_only_fields = ["user", "created_at"]


class ExpenseSerializer(serializers.ModelSerializer):
    """Read view of an expense, including its computed splits and comments."""
    payer = UserSerializer(read_only=True)
    splits = ExpenseSplitSerializer(many=True, read_only=True)
    comments = ExpenseCommentSerializer(many=True, read_only=True)

    class Meta:
        model = Expense
        fields = ["id", "group", "payer", "amount", "description", "category",
                  "split_type", "splits", "comments", "created_at"]


class SplitInputSerializer(serializers.Serializer):
    """One participant line in an expense-create payload."""
    user = serializers.IntegerField()
    amount = serializers.DecimalField(max_digits=12, decimal_places=2, required=False)
    percentage = serializers.DecimalField(max_digits=6, decimal_places=2, required=False)


class ExpenseCreateSerializer(serializers.Serializer):
    """
    Write payload for creating an expense. The view turns `splits` into
    ExpenseSplit rows using the debt engine.
    """
    payer = serializers.IntegerField()
    amount = serializers.DecimalField(max_digits=12, decimal_places=2)
    description = serializers.CharField(max_length=255)
    category = serializers.CharField(max_length=50, required=False, allow_blank=True)
    split_type = serializers.ChoiceField(choices=["equal", "unequal", "percentage"])
    splits = SplitInputSerializer(many=True)

    def validate_amount(self, value):
        if value <= Decimal("0"):
            raise serializers.ValidationError("Amount must be positive.")
        return value

    def validate(self, attrs):
        split_type = attrs["split_type"]
        for s in attrs["splits"]:
            if split_type == "unequal" and s.get("amount") is None:
                raise serializers.ValidationError(
                    "Each participant needs an 'amount' for an unequal split."
                )
            if split_type == "percentage" and s.get("percentage") is None:
                raise serializers.ValidationError(
                    "Each participant needs a 'percentage' for a percentage split."
                )
        return attrs


# ---------------------------------------------------------------------------
# Settlements
# ---------------------------------------------------------------------------
class SettlementSerializer(serializers.ModelSerializer):
    from_user = UserSerializer(read_only=True)
    to_user = UserSerializer(read_only=True)

    class Meta:
        model = Settlement
        fields = ["id", "group", "from_user", "to_user", "amount", "created_at"]
        read_only_fields = ["created_at"]


class SettlementCreateSerializer(serializers.Serializer):
    from_user = serializers.IntegerField()
    to_user = serializers.IntegerField()
    amount = serializers.DecimalField(max_digits=12, decimal_places=2)

    def validate_amount(self, value):
        if value <= Decimal("0"):
            raise serializers.ValidationError("Amount must be positive.")
        return value


# ---------------------------------------------------------------------------
# Notifications
# ---------------------------------------------------------------------------
class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = ["id", "message", "is_read", "created_at"]


# ---------------------------------------------------------------------------
# Balances (directional, computed)
# ---------------------------------------------------------------------------
class DirectionalBalanceSerializer(serializers.Serializer):
    from_user = UserSerializer()
    to_user = UserSerializer()
    amount = serializers.DecimalField(max_digits=12, decimal_places=2)
