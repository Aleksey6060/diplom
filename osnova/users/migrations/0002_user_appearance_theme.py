from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("users", "0001_initial"),
        ("universities", "0005_appearance_models"),
    ]

    operations = [
        migrations.AddField(
            model_name="user",
            name="appearance_theme",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="selected_users",
                to="universities.appearancetheme",
                verbose_name="Тема оформления пользователя",
            ),
        ),
    ]

