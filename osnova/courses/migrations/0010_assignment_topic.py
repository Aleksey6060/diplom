from django.db import migrations, models
import django.db.models.deletion
from django.db.models import Q


class Migration(migrations.Migration):

    dependencies = [
        ("courses", "0009_alter_assignment_max_grade_alter_course_course_type"),
    ]

    operations = [
        migrations.AddField(
            model_name="assignment",
            name="topic",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="assignments",
                to="courses.topic",
                verbose_name="Тема",
            ),
        ),
        migrations.RemoveConstraint(
            model_name="assignment",
            name="uq_assignment_subject_title",
        ),
        migrations.AddConstraint(
            model_name="assignment",
            constraint=models.UniqueConstraint(
                condition=Q(("topic__isnull", True)),
                fields=("subject", "title"),
                name="uq_assignment_subject_title_no_topic",
            ),
        ),
        migrations.AddConstraint(
            model_name="assignment",
            constraint=models.UniqueConstraint(
                condition=Q(("topic__isnull", False)),
                fields=("topic", "title"),
                name="uq_assignment_topic_title",
            ),
        ),
    ]

