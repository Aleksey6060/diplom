from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("courses", "0006_assignment_submission_file"),
    ]

    operations = [
        migrations.AlterField(
            model_name="semester",
            name="delay_published_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
