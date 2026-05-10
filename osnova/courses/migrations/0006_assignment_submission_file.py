from django.db import migrations, models
import django.db.models.deletion
from django.conf import settings

import courses.models
import users.validators


class Migration(migrations.Migration):

    dependencies = [
        ("courses", "0005_assignment_submission"),
    ]

    operations = [
        migrations.CreateModel(
            name="AssignmentSubmissionFile",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("name", models.CharField(max_length=255)),
                ("file", models.FileField( upload_to=courses.models.assignment_submission_file_upload_to, validators=[users.validators.validate_file_size])),
                (
                    "submission",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="files",
                        to="courses.assignmentsubmission",
                    ),
                ),
            ],
            options={
                "ordering": ("id",),
            },
        ),
    ]
