import django.db.models.deletion
from django.db import migrations, models


def purge_group_rooms(apps, schema_editor):
    """Старые GROUP-комнаты ссылались на courses.StudentGroup (нерабочая привязка).

    Перед сменой таргета FK — чистим все записи, чтобы не повиснуть на несуществующих id.
    """
    ChatRoom = apps.get_model("chats", "ChatRoom")
    ChatRoom.objects.filter(student_group__isnull=False).delete()


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("chats", "0002_initial"),
        ("groups", "0003_studentgroups_university_alter_studentgroups_name_and_more"),
    ]

    operations = [
        migrations.RunPython(purge_group_rooms, noop),
        migrations.AlterField(
            model_name="chatroom",
            name="student_group",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="chat_rooms",
                to="groups.studentgroups",
                verbose_name="Группа студентов",
            ),
        ),
    ]
