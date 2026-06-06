"""
URL routes for the API app. Each path maps to a view function in views.py.
All routes are prefixed with /api/ by the project urls.py.
"""

from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView

from . import views

urlpatterns = [
    # Health
    path("health/", views.health),

    # Auth
    path("auth/signup/", views.register),
    path("auth/login/", views.LoginView.as_view()),
    path("auth/refresh/", TokenRefreshView.as_view()),
    path("auth/logout/", views.logout),
    path("auth/me/", views.me),

    # Users
    path("users/me/", views.me),
    path("users/search/", views.user_search),

    # Groups
    path("groups/", views.groups_list_create),
    path("groups/<int:group_id>/", views.group_detail),
    path("groups/<int:group_id>/members/", views.group_add_member),
    path("groups/<int:group_id>/members/<int:user_id>/", views.group_remove_member),

    # Expenses (nested under a group for create/list)
    path("groups/<int:group_id>/expenses/", views.group_expenses),
    path("expenses/<int:expense_id>/", views.expense_detail),
    path("expenses/<int:expense_id>/comments/", views.expense_comments),

    # Balances
    path("groups/<int:group_id>/balances/", views.group_balances),

    # Settlements
    path("groups/<int:group_id>/settlements/", views.group_settlements),

    # Notifications
    path("notifications/", views.notifications_list),
    path("notifications/<int:notif_id>/read/", views.notification_mark_read),
    path("notifications/unread-count/", views.notifications_unread_count),
]
