from django.db.models import Count, IntegerField, OuterRef, Q, Subquery, Value
from django.db.models.functions import Coalesce
from rest_framework import generics, permissions, status
from rest_framework.exceptions import ValidationError
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from users.permissions import HasAppPermission
from .models import ChatMessage, ChatParticipant, ChatRoom
from .serializers import (
    ChatMessageSerializer,
    ChatRoomCreateSerializer,
    ChatRoomDetailSerializer,
    ChatRoomListSerializer,
)
from .services import (
    ensure_admin_teacher_chat,
    ensure_admin_teacher_chats_for_university,
    ensure_chats_for_teacher,
    ensure_group_chat,
    ensure_private_chat,
    ensure_teacher_student_chat,
)


def _user_can_view_all_chats(user, university):
    """Admin / owner / university_owner / роль с `chats.all.view` — доступ только на чтение всех чатов."""
    if not user or not user.is_authenticated:
        return False
    if getattr(user, "is_superuser", False):
        return True
    if getattr(user, "account_type", None) == "owner":
        return True
    if university is not None and getattr(university, "owner_id", None) == user.id:
        return True
    if getattr(user, "account_type", None) == "university_owner" and university is None:
        return True
    codes = (
        user.get_permission_codes() if hasattr(user, "get_permission_codes") else set()
    )
    if "*" in codes or "chats.all.view" in codes:
        return True
    return False


def _user_can_manage_teacher_chats(request, view, university):
    user = getattr(request, "user", None)
    if not user or not getattr(user, "is_authenticated", False):
        return False
    if getattr(user, "is_superuser", False):
        return True
    return HasAppPermission("chats.assigned.view").has_permission(request, view)


class ChatRoomListCreateAPIView(APIView):
    """
    GET  - список чатов текущего пользователя.
    POST - создать новый чат.
    """
    parser_classes = (JSONParser,)

    def get_permissions(self):
        return [permissions.IsAuthenticated()]

    def get(self, request):
        user = request.user
        university = getattr(request, "university", None)
        if getattr(user, "account_type", None) == "teacher":
            ensure_admin_teacher_chat(user)
            ensure_chats_for_teacher(user)

        rooms = ChatRoom.objects.filter(
            participants__user=user,
            participants__is_active=True,
            is_active=True,
        )
        if university:
            rooms = rooms.filter(university=university)

        last_read_subq = ChatParticipant.objects.filter(
            room=OuterRef("pk"),
            user=user,
            is_active=True,
        ).values("last_read_message_id")[:1]
        last_read = Coalesce(Subquery(last_read_subq, output_field=IntegerField()), Value(0))
        unread_subq = (
            ChatMessage.objects.filter(room=OuterRef("pk"))
            .exclude(sender=user)
            .filter(id__gt=last_read)
            .values("room")
            .annotate(c=Count("id"))
            .values("c")[:1]
        )
        rooms = rooms.annotate(
            participants_count=Count("participants", filter=Q(participants__is_active=True)),
            unread_count=Coalesce(Subquery(unread_subq, output_field=IntegerField()), Value(0)),
        ).prefetch_related("participants__user").order_by("-updated_at")

        serializer = ChatRoomListSerializer(rooms, many=True, context={"request": request})
        return Response(serializer.data)

    def post(self, request):
        serializer = ChatRoomCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        university = getattr(request, "university", None)
        room_type = data["room_type"]

        if room_type == ChatRoom.RoomType.PRIVATE:
            room = self._create_private_chat(request.user, data, university)
        else:
            room = self._create_group_chat(request.user, data, university)

        return Response(
            ChatRoomDetailSerializer(room, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )

    def _create_private_chat(self, creator, data, university):
        from courses.models import Subject
        from groups.models import TeacherAttachment

        subject_id = data.get("subject_id")
        student_id = data.get("student_id")

        if not subject_id or not student_id:
            raise ValidationError("Для приватного чата нужно указать идентификатор предмета и идентификатор студента.")

        subject = Subject.objects.select_related("semester__course").filter(id=subject_id).first()
        if subject is None:
            raise ValidationError("Предмет не найден.")

        creator_is_teacher = TeacherAttachment.objects.filter(
            teacher=creator,
            subject=subject,
        ).exists()
        other_is_teacher = TeacherAttachment.objects.filter(
            teacher_id=student_id,
            subject=subject,
        ).exists()

        if creator_is_teacher:
            teacher_id, s_id = creator.id, int(student_id)
        elif other_is_teacher:
            teacher_id, s_id = int(student_id), creator.id
        else:
            raise ValidationError("Создатель или собеседник должен быть преподавателем предмета.")

        resolved_university_id = getattr(university, "id", None)
        if resolved_university_id is None:
            resolved_university_id = getattr(getattr(subject, "semester", None), "course", None)
            resolved_university_id = getattr(resolved_university_id, "university_id", None)

        room = ensure_teacher_student_chat(teacher_id, s_id, university_id=resolved_university_id)
        if room is None:
            raise ValidationError("Не удалось создать приватный чат.")
        return room

    def _create_group_chat(self, creator, data, university):
        from courses.models import Subject
        from groups.models import StudentGroups

        student_group_id = data.get("student_group_id")
        subject_id = data.get("subject_id")

        if not student_group_id or not subject_id:
            raise ValidationError("Для группового чата нужно указать идентификатор группы и идентификатор предмета.")

        group = StudentGroups.objects.filter(id=student_group_id).first()
        subject = Subject.objects.select_related("semester__course").filter(id=subject_id).first()
        if group is None or subject is None:
            raise ValidationError("Группа или предмет не найдены.")

        room = ensure_group_chat(group, subject)
        if room is None:
            raise ValidationError("Не удалось создать групповой чат.")
        return room


class ChatRoomDetailAPIView(generics.RetrieveAPIView):
    """Детали чата с участниками."""
    serializer_class = ChatRoomDetailSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return ChatRoom.objects.filter(
            participants__user=self.request.user,
            participants__is_active=True,
            is_active=True,
        ).prefetch_related("participants__user")


class ChatMessageListCreateAPIView(APIView):
    """
    GET  - история сообщений в чате (с пагинацией через ?before=<message_id>&limit=50).
    POST - отправить сообщение (с файлом/изображением).
    """
    parser_classes = (MultiPartParser, FormParser, JSONParser)
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, room_id):
        # Проверяем участие
        if not ChatParticipant.objects.filter(
            room_id=room_id, user=request.user, is_active=True
        ).exists():
            return Response({"detail": "Вы не участник этого чата."}, status=status.HTTP_403_FORBIDDEN)

        messages = ChatMessage.objects.filter(room_id=room_id).select_related("sender")

        before = request.query_params.get("before")
        if before:
            messages = messages.filter(id__lt=before)

        limit = min(int(request.query_params.get("limit", 50)), 100)
        messages = messages.order_by("-created_at")[:limit]

        serializer = ChatMessageSerializer(
            reversed(list(messages)), many=True, context={"request": request}
        )
        if not before:
            latest_id = (
                ChatMessage.objects.filter(room_id=room_id)
                .order_by("-id")
                .values_list("id", flat=True)
                .first()
            )
            if latest_id:
                ChatParticipant.objects.filter(
                    room_id=room_id,
                    user=request.user,
                    is_active=True,
                    last_read_message_id__lt=latest_id,
                ).update(last_read_message_id=latest_id)
        return Response(serializer.data)

    def post(self, request, room_id):
        if not ChatParticipant.objects.filter(
            room_id=room_id, user=request.user, is_active=True
        ).exists():
            return Response({"detail": "Вы не участник этого чата."}, status=status.HTTP_403_FORBIDDEN)

        user = request.user
        if getattr(user, "account_type", None) == "employee" and not getattr(user, "is_superuser", False):
            active_roles = set(
                ChatParticipant.objects.filter(room_id=room_id, is_active=True).values_list("role", flat=True)
            )
            is_admin_teacher_chat = (
                active_roles
                and ChatParticipant.ParticipantRole.ADMIN in active_roles
                and ChatParticipant.ParticipantRole.TEACHER in active_roles
                and ChatParticipant.ParticipantRole.STUDENT not in active_roles
                and ChatRoom.objects.filter(id=room_id, room_type=ChatRoom.RoomType.PRIVATE, subject__isnull=True).exists()
            )
            if is_admin_teacher_chat and not HasAppPermission("chats.messages.send").has_permission(request, self):
                return Response({"detail": "Недостаточно прав."}, status=status.HTTP_403_FORBIDDEN)

        serializer = ChatMessageSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)

        reply_to = serializer.validated_data.get("reply_to")
        reply_to_id = None
        if reply_to is not None:
            try:
                reply_to_id = int(getattr(reply_to, "id", reply_to))
            except Exception:
                raise ValidationError({"reply_to": "Некорректное значение reply_to."})
            if ChatMessage.objects.filter(id=reply_to_id, room_id=room_id).exists() is False:
                raise ValidationError({"reply_to": "Нельзя отвечать на сообщение из другого чата."})

        msg = ChatMessage.objects.create(
            room_id=room_id,
            sender=request.user,
            message_type=serializer.validated_data.get("message_type", "text"),
            text=serializer.validated_data.get("text", ""),
            file=serializer.validated_data.get("file"),
            reply_to_id=reply_to_id,
        )
        ChatParticipant.objects.filter(
            room_id=room_id,
            user=request.user,
            is_active=True,
            last_read_message_id__lt=msg.id,
        ).update(last_read_message_id=msg.id)

        room = ChatRoom.objects.get(id=room_id)
        ChatRoom.objects.filter(id=room_id).update(updated_at=msg.created_at)

        # Отправляем в чат-комнату через WebSocket
        from channels.layers import get_channel_layer
        from asgiref.sync import async_to_sync

        channel_layer = get_channel_layer()
        if channel_layer:
            async_to_sync(channel_layer.group_send)(
                f"chat_{room_id}",
                {
                    "type": "chat_message",
                    "message": {
                        "id": msg.id,
                        "sender_id": request.user.id,
                        "sender_name": request.user.display_name,
                        "text": msg.text,
                        "message_type": msg.message_type,
                        "file": request.build_absolute_uri(msg.file.url) if msg.file else None,
                        "reply_to": msg.reply_to_id,
                        "created_at": msg.created_at.isoformat(),
                    },
                },
            )

        # Глобальные уведомления участникам
        from .notifications import notify_new_message
        notify_new_message(room, msg, request.user)

        return Response(
            ChatMessageSerializer(msg, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )


class AdminChatRoomListAPIView(APIView):
    """
    GET — Список всех чатов (для администратора/владельца).
    Read-only endpoint для просмотра чатов как журнала.
    """

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        university = getattr(request, "university", None)
        if not _user_can_view_all_chats(request.user, university):
            return Response({"detail": "Недостаточно прав."}, status=status.HTTP_403_FORBIDDEN)
        ensure_admin_teacher_chats_for_university(university)

        rooms = ChatRoom.objects.filter(is_active=True)
        if university is not None:
            rooms = rooms.filter(university=university)

        room_type = request.query_params.get("room_type")
        if room_type in (ChatRoom.RoomType.PRIVATE, ChatRoom.RoomType.GROUP):
            rooms = rooms.filter(room_type=room_type)

        rooms = rooms.annotate(
            participants_count=Count("participants", filter=Q(participants__is_active=True)),
            unread_count=Value(0, output_field=IntegerField()),
        ).prefetch_related("participants__user").order_by("-updated_at")

        serializer = ChatRoomListSerializer(rooms, many=True, context={"request": request})
        return Response(serializer.data)


class AdminChatRoomDetailAPIView(APIView):
    """GET — детали чата для админа."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pk):
        university = getattr(request, "university", None)
        if not _user_can_view_all_chats(request.user, university):
            return Response({"detail": "Недостаточно прав."}, status=status.HTTP_403_FORBIDDEN)

        qs = ChatRoom.objects.filter(id=pk).prefetch_related("participants__user")
        if university is not None:
            qs = qs.filter(university=university)
        room = qs.first()
        if not room:
            return Response({"detail": "Не найдено."}, status=status.HTTP_404_NOT_FOUND)
        return Response(ChatRoomDetailSerializer(room, context={"request": request}).data)


class AdminChatRoomMessagesAPIView(APIView):
    """GET — журнал сообщений в чате для админа (read-only)."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, room_id):
        university = getattr(request, "university", None)
        if not _user_can_view_all_chats(request.user, university):
            return Response({"detail": "Недостаточно прав."}, status=status.HTTP_403_FORBIDDEN)

        room_qs = ChatRoom.objects.filter(id=room_id)
        if university is not None:
            room_qs = room_qs.filter(university=university)
        if not room_qs.exists():
            return Response({"detail": "Не найдено."}, status=status.HTTP_404_NOT_FOUND)

        messages = ChatMessage.objects.filter(room_id=room_id).select_related("sender")

        before = request.query_params.get("before")
        if before:
            messages = messages.filter(id__lt=before)

        limit = min(int(request.query_params.get("limit", 100)), 500)
        messages = messages.order_by("-created_at")[:limit]

        serializer = ChatMessageSerializer(
            reversed(list(messages)), many=True, context={"request": request}
        )
        return Response(serializer.data)


class AdminTeacherChatRoomListAPIView(APIView):
    """
    GET — Список чатов текущего администратора с преподавателями (создаёт недостающие).
    """

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        from django.contrib.auth import get_user_model
        from shared_modules.enums import AccountType
        from universities.models import University

        user = request.user
        university = getattr(request, "university", None)
        university_id = request.query_params.get("university_id")
        if university is None and university_id:
            try:
                university = University.objects.filter(id=int(university_id)).first()
            except Exception:
                university = None
        if not _user_can_manage_teacher_chats(request, self, university):
            return Response({"detail": "Недостаточно прав."}, status=status.HTTP_403_FORBIDDEN)

        User = get_user_model()
        teachers = User.objects.filter(
            university=university if university is not None else None,
            account_type=AccountType.TEACHER,
            is_active=True,
        )
        for t in teachers.iterator():
            ensure_admin_teacher_chat(t, admin=user)

        rooms = ChatRoom.objects.filter(
            room_type=ChatRoom.RoomType.PRIVATE,
            subject__isnull=True,
            is_active=True,
            participants__user=user,
            participants__is_active=True,
            participants__role=ChatParticipant.ParticipantRole.ADMIN,
        ).filter(
            participants__role=ChatParticipant.ParticipantRole.TEACHER,
            participants__is_active=True,
        )
        rooms = rooms.filter(university=university) if university is not None else rooms.filter(university__isnull=True)

        rooms = rooms.annotate(
            participants_count=Count("participants", filter=Q(participants__is_active=True)),
            unread_count=Value(0, output_field=IntegerField()),
        ).prefetch_related("participants__user").order_by("-updated_at")

        serializer = ChatRoomListSerializer(rooms, many=True, context={"request": request})
        return Response(serializer.data)
