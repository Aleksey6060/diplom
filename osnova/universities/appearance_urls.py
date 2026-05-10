from django.urls import path
from rest_framework.routers import DefaultRouter

from .views_appearance import AppearanceSettingsViewSet, AppearanceThemeViewSet

app_name = "appearance"

router = DefaultRouter()
router.register(r"themes", AppearanceThemeViewSet, basename="appearance-themes")

urlpatterns = [
    path("settings/", AppearanceSettingsViewSet.as_view({"get": "retrieve", "patch": "partial_update", "put": "update"})),
]
urlpatterns += router.urls

