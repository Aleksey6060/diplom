from django.urls import path

from .views import (
    AdminChatRoomDetailAPIView,
    AdminChatRoomListAPIView,
    AdminChatRoomMessagesAPIView,
    AdminTeacherChatRoomListAPIView,
    ChatMessageListCreateAPIView,
    ChatRoomDetailAPIView,
    ChatRoomListCreateAPIView,
)

app_name = "chats"

urlpatterns = [
    path("", ChatRoomListCreateAPIView.as_view(), name="room-list-create"),
    path("admin/", AdminChatRoomListAPIView.as_view(), name="admin-room-list"),
    path("admin/teachers/", AdminTeacherChatRoomListAPIView.as_view(), name="admin-teacher-room-list"),
    path("admin/<int:pk>/", AdminChatRoomDetailAPIView.as_view(), name="admin-room-detail"),
    path(
        "admin/<int:room_id>/messages/",
        AdminChatRoomMessagesAPIView.as_view(),
        name="admin-room-messages",
    ),
    path("<int:pk>/", ChatRoomDetailAPIView.as_view(), name="room-detail"),
    path("<int:room_id>/messages/", ChatMessageListCreateAPIView.as_view(), name="messages"),
]
