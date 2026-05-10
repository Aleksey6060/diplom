from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("tickets", "0001_initial"),
    ]

    operations = [
        migrations.RemoveField(
            model_name="ticket",
            name="courses",
        ),
        migrations.RemoveField(
            model_name="ticket",
            name="moderators",
        ),
    ]

