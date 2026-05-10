from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("groups", "0005_rename_groups_semes_schedule_3d0b1a_idx_groups_seme_schedul_12afea_idx"),
    ]

    operations = [
        migrations.AddField(
            model_name="semesterschedule",
            name="breaks_minutes",
            field=models.JSONField(blank=True, default=list),
        ),
    ]

