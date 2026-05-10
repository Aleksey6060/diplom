from rest_framework import serializers

from .models import ChatRoom, ChatParticipant, ChatMessage


class ChatParticipantSerializer(serializers.ModelSerializer):
    user_display_name = serializers.CharField(source="user.display_name", read_only=True)
    user_email = serializers.CharField(source="user.email", read_only=True)
    user_account_type = serializers.CharField(source="user.account_type", read_only=True)

    class Meta:
        model = ChatParticipant
        fields = (
            "id",
            "user",
            "user_display_name",
            "user_email",
            "user_account_type",
            "role",
            "joined_at",
            "is_active",
        )
        read_only_fields = ("id", "joined_at")


class ChatMessageSerializer(serializers.ModelSerializer):
    sender_display_name = serializers.CharField(source="sender.display_name", read_only=True)
    file_url = serializers.SerializerMethodField()

    class Meta:
        model = ChatMessage
        fields = (
            "id",
            "room",
            "sender",
            "sender_display_name",
            "message_type",
            "text",
            "file",
            "file_url",
            "reply_to",
            "is_read",
            "created_at",
        )
        read_only_fields = ("id", "room", "sender", "is_read", "created_at")

    def get_file_url(self, obj):
        if obj.file:
            request = self.context.get("request")
            if request:
                return request.build_absolute_uri(obj.file.url)
            return obj.file.url
        return None


class ChatRoomListSerializer(serializers.ModelSerializer):
    participants_count = serializers.IntegerField(read_only=True)
    last_message = serializers.SerializerMethodField()
    unread_count = serializers.IntegerField(read_only=True)
    subject_title = serializers.CharField(source="subject.title", read_only=True)
    course_title = serializers.CharField(source="course.title", read_only=True)
    student_group_title = serializers.CharField(source="student_group.name", read_only=True)
    partner = serializers.SerializerMethodField()
    teacher = serializers.SerializerMethodField()
    participants_short = serializers.SerializerMethodField()
    participant_emails = serializers.SerializerMethodField()
    is_admin_teacher_chat = serializers.SerializerMethodField()

    class Meta:
        model = ChatRoom
        fields = (
            "id",
            "room_type",
            "title",
            "course",
            "course_title",
            "student_group",
            "student_group_title",
            "subject",
            "subject_title",
            "is_active",
            "participants_count",
            "unread_count",
            "last_message",
            "partner",
            "teacher",
            "participants_short",
            "participant_emails",
            "is_admin_teacher_chat",
            "updated_at",
        )

    def get_last_message(self, obj):
        msg = getattr(obj, "_last_message", None)
        if msg is None:
            msg = obj.messages.order_by("-created_at").first()
        if msg:
            return {
                "id": msg.id,
                "sender_id": msg.sender_id,
                "text": msg.text[:100],
                "message_type": msg.message_type,
                "created_at": msg.created_at.isoformat(),
            }
        return None

    def _current_user(self):
        request = self.context.get("request")
        return getattr(request, "user", None) if request is not None else None

    def get_partner(self, obj):
        if obj.room_type != ChatRoom.RoomType.PRIVATE:
            return None
        me = self._current_user()
        participants = list(obj.participants.all().select_related("user"))
        if me is not None and me.is_authenticated:
            other = next((p for p in participants if p.user_id != me.id), None)
        else:
            other = participants[0] if participants else None
        if not other:
            return None
        return {
            "id": other.user_id,
            "display_name": other.user.display_name,
            "email": other.user.email,
            "role": other.role,
            "account_type": other.user.account_type,
        }

    def get_teacher(self, obj):
        if obj.room_type != ChatRoom.RoomType.GROUP:
            return None
        teacher = obj.participants.filter(
            role=ChatParticipant.ParticipantRole.TEACHER, is_active=True
        ).select_related("user").first()
        if not teacher:
            return None
        return {
            "id": teacher.user_id,
            "display_name": teacher.user.display_name,
            "email": teacher.user.email,
        }

    def get_participants_short(self, obj):
        teacher = None
        student = None
        for p in obj.participants.all():
            user = p.user
            short = {
                "id": user.id,
                "display_name": user.display_name,
                "email": user.email,
            }
            if p.role == ChatParticipant.ParticipantRole.TEACHER and teacher is None:
                teacher = short
            elif p.role == ChatParticipant.ParticipantRole.STUDENT and student is None:
                student = short
        return {"teacher": teacher, "student": student}

    def get_participant_emails(self, obj):
        emails = []
        for p in obj.participants.all():
            try:
                email = p.user.email
            except Exception:
                email = None
            if email:
                emails.append(email)
        return emails

    def get_is_admin_teacher_chat(self, obj):
        if obj.room_type != ChatRoom.RoomType.PRIVATE:
            return False
        if obj.subject_id is not None:
            return False
        active_roles = {p.role for p in obj.participants.all() if p.is_active}
        if ChatParticipant.ParticipantRole.TEACHER not in active_roles:
            return False
        if ChatParticipant.ParticipantRole.ADMIN not in active_roles:
            return False
        if ChatParticipant.ParticipantRole.STUDENT in active_roles:
            return False
        return True


class ChatRoomDetailSerializer(serializers.ModelSerializer):
    participants = ChatParticipantSerializer(many=True, read_only=True)

    class Meta:
        model = ChatRoom
        fields = (
            "id",
            "room_type",
            "title",
            "course",
            "student_group",
            "subject",
            "is_active",
            "participants",
            "created_at",
            "updated_at",
        )


class ChatRoomCreateSerializer(serializers.Serializer):
    """
    Создание чата.
    Для приватного: room_type=private, subject_id, student_id
    Для группового: room_type=group, student_group_id, title (опционально)
    """
    room_type = serializers.ChoiceField(choices=ChatRoom.RoomType.choices)
    title = serializers.CharField(required=False, allow_blank=True, max_length=255)
    subject_id = serializers.IntegerField(required=False)
    student_id = serializers.IntegerField(required=False)
    student_group_id = serializers.IntegerField(required=False)
