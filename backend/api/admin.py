"""
Register models in the Django admin so all data is browsable at /admin/.
"""
from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin

from .models import (
    User, Group, GroupMember, Expense, ExpenseSplit,
    Settlement, ExpenseComment, Balance, Notification,
)


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = ("id", "username", "email", "name", "is_staff")
    # Show our extra `name` field on the edit page.
    fieldsets = BaseUserAdmin.fieldsets + (("Extra", {"fields": ("name",)}),)


@admin.register(Group)
class GroupAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "created_by", "created_at")
    search_fields = ("name",)


@admin.register(GroupMember)
class GroupMemberAdmin(admin.ModelAdmin):
    list_display = ("id", "group", "user", "joined_at")


@admin.register(Expense)
class ExpenseAdmin(admin.ModelAdmin):
    list_display = ("id", "description", "amount", "payer", "group", "split_type", "created_at")
    list_filter = ("split_type",)


@admin.register(ExpenseSplit)
class ExpenseSplitAdmin(admin.ModelAdmin):
    list_display = ("id", "expense", "user", "amount_owed")


@admin.register(Settlement)
class SettlementAdmin(admin.ModelAdmin):
    list_display = ("id", "group", "from_user", "to_user", "amount", "created_at")


@admin.register(ExpenseComment)
class ExpenseCommentAdmin(admin.ModelAdmin):
    list_display = ("id", "expense", "user", "created_at")


@admin.register(Balance)
class BalanceAdmin(admin.ModelAdmin):
    list_display = ("id", "group", "user_low", "user_high", "net_amount", "last_updated")


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "message", "is_read", "created_at")
    list_filter = ("is_read",)
