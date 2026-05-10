from django.urls import path

from .views import (
    BannerCurrentAPIView,
    BannerManageAPIView,
    BannerToggleAPIView,
)

app_name = "banner"

urlpatterns = [
    path("", BannerCurrentAPIView.as_view(), name="current"),
    path("manage/", BannerManageAPIView.as_view(), name="manage"),
    path("toggle/", BannerToggleAPIView.as_view(), name="toggle"),
]
