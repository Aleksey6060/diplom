from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("courses", "0010_assignment_topic"),
    ]

    operations = [
        migrations.AddField(
            model_name="testattempt",
            name="grade_value",
            field=models.PositiveSmallIntegerField(blank=True, null=True, verbose_name="Оценка"),
        ),
    ]

