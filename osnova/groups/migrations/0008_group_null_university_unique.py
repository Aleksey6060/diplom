from django.db import migrations, models
from django.db.models import Q


def _dedupe_null_university_groups(apps, schema_editor):
    StudentGroups = apps.get_model("groups", "StudentGroups")

    seen_names = set()
    for group in StudentGroups.objects.filter(university__isnull=True).order_by("name", "id").only("id", "name"):
        name = (group.name or "").strip()
        key = name
        if key in seen_names:
            suffix = f" #{group.id}"
            max_len = 50 - len(suffix)
            new_name = (name[:max_len] if max_len > 0 else "") + suffix
            StudentGroups.objects.filter(id=group.id).update(name=new_name)
        else:
            seen_names.add(key)


class Migration(migrations.Migration):
    dependencies = [
        ("groups", "0007_semesterscheduleentry_teacher"),
    ]

    operations = [
        migrations.RunPython(_dedupe_null_university_groups, migrations.RunPython.noop),
        migrations.AddConstraint(
            model_name="studentgroups",
            constraint=models.UniqueConstraint(
                fields=("name",),
                condition=Q(university__isnull=True),
                name="uq_group_nulluniversity_name",
            ),
        ),
    ]

