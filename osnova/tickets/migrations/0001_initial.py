from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("universities", "0005_appearance_models"),
    ]

    operations = [
        migrations.CreateModel(
            name="TicketTemplate",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("title", models.CharField(max_length=255)),
                ("description", models.TextField(blank=True)),
                ("fields", models.JSONField(default=list)),
                ("published", models.BooleanField(default=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "created_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="created_ticket_templates",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "university",
                    models.ForeignKey(
                        blank=True,
                        help_text="NULL = глобальные шаблоны",
                        null=True,
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="ticket_templates",
                        to="universities.university",
                        verbose_name="ВУЗ",
                    ),
                ),
            ],
            options={
                "verbose_name": "Шаблон заявки",
                "verbose_name_plural": "Шаблоны заявок",
                "ordering": ("title", "id"),
            },
        ),
        migrations.CreateModel(
            name="Ticket",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("template_title", models.CharField(blank=True, max_length=255)),
                ("data", models.JSONField(default=dict)),
                ("images", models.JSONField(default=list)),
                ("courses", models.JSONField(default=list)),
                ("moderators", models.JSONField(default=list)),
                ("status", models.CharField(choices=[("submitted", "Принята"), ("in_progress", "В обработке"), ("done", "Выполнена")], default="submitted", max_length=32)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "assigned_to",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="tickets_assigned",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "student",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="tickets_created",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "template",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="tickets",
                        to="tickets.tickettemplate",
                    ),
                ),
                (
                    "university",
                    models.ForeignKey(
                        blank=True,
                        help_text="NULL = глобальные заявки",
                        null=True,
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="tickets",
                        to="universities.university",
                        verbose_name="ВУЗ",
                    ),
                ),
            ],
            options={
                "verbose_name": "Заявка",
                "verbose_name_plural": "Заявки",
                "ordering": ("-created_at", "-id"),
            },
        ),
    ]

