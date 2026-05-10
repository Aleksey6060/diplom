from django.db import migrations, models


def set_assignment_max_grade_5_when_safe(apps, schema_editor):
    Assignment = apps.get_model("courses", "Assignment")
    Grade = apps.get_model("courses", "Grade")
    safe_ids = (
        Assignment.objects.exclude(max_grade=5)
        .exclude(grades__value__gt=5)
        .values_list("id", flat=True)
    )
    Assignment.objects.filter(id__in=list(safe_ids)).update(max_grade=5)


class Migration(migrations.Migration):

    dependencies = [
        ("courses", "0007_semester_delay_published_at_datetime"),
    ]

    operations = [
        migrations.AlterField(
            model_name="assignment",
            name="max_grade",
            field=models.PositiveSmallIntegerField(default=5, verbose_name="Максимальный балл"),
        ),
        migrations.RunPython(set_assignment_max_grade_5_when_safe, migrations.RunPython.noop),
    ]

