"""Сигналы чатов.

Слушаем реальные модели распределения из приложения ``groups``:
- ``TeacherAttachment.post_save`` — новый преподаватель на (group, course, subject)
- ``m2m_changed`` на ``StudentGroups.students`` — студент добавлен/удалён
- ``m2m_changed`` на ``StudentGroups.courses`` — группе привязали/отвязали курс
"""
from django.contrib.auth import get_user_model
from django.db.models.functions import Lower, Trim
from django.db.models.signals import m2m_changed, post_delete, post_save, pre_delete
from django.dispatch import receiver

from groups.models import (
    CourseGroupAttachment,
    StudentGroups,
    StudentGroupThrough,
    TeacherAttachment,
)
from shared_modules.enums import AccountType

from .models import ChatParticipant, ChatRoom
from .services import (
    ensure_admin_teacher_chat,
    run_on_commit,
    sync_chats_for_group_course,
    sync_chats_for_group_student,
    sync_chats_for_teacher_attachment,
)

def _delete_teacher_private_rooms(teacher_id):
    if not teacher_id:
        return
    room_ids = list(
        ChatParticipant.objects.filter(
            user_id=teacher_id,
            role=ChatParticipant.ParticipantRole.TEACHER,
            room__room_type=ChatRoom.RoomType.PRIVATE,
        ).values_list("room_id", flat=True)
    )
    if room_ids:
        ChatRoom.objects.filter(id__in=room_ids).delete()

def _delete_student_private_rooms(student_id):
    if not student_id:
        return
    room_ids = list(
        ChatParticipant.objects.filter(
            user_id=student_id,
            role=ChatParticipant.ParticipantRole.STUDENT,
            room__room_type=ChatRoom.RoomType.PRIVATE,
        ).values_list("room_id", flat=True)
    )
    if room_ids:
        ChatRoom.objects.filter(id__in=room_ids).delete()


@receiver(post_save, sender=get_user_model())
def on_user_created(sender, instance, created, **kwargs):
    if created and getattr(instance, "account_type", None) == AccountType.TEACHER:
        run_on_commit(ensure_admin_teacher_chat, instance)

@receiver(post_save, sender=get_user_model())
def on_teacher_deactivated(sender, instance, created, **kwargs):
    if created:
        return
    if getattr(instance, "account_type", None) != AccountType.TEACHER:
        return
    if getattr(instance, "is_active", True):
        return
    _delete_teacher_private_rooms(getattr(instance, "id", None))


@receiver(pre_delete, sender=get_user_model())
def on_teacher_delete(sender, instance, **kwargs):
    if getattr(instance, "account_type", None) != AccountType.TEACHER:
        return
    _delete_teacher_private_rooms(getattr(instance, "id", None))

@receiver(pre_delete, sender=get_user_model())
def on_student_delete(sender, instance, **kwargs):
    if getattr(instance, "account_type", None) != AccountType.STUDENT:
        return
    _delete_student_private_rooms(getattr(instance, "id", None))


@receiver(post_save, sender=TeacherAttachment)
def on_teacher_attachment_save(sender, instance, **kwargs):
    run_on_commit(sync_chats_for_teacher_attachment, instance)


@receiver(post_delete, sender=TeacherAttachment)
def on_teacher_attachment_delete(sender, instance, **kwargs):
    teacher_id = instance.teacher_id
    try:
        group = instance.group_assignment.group
    except CourseGroupAttachment.DoesNotExist:
        group = None
    subject = instance.subject
    title = str(getattr(subject, "title", "") or "").strip()
    title_key = title.lower()
    course_id = getattr(getattr(subject, "semester", None), "course_id", None)

    def _cleanup():
        group_room = (
            ChatRoom.objects.filter(
                room_type=ChatRoom.RoomType.GROUP,
                student_group=group,
                course_id=course_id,
            )
            .annotate(_subject_title_key=Lower(Trim("subject__title")))
            .filter(_subject_title_key=title_key)
            .order_by("id")
            .first()
        )
        any_assigned = TeacherAttachment.objects.filter(
            group_assignment__group=group,
            group_assignment__course_id=course_id,
        ).annotate(_subject_title_key=Lower(Trim("subject__title"))).filter(_subject_title_key=title_key).exists()
        if group_room:
            still_assigned = TeacherAttachment.objects.filter(
                group_assignment__group=group,
                group_assignment__course_id=course_id,
                teacher_id=teacher_id,
            ).annotate(_subject_title_key=Lower(Trim("subject__title"))).filter(_subject_title_key=title_key).exists()
            if not still_assigned:
                ChatParticipant.objects.filter(room=group_room, user_id=teacher_id).update(is_active=False)
        else:
            still_assigned = TeacherAttachment.objects.filter(
                group_assignment__group=group,
                group_assignment__course_id=course_id,
                teacher_id=teacher_id,
            ).annotate(_subject_title_key=Lower(Trim("subject__title"))).filter(_subject_title_key=title_key).exists()

        if group_room and not any_assigned:
            ChatRoom.objects.filter(id=group_room.id).delete()
            return

        if still_assigned:
            return

        student_ids = list(StudentGroupThrough.objects.filter(group=group).values_list("student_id", flat=True))
        if not student_ids:
            return

        any_teacher_assigned_in_group = TeacherAttachment.objects.filter(
            group_assignment__group=group,
            teacher_id=teacher_id,
        ).exists()
        if any_teacher_assigned_in_group:
            return

        teacher_room_ids = set(
            ChatParticipant.objects.filter(
                room__room_type=ChatRoom.RoomType.PRIVATE,
                room__subject__isnull=True,
                role=ChatParticipant.ParticipantRole.TEACHER,
                user_id=teacher_id,
            ).values_list("room_id", flat=True)
        )
        if not teacher_room_ids:
            return

        student_room_ids = set(
            ChatParticipant.objects.filter(
                room__room_type=ChatRoom.RoomType.PRIVATE,
                room__subject__isnull=True,
                role=ChatParticipant.ParticipantRole.STUDENT,
                user_id__in=student_ids,
            ).values_list("room_id", flat=True)
        )
        target_ids = list(teacher_room_ids.intersection(student_room_ids))
        if target_ids:
            ChatRoom.objects.filter(id__in=target_ids).delete()

    if group is not None and subject is not None and course_id is not None and title_key:
        run_on_commit(_cleanup)


@receiver(m2m_changed, sender=StudentGroupThrough)
def on_student_group_students_changed(sender, instance, action, reverse, pk_set, **kwargs):
    """M2M StudentGroups.students (через StudentGroupThrough)."""
    if action not in ("post_add", "post_remove", "post_clear"):
        return
    if reverse:
        return
    group = instance
    student_ids = list(pk_set or [])

    if action == "post_add":
        def _add():
            for sid in student_ids:
                sync_chats_for_group_student(group, sid)
        run_on_commit(_add)
    elif action in ("post_remove", "post_clear"):
        def _remove():
            ChatParticipant.objects.filter(
                room__room_type=ChatRoom.RoomType.GROUP,
                room__student_group=group,
                user_id__in=student_ids,
            ).update(is_active=False)
            ChatParticipant.objects.filter(
                room__room_type=ChatRoom.RoomType.PRIVATE,
                room__subject__semester__course__bind_groups=group,
                user_id__in=student_ids,
            ).update(is_active=False)
        run_on_commit(_remove)


@receiver(post_save, sender=StudentGroupThrough)
def on_student_group_through_save(sender, instance, created, **kwargs):
    """Напрямую добавили StudentGroupThrough (не через M2M .add())."""
    if not created:
        return
    run_on_commit(sync_chats_for_group_student, instance.group, instance.student_id)


@receiver(post_delete, sender=StudentGroupThrough)
def on_student_group_through_delete(sender, instance, **kwargs):
    group_id = instance.group_id
    student_id = instance.student_id

    def _deactivate():
        ChatParticipant.objects.filter(
            room__room_type=ChatRoom.RoomType.GROUP,
            room__student_group_id=group_id,
            user_id=student_id,
        ).update(is_active=False)
        ChatParticipant.objects.filter(
            room__room_type=ChatRoom.RoomType.PRIVATE,
            room__subject__semester__course__bind_groups__id=group_id,
            user_id=student_id,
        ).update(is_active=False)

    run_on_commit(_deactivate)


@receiver(post_save, sender=CourseGroupAttachment)
def on_course_group_attachment_save(sender, instance, created, **kwargs):
    if not created:
        return
    run_on_commit(sync_chats_for_group_course, instance.group, instance.course)


@receiver(post_delete, sender=CourseGroupAttachment)
def on_course_group_attachment_delete(sender, instance, **kwargs):
    group_id = instance.group_id
    course_id = instance.course_id

    def _deactivate():
        ChatRoom.objects.filter(
            room_type=ChatRoom.RoomType.GROUP,
            student_group_id=group_id,
            course_id=course_id,
        ).update(is_active=False)

    run_on_commit(_deactivate)


@receiver(m2m_changed, sender=CourseGroupAttachment)
def on_student_group_courses_changed(sender, instance, action, reverse, pk_set, **kwargs):
    """M2M StudentGroups.courses (через CourseGroupAttachment)."""
    if action not in ("post_add", "post_remove"):
        return
    if reverse:
        return
    if not isinstance(instance, StudentGroups):
        return
    from courses.models import Course

    group = instance
    course_ids = list(pk_set or [])
    if action == "post_add":
        def _add():
            for course in Course.objects.filter(id__in=course_ids):
                sync_chats_for_group_course(group, course)
        run_on_commit(_add)
    else:
        def _remove():
            ChatRoom.objects.filter(
                room_type=ChatRoom.RoomType.GROUP,
                student_group=group,
                course_id__in=course_ids,
            ).update(is_active=False)
        run_on_commit(_remove)
