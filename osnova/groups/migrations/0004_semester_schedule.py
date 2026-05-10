from datetime import time

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("courses", "0015_grade_graded_by_blank_true"),
        ("groups", "0003_studentgroups_university_alter_studentgroups_name_and_more"),
    ]

    operations = [
        migrations.CreateModel(
            name="SemesterSchedule",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("start_time", models.TimeField(default=time(9, 0))),
                ("lessons_per_day", models.PositiveSmallIntegerField(default=4)),
                ("lesson_duration_minutes", models.PositiveSmallIntegerField(default=90)),
                ("break_minutes", models.PositiveSmallIntegerField(default=10)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("group", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="semester_schedules", to="groups.studentgroups")),
                ("semester", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="group_schedules", to="courses.semester")),
            ],
            options={
                "constraints": [
                    models.UniqueConstraint(fields=("group", "semester"), name="uq_semester_schedule_group_semester"),
                ],
            },
        ),
        migrations.CreateModel(
            name="SemesterScheduleEntry",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("weekday", models.PositiveSmallIntegerField()),
                ("lesson", models.PositiveSmallIntegerField()),
                ("schedule", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="entries", to="groups.semesterschedule")),
                ("subject", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="schedule_entries", to="courses.subject")),
            ],
            options={
                "indexes": [
                    models.Index(fields=["schedule", "weekday", "lesson"], name="groups_semes_schedule_3d0b1a_idx"),
                ],
                "constraints": [
                    models.UniqueConstraint(fields=("schedule", "weekday", "lesson"), name="uq_schedule_entry_cell"),
                ],
            },
        ),
    ]

