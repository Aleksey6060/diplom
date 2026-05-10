from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models


def chat_file_upload_to(instance, filename):
    return f"chats/{instance.room_id}/{filename}"


class ChatRoom(models.Model):
    """Комната чата: приватный (1-на-1) или групповой."""

    class RoomType(models.TextChoices):
        PRIVATE = "private", "Личный"
        GROUP = "group", "Групповой"

    university = models.ForeignKey(
        "universities.University",
        on_delete=models.CASCADE,
        related_name="chat_rooms",
        null=True,
        blank=True,
        verbose_name="ВУЗ",
    )
    room_type = models.CharField(
        "Тип чата",
        max_length=10,
        choices=RoomType.choices,
    )
    title = models.CharField(
        "Название",
        max_length=255,
        blank=True,
        help_text="Используется для групповых чатов. Для приватных генерируется автоматически.",
    )

    # Привязка к курсу/группе для группового чата
    course = models.ForeignKey(
        "courses.Course",
        on_delete=models.CASCADE,
        related_name="chat_rooms",
        null=True,
        blank=True,
        verbose_name="Курс",
    )
    student_group = models.ForeignKey(
        "groups.StudentGroups",
        on_delete=models.CASCADE,
        related_name="chat_rooms",
        null=True,
        blank=True,
        verbose_name="Группа студентов",
    )

    # Привязка к предмету для приватного чата (преподаватель <-> студент)
    subject = models.ForeignKey(
        "courses.Subject",
        on_delete=models.SET_NULL,
        related_name="chat_rooms",
        null=True,
        blank=True,
        verbose_name="Предмет",
    )

    is_active = models.BooleanField(default=True, verbose_name="Активен")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Дата создания")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="Дата обновления")

    class Meta:
        ordering = ("-updated_at",)
        verbose_name = "Чат"
        verbose_name_plural = "Чаты"

    def __str__(self):
        return self.title or f"Chat #{self.pk}"


class ChatParticipant(models.Model):
    """Участник чата."""

    class ParticipantRole(models.TextChoices):
        TEACHER = "teacher", "Преподаватель"
        STUDENT = "student", "Студент"
        ADMIN = "admin", "Администратор"

    room = models.ForeignKey(
        ChatRoom,
        on_delete=models.CASCADE,
        related_name="participants",
        verbose_name="Чат",
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="chat_participations",
        verbose_name="Пользователь",
    )
    role = models.CharField(
        "Роль в чате",
        max_length=10,
        choices=ParticipantRole.choices,
    )
    joined_at = models.DateTimeField(auto_now_add=True, verbose_name="Дата присоединения")
    is_active = models.BooleanField(default=True, verbose_name="Активен")
    last_read_message_id = models.PositiveIntegerField(default=0, verbose_name="ID последнего прочитанного сообщения")

    class Meta:
        ordering = ("joined_at",)
        verbose_name = "Участник чата"
        verbose_name_plural = "Участники чата"
        constraints = [
            models.UniqueConstraint(
                fields=["room", "user"],
                name="uq_chat_participant_room_user",
            ),
        ]

    def __str__(self):
        return f"{self.user} in {self.room}"


class ChatMessage(models.Model):
    """Сообщение в чате."""

    class MessageType(models.TextChoices):
        TEXT = "text", "Текст"
        FILE = "file", "Файл"
        IMAGE = "image", "Изображение"

    room = models.ForeignKey(
        ChatRoom,
        on_delete=models.CASCADE,
        related_name="messages",
        verbose_name="Чат",
    )
    sender = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="chat_messages",
        verbose_name="Отправитель",
    )
    message_type = models.CharField(
        max_length=10,
        choices=MessageType.choices,
        default=MessageType.TEXT,
        verbose_name="Тип сообщения",
    )
    text = models.TextField(blank=True, verbose_name="Текст")
    file = models.FileField(
        upload_to=chat_file_upload_to,
        null=True,
        blank=True,
        verbose_name="Файл",
    )
    reply_to = models.ForeignKey(
        "self",
        on_delete=models.SET_NULL,
        related_name="replies",
        null=True,
        blank=True,
        verbose_name="Ответ на сообщение",
    )
    is_read = models.BooleanField(default=False, verbose_name="Прочитано")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Дата создания")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="Дата обновления")

    class Meta:
        ordering = ("created_at",)
        verbose_name = "Сообщение чата"
        verbose_name_plural = "Сообщения чата"
        indexes = [
            models.Index(fields=["room", "created_at"]),
        ]

    def __str__(self):
        return f"Message #{self.pk} in {self.room}"

    def clean(self):
        if self.message_type == self.MessageType.TEXT and not self.text:
            raise ValidationError({"text": "Текстовое сообщение не может быть пустым."})

        if self.message_type in (self.MessageType.FILE, self.MessageType.IMAGE) and not self.file:
            raise ValidationError({"file": "Для файла/изображения нужно прикрепить файл."})
