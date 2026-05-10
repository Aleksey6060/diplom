from django.conf import settings
from django.db import models, transaction


class TicketStatus(models.TextChoices):
    SUBMITTED = "submitted", "Принята"
    IN_PROGRESS = "in_progress", "В обработке"
    DONE = "done", "Выполнена"


class TicketTemplate(models.Model):
    university = models.ForeignKey(
        "universities.University",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="ticket_templates",
        verbose_name="ВУЗ",
        help_text="NULL = глобальные шаблоны",
    )
    title = models.CharField(max_length=255, verbose_name="Название")
    description = models.TextField(blank=True, verbose_name="Описание")
    fields = models.JSONField(default=list, verbose_name="Поля")
    published = models.BooleanField(default=True, verbose_name="Опубликован")
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_ticket_templates",
        verbose_name="Создал",
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Дата создания")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="Дата обновления")

    class Meta:
        ordering = ("title", "id")
        verbose_name = "Шаблон заявки"
        verbose_name_plural = "Шаблоны заявок"


class Ticket(models.Model):
    university = models.ForeignKey(
        "universities.University",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="tickets",
        verbose_name="ВУЗ",
        help_text="NULL = глобальные заявки",
    )
    template = models.ForeignKey(
        TicketTemplate,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="tickets",
        verbose_name="Шаблон",
    )
    template_title = models.CharField(max_length=255, blank=True, verbose_name="Название шаблона")
    student = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="tickets_created",
        verbose_name="Студент",
    )
    data = models.JSONField(default=dict, verbose_name="Данные")
    images = models.JSONField(default=list, verbose_name="Изображения")
    status = models.CharField(max_length=32, choices=TicketStatus.choices, default=TicketStatus.SUBMITTED, verbose_name="Статус")
    assigned_to = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="tickets_assigned",
        verbose_name="Назначено",
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Дата создания")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="Дата обновления")

    class Meta:
        ordering = ("-created_at", "-id")
        verbose_name = "Заявка"
        verbose_name_plural = "Заявки"

    @transaction.atomic
    def assign_to(self, user):
        locked = Ticket.objects.select_for_update().get(pk=self.pk)
        if locked.assigned_to_id is not None or locked.status != TicketStatus.SUBMITTED:
            return False
        locked.assigned_to = user
        locked.status = TicketStatus.IN_PROGRESS
        locked.save(update_fields=["assigned_to", "status", "updated_at"])
        self.assigned_to = locked.assigned_to
        self.status = locked.status
        self.updated_at = locked.updated_at
        return True
