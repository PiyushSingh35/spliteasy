"""
Root URL configuration. Mounts the Django admin and the API app under /api/.
"""
from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/", include("api.urls")),
]
