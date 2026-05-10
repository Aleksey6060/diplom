from django.db import migrations, models
import django.db.models.deletion


def ensure_unique_title(model, base_title, **filter_kwargs):
    title = base_title
    i = 2
    while model.objects.filter(title=title, **filter_kwargs).exists():
        title = f"{base_title} ({i})"
        i += 1
        if i > 200:
            break
    return title


def create_grade_assignments_for_tests(apps, schema_editor):
    Assignment = apps.get_model("courses", "Assignment")
    TestMaterial = apps.get_model("courses", "TestMaterial")
    TestAttempt = apps.get_model("courses", "TestAttempt")
    Grade = apps.get_model("courses", "Grade")

    tests = TestMaterial.objects.select_related("material", "material__topic", "material__topic__subject", "material__subject").filter(
        grade_assignment__isnull=True
    )

    for t in tests:
        m = t.material
        topic = getattr(m, "topic", None)
        subject = getattr(m, "subject", None) or (getattr(topic, "subject", None) if topic else None)
        if subject is None:
            continue

        safe_topic = topic if topic and getattr(topic, "subject_id", None) else None
        base_title = f"Тест: {m.title}"

        if safe_topic:
            title = ensure_unique_title(Assignment, base_title, topic_id=safe_topic.id)
        else:
            title = ensure_unique_title(Assignment, base_title, subject_id=subject.id, topic__isnull=True)

        assignment = Assignment.objects.create(
            subject_id=subject.id,
            topic_id=getattr(safe_topic, "id", None),
            title=title,
            description="",
            max_grade=5,
            position=getattr(m, "order", 0) or 0,
        )
        t.grade_assignment_id = assignment.id
        t.save(update_fields=["grade_assignment"])

    attempts = TestAttempt.objects.select_related("test", "test__grade_assignment").filter(
        status="completed",
        test__grade_assignment__isnull=False,
    )

    best = {}
    for a in attempts:
        key = (a.test_id, a.student_id)
        prev = best.get(key)
        if prev is None or (a.percentage or 0) > (prev.percentage or 0):
            best[key] = a

    for (test_id, student_id), a in best.items():
        assignment_id = a.test.grade_assignment_id
        if not assignment_id:
            continue
        gv = a.grade_value
        if gv is None:
            pct = a.percentage or 0
            if pct > 85:
                gv = 5
            elif pct >= 70:
                gv = 4
            elif pct >= 50:
                gv = 3
            else:
                gv = 2
        Grade.objects.get_or_create(
            assignment_id=assignment_id,
            student_id=student_id,
            defaults={"value": gv, "comment": "Авто: тест", "graded_by": None},
        )


class Migration(migrations.Migration):

    dependencies = [
        ("courses", "0011_testattempt_grade_value"),
    ]

    operations = [
        migrations.AddField(
            model_name="testmaterial",
            name="grade_assignment",
            field=models.OneToOneField(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="test_source",
                to="courses.assignment",
            ),
        ),
        migrations.RunPython(create_grade_assignments_for_tests, migrations.RunPython.noop),
    ]
