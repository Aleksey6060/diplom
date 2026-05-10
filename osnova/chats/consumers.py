from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncJsonWebsocketConsumer

from .models import ChatMessage, ChatParticipant, ChatRoom
from .notifications import get_user_notification_group


class ChatConsumer(AsyncJsonWebsocketConsumer):
    """
    WebSocket consumer для чата.

    Подключение:
        ws://host/ws/chat/<room_id>/?token=<jwt_access_token>

    Клиент -> Сервер (отправка сообщения):
        {
            "type": "chat.message",
            "text": "Привет!",
            "message_type": "text",       // "text" | "file" | "image"
            "reply_to": null              // ID сообщения или null
        }

    Сервер -> Клиент (получение сообщения):
        {
            "type": "chat.message",
            "message": {
                "id": 1,
                "sender_id": 5,
                "sender_name": "Иванов Иван",
                "text": "Привет!",
                "message_type": "text",
                "file": null,
                "reply_to": null,
                "created_at": "2026-03-30T12:00:00Z"
            }
        }

    Сервер -> Клиент (уведомление о прочтении):
        {
            "type": "chat.read",
            "message_ids": [1, 2, 3],
            "reader_id": 5
        }
    """

    async def connect(self):
        self.room_id = self.scope["url_route"]["kwargs"]["room_id"]
        self.room_group_name = f"chat_{self.room_id}"
        user = self.scope.get("user")

        if not user or not user.is_authenticated:
            await self.close()
            return

        is_participant = await self._is_participant(user.id, self.room_id)
        if not is_participant:
            await self.close()
            return

        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name,
        )
        await self.accept()

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(
            self.room_group_name,
            self.channel_name,
        )

    async def receive_json(self, content, **kwargs):
        msg_type = content.get("type")
        user = self.scope["user"]

        if msg_type == "chat.message":
            message_data, room, msg_obj = await self._save_message(
                room_id=self.room_id,
                sender=user,
                text=content.get("text", ""),
                message_type=content.get("message_type", "text"),
                reply_to_id=content.get("reply_to"),
            )
            # Отправляем в чат-комнату
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    "type": "chat_message",
                    "message": message_data,
                },
            )
            # Отправляем глобальные уведомления
            await self._send_notifications(room, msg_obj, user)

        elif msg_type == "chat.read":
            message_ids = content.get("message_ids", [])
            if message_ids:
                await self._mark_as_read(message_ids, user.id)
                await self.channel_layer.group_send(
                    self.room_group_name,
                    {
                        "type": "chat_read",
                        "message_ids": message_ids,
                        "reader_id": user.id,
                    },
                )
                # Уведомляем о прочтении
                room = await self._get_room(self.room_id)
                await self._send_read_notifications(room, message_ids, user.id)

    async def chat_message(self, event):
        await self.send_json({
            "type": "chat.message",
            "message": event["message"],
        })

    async def chat_read(self, event):
        await self.send_json({
            "type": "chat.read",
            "message_ids": event["message_ids"],
            "reader_id": event["reader_id"],
        })

    @database_sync_to_async
    def _is_participant(self, user_id, room_id):
        return ChatParticipant.objects.filter(
            room_id=room_id,
            user_id=user_id,
            is_active=True,
        ).exists()

    @database_sync_to_async
    def _get_room(self, room_id):
        return ChatRoom.objects.get(id=room_id)

    @database_sync_to_async
    def _save_message(self, room_id, sender, text, message_type, reply_to_id):
        msg = ChatMessage.objects.create(
            room_id=room_id,
            sender=sender,
            text=text,
            message_type=message_type,
            reply_to_id=reply_to_id,
        )
        room = ChatRoom.objects.get(id=room_id)
        ChatRoom.objects.filter(id=room_id).update(updated_at=msg.created_at)

        data = {
            "id": msg.id,
            "sender_id": sender.id,
            "sender_name": sender.display_name,
            "text": msg.text,
            "message_type": msg.message_type,
            "file": msg.file.url if msg.file else None,
            "reply_to": msg.reply_to_id,
            "created_at": msg.created_at.isoformat(),
        }
        return data, room, msg

    @database_sync_to_async
    def _mark_as_read(self, message_ids, user_id):
        try:
            max_id = max(int(x) for x in message_ids)
        except Exception:
            return
        if max_id <= 0:
            return
        ChatParticipant.objects.filter(
            room_id=self.room_id,
            user_id=user_id,
            is_active=True,
            last_read_message_id__lt=max_id,
        ).update(last_read_message_id=max_id)

    @database_sync_to_async
    def _send_notifications(self, room, msg, sender):
        from .notifications import notify_new_message
        notify_new_message(room, msg, sender)

    @database_sync_to_async
    def _send_read_notifications(self, room, message_ids, reader_id):
        from .notifications import notify_messages_read
        notify_messages_read(room, message_ids, reader_id)


class NotificationConsumer(AsyncJsonWebsocketConsumer):
    """
    Глобальный канал уведомлений пользователя.

    Подключение:
        ws://host/ws/notifications/?token=<jwt_access_token>

    Пользователь подключается один раз при запуске приложения
    и получает уведомления обо всех событиях во всех своих чатах.

    Сервер -> Клиент (новое сообщение в любом чате):
        {
            "type": "notification",
            "payload": {
                "event": "new_message",
                "room_id": 1,
                "room_type": "private",
                "room_title": "Иванов И.И. — Петров П.П.",
                "message": {
                    "id": 42,
                    "sender_id": 5,
                    "sender_name": "Иванов Иван Иванович",
                    "text": "Привет!",
                    "message_type": "text",
                    "file": null,
                    "created_at": "2026-03-30T14:30:00Z"
                }
            }
        }

    Сервер -> Клиент (прочтение сообщений):
        {
            "type": "notification",
            "payload": {
                "event": "messages_read",
                "room_id": 1,
                "message_ids": [40, 41, 42],
                "reader_id": 10
            }
        }
    """

    async def connect(self):
        user = self.scope.get("user")

        if not user or not user.is_authenticated:
            await self.close()
            return

        self.notification_group = get_user_notification_group(user.id)

        await self.channel_layer.group_add(
            self.notification_group,
            self.channel_name,
        )
        await self.accept()

    async def disconnect(self, close_code):
        if hasattr(self, "notification_group"):
            await self.channel_layer.group_discard(
                self.notification_group,
                self.channel_name,
            )

    async def receive_json(self, content, **kwargs):
        # Клиент не отправляет сюда ничего — канал только на получение
        pass

    async def chat_notification(self, event):
        await self.send_json({
            "type": "notification",
            "payload": event["payload"],
        })
