from django.conf import settings
import django.db.models.deletion
from django.db import migrations, models


def document_file_upload_to(instance, filename):
    if instance.university_id:
        return f"documents/u_{instance.university_id}/{filename}"
    return f"documents/global/{filename}"


class Migration(migrations.Migration):

    dependencies = [
        ("universities", "0002_initial"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="UniversityDocument",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("file", models.FileField(upload_to=document_file_upload_to)),
                ("original_name", models.CharField(blank=True, max_length=255)),
                ("content_type", models.CharField(blank=True, max_length=255)),
                ("size", models.PositiveIntegerField(default=0)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("university", models.ForeignKey(blank=True, help_text="NULL = глобальные документы для всего проекта", null=True, on_delete=django.db.models.deletion.CASCADE, related_name="documents", to="universities.university", verbose_name="ВУЗ")),
                ("uploaded_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="uploaded_documents", to=settings.AUTH_USER_MODEL)),
            ],
            options={
                "verbose_name": "Документ",
                "verbose_name_plural": "Документы",
                "ordering": ("-created_at",),
            },
        ),
    ]
