from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("chats", "0003_chatroom_student_group_to_groups"),
    ]

    operations = [
        migrations.AddField(
            model_name="chatparticipant",
            name="last_read_message_id",
            field=models.PositiveIntegerField(default=0),
        ),
    ]

