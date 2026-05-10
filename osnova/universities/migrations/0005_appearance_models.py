from django.conf import settings
import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("universities", "0004_alter_universitydocument_file"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="AppearanceSettings",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("settings", models.JSONField(default=dict)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("university", models.OneToOneField(blank=True, help_text="NULL = глобальные настройки оформления", null=True, on_delete=django.db.models.deletion.CASCADE, related_name="appearance", to="universities.university", verbose_name="ВУЗ")),
            ],
            options={
                "verbose_name": "Настройки оформления",
                "verbose_name_plural": "Настройки оформления",
            },
        ),
        migrations.CreateModel(
            name="AppearanceTheme",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=255)),
                ("settings", models.JSONField(default=dict)),
                ("published", models.BooleanField(default=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("created_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="created_appearance_themes", to=settings.AUTH_USER_MODEL)),
                ("university", models.ForeignKey(blank=True, help_text="NULL = глобальные темы", null=True, on_delete=django.db.models.deletion.CASCADE, related_name="appearance_themes", to="universities.university", verbose_name="ВУЗ")),
            ],
            options={
                "verbose_name": "Тема оформления",
                "verbose_name_plural": "Темы оформления",
                "ordering": ("-updated_at", "-created_at", "-id"),
            },
        ),
        migrations.AddConstraint(
            model_name="appearancesettings",
            constraint=models.UniqueConstraint(condition=models.Q(("university__isnull", False)), fields=("university",), name="uq_appearance_settings_university"),
        ),
        migrations.AddConstraint(
            model_name="appearancesettings",
            constraint=models.UniqueConstraint(condition=models.Q(("university__isnull", True)), fields=("id",), name="uq_appearance_settings_global_singleton"),
        ),
    ]

