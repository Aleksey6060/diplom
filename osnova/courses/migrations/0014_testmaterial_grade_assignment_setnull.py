from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("courses", "0013_testmaterial_grade_assignment_cascade_cleanup"),
    ]

    operations = [
        migrations.AlterField(
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
    ]

