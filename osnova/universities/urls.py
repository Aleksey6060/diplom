from django.urls import path

from .views import (
    UniversityListCreateAPIView,
    UniversityRetrieveUpdateDestroyAPIView,
)

app_name = "universities"

urlpatterns = [
    path("", UniversityListCreateAPIView.as_view(), name="list-create"),
    path("<slug:slug>/", UniversityRetrieveUpdateDestroyAPIView.as_view(), name="detail"),
]
