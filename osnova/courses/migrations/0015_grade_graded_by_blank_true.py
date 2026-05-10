from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("courses", "0014_testmaterial_grade_assignment_setnull"),
    ]

    operations = [
        migrations.AlterField(
            model_name="grade",
            name="graded_by",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="given_grades",
                to=settings.AUTH_USER_MODEL,
                verbose_name="Кто выставил",
            ),
        ),
    ]

