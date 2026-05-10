from django.db import migrations, models
from django.db.models import Q
from django.utils.text import slugify


def _dedupe_null_university_courses(apps, schema_editor):
    Course = apps.get_model("courses", "Course")
    CourseStoreCard = apps.get_model("courses", "CourseStoreCard")

    seen_titles = set()
    for course in Course.objects.filter(university__isnull=True).order_by("title", "id").only("id", "title"):
        title = (course.title or "").strip()
        key = title
        if key in seen_titles:
            suffix = f" #{course.id}"
            max_len = 255 - len(suffix)
            new_title = (title[:max_len] if max_len > 0 else "") + suffix
            Course.objects.filter(id=course.id).update(title=new_title)
        else:
            seen_titles.add(key)

    seen_slugs = set()
    for course in Course.objects.filter(university__isnull=True).order_by("slug", "id").only("id", "slug", "title"):
        slug = (course.slug or "").strip()
        if not slug:
            base_slug = slugify(course.title or "", allow_unicode=True)[:240] or "course"
            slug = base_slug
            suffix = f"-{course.id}"
            max_len = 255 - len(suffix)
            slug = (slug[:max_len] if max_len > 0 else "") + suffix

        if slug in seen_slugs:
            suffix = f"-{course.id}"
            max_len = 255 - len(suffix)
            new_slug = (slug[:max_len] if max_len > 0 else "") + suffix
            Course.objects.filter(id=course.id).update(slug=new_slug)
            seen_slugs.add(new_slug)
        else:
            seen_slugs.add(slug)

    seen_card_titles = set()
    for card in CourseStoreCard.objects.filter(university__isnull=True).order_by("title", "id").only("id", "title"):
        title = (card.title or "").strip()
        key = title
        if key in seen_card_titles:
            suffix = f" #{card.id}"
            max_len = 255 - len(suffix)
            new_title = (title[:max_len] if max_len > 0 else "") + suffix
            CourseStoreCard.objects.filter(id=card.id).update(title=new_title)
        else:
            seen_card_titles.add(key)


class Migration(migrations.Migration):
    dependencies = [
        ("courses", "0015_grade_graded_by_blank_true"),
    ]

    operations = [
        migrations.RunPython(_dedupe_null_university_courses, migrations.RunPython.noop),
        migrations.AddConstraint(
            model_name="course",
            constraint=models.UniqueConstraint(
                fields=("title",),
                condition=Q(university__isnull=True),
                name="uq_course_nulluniversity_title",
            ),
        ),
        migrations.AddConstraint(
            model_name="course",
            constraint=models.UniqueConstraint(
                fields=("slug",),
                condition=Q(university__isnull=True),
                name="uq_course_nulluniversity_slug",
            ),
        ),
        migrations.AddConstraint(
            model_name="coursestorecard",
            constraint=models.UniqueConstraint(
                fields=("title",),
                condition=Q(university__isnull=True),
                name="uq_course_store_card_nulluniversity_title",
            ),
        ),
    ]

