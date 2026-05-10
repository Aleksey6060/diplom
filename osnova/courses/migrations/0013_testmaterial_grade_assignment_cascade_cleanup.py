from django.db import migrations, models
import django.db.models.deletion


def cleanup_orphan_test_assignments(apps, schema_editor):
    Assignment = apps.get_model("courses", "Assignment")
    Grade = apps.get_model("courses", "Grade")
    TestMaterial = apps.get_model("courses", "TestMaterial")

    used_ids = set(TestMaterial.objects.exclude(grade_assignment__isnull=True).values_list("grade_assignment_id", flat=True))
    candidates = Assignment.objects.filter(title__startswith="Тест:").exclude(id__in=used_ids)

    by_comment = set(Grade.objects.filter(comment="Авто: тест").values_list("assignment_id", flat=True))
    ids_to_delete = [a_id for a_id in candidates.values_list("id", flat=True) if a_id in by_comment]
    if ids_to_delete:
        Assignment.objects.filter(id__in=ids_to_delete).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("courses", "0012_testmaterial_grade_assignment"),
    ]

    operations = [
        migrations.AlterField(
            model_name="testmaterial",
            name="grade_assignment",
            field=models.OneToOneField(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="test_source",
                to="courses.assignment",
            ),
        ),
        migrations.RunPython(cleanup_orphan_test_assignments, migrations.RunPython.noop),
    ]
