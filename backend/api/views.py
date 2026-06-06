"""
API views — one function per endpoint for readability.

All endpoints require JWT auth (global default) except those marked AllowAny.
Group endpoints enforce membership via _require_member().
"""

from django.shortcuts import get_object_or_404
from django.db import transaction
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError as DjangoValidationError

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework import status
from rest_framework.exceptions import PermissionDenied

from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from .models import (
    Group, GroupMember, Expense, ExpenseSplit,
    Settlement, ExpenseComment, Notification,
)
from .serializers import (
    UserSerializer, RegisterSerializer, GroupSerializer, GroupMemberSerializer,
    ExpenseSerializer, ExpenseCreateSerializer, ExpenseCommentSerializer,
    SettlementSerializer, SettlementCreateSerializer, NotificationSerializer,
)
from .services import build_splits, recompute_group_balances, directional_balances

User = get_user_model()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _require_member(user, group_id):
    """Return the group only if `user` is a member, else 404/403."""
    group = get_object_or_404(Group, id=group_id)
    if not group.members.filter(user=user).exists():
        raise PermissionDenied("You are not a member of this group.")
    return group


def _notify_group(group, message, exclude_user_id=None):
    """Create an in-app notification for every group member except the actor."""
    members = group.members.all()
    if exclude_user_id is not None:
        members = members.exclude(user_id=exclude_user_id)
    Notification.objects.bulk_create(
        [Notification(user_id=m.user_id, message=message) for m in members]
    )


# ---------------------------------------------------------------------------
# Health check (public)
# ---------------------------------------------------------------------------
@api_view(["GET"])
@permission_classes([AllowAny])
def health(request):
    return Response({"status": "ok"})


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------
@api_view(["POST"])
@permission_classes([AllowAny])
def register(request):
    """Signup: create user, return JWT tokens + user."""
    serializer = RegisterSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    user = serializer.save()
    refresh = RefreshToken.for_user(user)
    return Response(
        {
            "user": UserSerializer(user).data,
            "access": str(refresh.access_token),
            "refresh": str(refresh),
        },
        status=status.HTTP_201_CREATED,
    )


class MyTokenObtainPairSerializer(TokenObtainPairSerializer):
    """Login serializer that also returns the user object alongside tokens."""
    def validate(self, attrs):
        data = super().validate(attrs)
        data["user"] = UserSerializer(self.user).data
        return data


class LoginView(TokenObtainPairView):
    serializer_class = MyTokenObtainPairSerializer
    permission_classes = [AllowAny]


@api_view(["POST"])
def logout(request):
    """Logout by blacklisting the refresh token."""
    try:
        RefreshToken(request.data["refresh"]).blacklist()
    except Exception:
        pass
    return Response(status=status.HTTP_205_RESET_CONTENT)


# ---------------------------------------------------------------------------
# Users
# ---------------------------------------------------------------------------
@api_view(["GET", "PUT"])
def me(request):
    """Get or update the current user's profile."""
    if request.method == "GET":
        return Response(UserSerializer(request.user).data)
    serializer = UserSerializer(request.user, data=request.data, partial=True)
    serializer.is_valid(raise_exception=True)
    serializer.save()
    return Response(serializer.data)


@api_view(["GET"])
def user_search(request):
    """Find a user by exact username (used to add members to a group)."""
    username = request.query_params.get("username", "").strip()
    if not username:
        return Response({"detail": "username query param required."},
                        status=status.HTTP_400_BAD_REQUEST)
    user = User.objects.filter(username=username).first()
    if not user:
        return Response({"detail": "User not found."},
                        status=status.HTTP_404_NOT_FOUND)
    return Response(UserSerializer(user).data)


# ---------------------------------------------------------------------------
# Groups
# ---------------------------------------------------------------------------
@api_view(["GET", "POST"])
def groups_list_create(request):
    if request.method == "GET":
        groups = Group.objects.filter(members__user=request.user).distinct()
        return Response(GroupSerializer(groups, many=True).data)

    # POST — create group; creator auto-joins as a member.
    serializer = GroupSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    with transaction.atomic():
        group = Group.objects.create(
            name=serializer.validated_data["name"],
            description=serializer.validated_data.get("description", ""),
            created_by=request.user,
        )
        GroupMember.objects.create(group=group, user=request.user)
    return Response(GroupSerializer(group).data, status=status.HTTP_201_CREATED)


@api_view(["GET", "PUT", "DELETE"])
def group_detail(request, group_id):
    group = _require_member(request.user, group_id)

    if request.method == "GET":
        return Response(GroupSerializer(group).data)

    if request.method == "PUT":
        serializer = GroupSerializer(group, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    # DELETE — only the creator may delete.
    if group.created_by_id != request.user.id:
        return Response({"detail": "Only the creator can delete this group."},
                        status=status.HTTP_403_FORBIDDEN)
    group.delete()
    return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(["POST"])
def group_add_member(request, group_id):
    """Add a member by username (direct-add, no approval). Q20."""
    group = _require_member(request.user, group_id)
    username = (request.data.get("username") or "").strip()
    if not username:
        return Response({"detail": "username is required."},
                        status=status.HTTP_400_BAD_REQUEST)
    target = User.objects.filter(username=username).first()
    if not target:
        return Response({"detail": "User not found."},
                        status=status.HTTP_404_NOT_FOUND)
    membership, created = GroupMember.objects.get_or_create(group=group, user=target)
    if not created:
        return Response({"detail": "User is already a member."},
                        status=status.HTTP_400_BAD_REQUEST)
    _notify_group(group, f"{target.username} was added to '{group.name}'.",
                  exclude_user_id=target.id)
    return Response(GroupMemberSerializer(membership).data,
                    status=status.HTTP_201_CREATED)


@api_view(["DELETE"])
def group_remove_member(request, group_id, user_id):
    group = _require_member(request.user, group_id)
    membership = group.members.filter(user_id=user_id).first()
    if not membership:
        return Response({"detail": "Member not found."},
                        status=status.HTTP_404_NOT_FOUND)
    membership.delete()
    return Response(status=status.HTTP_204_NO_CONTENT)


# ---------------------------------------------------------------------------
# Expenses
# ---------------------------------------------------------------------------
@api_view(["GET", "POST"])
def group_expenses(request, group_id):
    group = _require_member(request.user, group_id)

    if request.method == "GET":
        expenses = (
            group.expenses
            .select_related("payer")
            .prefetch_related("splits__user", "comments__user")
        )
        return Response(ExpenseSerializer(expenses, many=True).data)

    # POST — create expense, compute splits, recompute balances, notify.
    serializer = ExpenseCreateSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    data = serializer.validated_data

    member_ids = set(group.members.values_list("user_id", flat=True))
    if data["payer"] not in member_ids:
        return Response({"detail": "Payer must be a group member."},
                        status=status.HTTP_400_BAD_REQUEST)
    for s in data["splits"]:
        if s["user"] not in member_ids:
            return Response({"detail": f"User {s['user']} is not a group member."},
                            status=status.HTTP_400_BAD_REQUEST)

    try:
        amounts = build_splits(
            data["amount"], data["split_type"],
            [dict(s) for s in data["splits"]], data["payer"],
        )
    except DjangoValidationError as e:
        return Response({"detail": e.messages}, status=status.HTTP_400_BAD_REQUEST)

    with transaction.atomic():
        expense = Expense.objects.create(
            group=group,
            payer_id=data["payer"],
            amount=data["amount"],
            description=data["description"],
            category=data.get("category", ""),
            split_type=data["split_type"],
        )
        ExpenseSplit.objects.bulk_create(
            [ExpenseSplit(expense=expense, user_id=uid, amount_owed=amt)
             for uid, amt in amounts.items()]
        )
        recompute_group_balances(group)
        _notify_group(
            group,
            f"{request.user.username} added '{expense.description}' (₹{expense.amount}).",
            exclude_user_id=request.user.id,
        )
    return Response(ExpenseSerializer(expense).data, status=status.HTTP_201_CREATED)


@api_view(["GET", "DELETE"])
def expense_detail(request, expense_id):
    expense = get_object_or_404(Expense, id=expense_id)
    _require_member(request.user, expense.group_id)

    if request.method == "GET":
        return Response(ExpenseSerializer(expense).data)

    # DELETE — remove expense and recompute balances.
    group = expense.group
    with transaction.atomic():
        expense.delete()
        recompute_group_balances(group)
    return Response(status=status.HTTP_204_NO_CONTENT)


# ---------------------------------------------------------------------------
# Comments
# ---------------------------------------------------------------------------
@api_view(["GET", "POST"])
def expense_comments(request, expense_id):
    expense = get_object_or_404(Expense, id=expense_id)
    _require_member(request.user, expense.group_id)

    if request.method == "GET":
        return Response(
            ExpenseCommentSerializer(expense.comments.all(), many=True).data
        )

    text = (request.data.get("comment_text") or "").strip()
    if not text:
        return Response({"detail": "comment_text is required."},
                        status=status.HTTP_400_BAD_REQUEST)
    comment = ExpenseComment.objects.create(
        expense=expense, user=request.user, comment_text=text
    )
    return Response(ExpenseCommentSerializer(comment).data,
                    status=status.HTTP_201_CREATED)


# ---------------------------------------------------------------------------
# Balances
# ---------------------------------------------------------------------------
@api_view(["GET"])
def group_balances(request, group_id):
    group = _require_member(request.user, group_id)
    raw = directional_balances(group)

    user_ids = {r["from_user_id"] for r in raw} | {r["to_user_id"] for r in raw}
    users = {u.id: u for u in User.objects.filter(id__in=user_ids)}

    data = [
        {
            "from_user": UserSerializer(users[r["from_user_id"]]).data,
            "to_user": UserSerializer(users[r["to_user_id"]]).data,
            "amount": r["amount"],
        }
        for r in raw
    ]
    return Response(data)


# ---------------------------------------------------------------------------
# Settlements
# ---------------------------------------------------------------------------
@api_view(["GET", "POST"])
def group_settlements(request, group_id):
    group = _require_member(request.user, group_id)

    if request.method == "GET":
        return Response(SettlementSerializer(group.settlements.all(), many=True).data)

    serializer = SettlementCreateSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    d = serializer.validated_data

    member_ids = set(group.members.values_list("user_id", flat=True))
    if d["from_user"] not in member_ids or d["to_user"] not in member_ids:
        return Response({"detail": "Both users must be group members."},
                        status=status.HTTP_400_BAD_REQUEST)
    if d["from_user"] == d["to_user"]:
        return Response({"detail": "Cannot settle with yourself."},
                        status=status.HTTP_400_BAD_REQUEST)

    with transaction.atomic():
        settlement = Settlement.objects.create(
            group=group,
            from_user_id=d["from_user"],
            to_user_id=d["to_user"],
            amount=d["amount"],
        )
        recompute_group_balances(group)
        _notify_group(
            group,
            f"{settlement.from_user.username} paid {settlement.to_user.username} ₹{settlement.amount}.",
            exclude_user_id=request.user.id,
        )
    return Response(SettlementSerializer(settlement).data,
                    status=status.HTTP_201_CREATED)


# ---------------------------------------------------------------------------
# Notifications
# ---------------------------------------------------------------------------
@api_view(["GET"])
def notifications_list(request):
    return Response(
        NotificationSerializer(request.user.notifications.all()[:50], many=True).data
    )


@api_view(["PUT"])
def notification_mark_read(request, notif_id):
    notif = request.user.notifications.filter(id=notif_id).first()
    if not notif:
        return Response(status=status.HTTP_404_NOT_FOUND)
    notif.is_read = True
    notif.save()
    return Response(NotificationSerializer(notif).data)


@api_view(["GET"])
def notifications_unread_count(request):
    return Response({"count": request.user.notifications.filter(is_read=False).count()})
