from django.db import migrations, models
from django.db.models import Q
from django.utils.text import slugify


def _dedupe_null_university_roles(apps, schema_editor):
    Role = apps.get_model("users", "Role")

    seen_names = set()
    for role in Role.objects.filter(university__isnull=True).order_by("name", "id").only("id", "name"):
        name = (role.name or "").strip()
        key = name
        if key in seen_names:
            suffix = f" #{role.id}"
            max_len = 150 - len(suffix)
            new_name = (name[:max_len] if max_len > 0 else "") + suffix
            Role.objects.filter(id=role.id).update(name=new_name)
        else:
            seen_names.add(key)

    seen_slugs = set()
    for role in Role.objects.filter(university__isnull=True).order_by("slug", "id").only("id", "slug", "name"):
        slug = (role.slug or "").strip()
        if not slug:
            base_slug = slugify(role.name or "", allow_unicode=True)[:160] or "role"
            suffix = f"-{role.id}"
            max_len = 170 - len(suffix)
            slug = (base_slug[:max_len] if max_len > 0 else "") + suffix

        if slug in seen_slugs:
            suffix = f"-{role.id}"
            max_len = 170 - len(suffix)
            new_slug = (slug[:max_len] if max_len > 0 else "") + suffix
            Role.objects.filter(id=role.id).update(slug=new_slug)
            seen_slugs.add(new_slug)
        else:
            seen_slugs.add(slug)


class Migration(migrations.Migration):
    dependencies = [
        ("users", "0004_alter_filesprofile_file"),
    ]

    operations = [
        migrations.RunPython(_dedupe_null_university_roles, migrations.RunPython.noop),
        migrations.AddConstraint(
            model_name="role",
            constraint=models.UniqueConstraint(
                fields=("name",),
                condition=Q(university__isnull=True),
                name="uq_role_nulluniversity_name",
            ),
        ),
        migrations.AddConstraint(
            model_name="role",
            constraint=models.UniqueConstraint(
                fields=("slug",),
                condition=Q(university__isnull=True),
                name="uq_role_nulluniversity_slug",
            ),
        ),
    ]

