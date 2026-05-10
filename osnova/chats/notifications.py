from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync

from .models import ChatParticipant


def get_user_notification_group(user_id):
    return f"notifications_user_{user_id}"


def notify_new_message(room, message, sender):
    """
    Отправляет уведомление о новом сообщении всем участникам чата
    (кроме отправителя) через их персональный канал уведомлений.
    """
    channel_layer = get_channel_layer()
    if not channel_layer:
        return

    participant_user_ids = list(
        ChatParticipant.objects.filter(
            room=room,
            is_active=True,
        ).exclude(
            user_id=sender.id,
        ).values_list("user_id", flat=True)
    )

    notification = {
        "type": "chat_notification",
        "payload": {
            "event": "new_message",
            "room_id": room.id,
            "room_type": room.room_type,
            "room_title": room.title,
            "message": {
                "id": message.id,
                "sender_id": sender.id,
                "sender_name": sender.display_name,
                "text": message.text[:200] if message.text else "",
                "message_type": message.message_type,
                "file": message.file.url if message.file else None,
                "created_at": message.created_at.isoformat(),
            },
        },
    }

    send = async_to_sync(channel_layer.group_send)
    for user_id in participant_user_ids:
        send(get_user_notification_group(user_id), notification)


def notify_messages_read(room, message_ids, reader_id):
    """
    Уведомляет участников чата о прочтении сообщений.
    """
    channel_layer = get_channel_layer()
    if not channel_layer:
        return

    participant_user_ids = list(
        ChatParticipant.objects.filter(
            room=room,
            is_active=True,
        ).exclude(
            user_id=reader_id,
        ).values_list("user_id", flat=True)
    )

    notification = {
        "type": "chat_notification",
        "payload": {
            "event": "messages_read",
            "room_id": room.id,
            "message_ids": message_ids,
            "reader_id": reader_id,
        },
    }

    send = async_to_sync(channel_layer.group_send)
    for user_id in participant_user_ids:
        send(get_user_notification_group(user_id), notification)
