"""Сервисный слой чатов: автоматическое создание комнат и синхронизация участников.

Работает поверх реальных моделей распределения из приложения ``groups``:
- :class:`groups.StudentGroups` — группа студентов внутри ВУЗа
- :class:`groups.StudentGroupThrough` — связь студент↔группа
- :class:`groups.CourseGroupAttachment` — привязка группы к курсу
- :class:`groups.TeacherAttachment` — назначение преподавателя на предмет курса внутри группы
"""
from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models.functions import Lower, Trim

from .models import ChatParticipant, ChatRoom
from shared_modules.enums import AccountType


User = get_user_model()


def _student_ids_in_group(group):
    from groups.models import StudentGroupThrough
    return list(
        StudentGroupThrough.objects.filter(group=group).values_list("student_id", flat=True)
    )


def _normalize_subject_title(title):
    return str(title or "").strip()


def _canonical_subject_for_chat(subject):
    if subject is None:
        return None
    title = _normalize_subject_title(getattr(subject, "title", ""))
    if not title:
        return subject
    semester = getattr(subject, "semester", None)
    course_id = getattr(semester, "course_id", None)
    if not course_id:
        return subject

    from courses.models import Subject as SubjectModel

    canonical = (
        SubjectModel.objects.filter(semester__course_id=course_id)
        .annotate(_title_key=Lower(Trim("title")))
        .filter(_title_key=title.lower())
        .order_by("id")
        .first()
    )
    return canonical or subject


def _teacher_ids_for_group_subject_title(group, course_id, subject_title):
    """ID преподавателей, назначенных на (group, course, subject_title) через TeacherAttachment."""
    from groups.models import TeacherAttachment
    title = _normalize_subject_title(subject_title)
    if not title:
        return []
    return list(
        TeacherAttachment.objects.filter(
            group_assignment__group=group,
            group_assignment__course_id=course_id,
        )
        .annotate(_title_key=Lower(Trim("subject__title")))
        .filter(_title_key=title.lower())
        .values_list("teacher_id", flat=True)
    )


def ensure_group_chat(group, subject):
    """Создать или синхронизировать групповой чат (group, subject).

    Участники — все студенты группы + все преподаватели, назначенные на этот предмет в этом курсе в этой группе.
    """
    if group is None or subject is None:
        return None

    subject = _canonical_subject_for_chat(subject)
    course = subject.semester.course
    university_id = getattr(course, "university_id", None)
    title = _normalize_subject_title(subject.title)
    title_key = title.lower()

    room_qs = ChatRoom.objects.filter(
        room_type=ChatRoom.RoomType.GROUP,
        student_group=group,
        course=course,
    ).annotate(_title_key=Lower(Trim("subject__title"))).filter(_title_key=title_key)
    room = room_qs.filter(subject=subject).order_by("id").first() or room_qs.order_by("id").first()

    if room is None:
        room = ChatRoom.objects.create(
            university_id=university_id,
            room_type=ChatRoom.RoomType.GROUP,
            course=course,
            student_group=group,
            subject=subject,
            title=f"{title} — {group.name}",
            is_active=True,
        )
    else:
        updates = []
        if room.subject_id != subject.id:
            room.subject = subject
            updates.append("subject")
        if room.course_id != course.id:
            room.course = course
            updates.append("course")
        if room.university_id != university_id:
            room.university_id = university_id
            updates.append("university")
        next_title = f"{title} — {group.name}"
        if next_title and room.title != next_title:
            room.title = next_title
            updates.append("title")
        if not room.is_active:
            room.is_active = True
            updates.append("is_active")
        if updates:
            room.save(update_fields=updates)

    dup_ids = list(room_qs.exclude(id=room.id).values_list("id", flat=True))
    if dup_ids:
        ChatRoom.objects.filter(id__in=dup_ids).update(is_active=False)

    teacher_ids = set(_teacher_ids_for_group_subject_title(group, course.id, title))
    student_ids = set(_student_ids_in_group(group))

    for teacher_id in teacher_ids:
        ChatParticipant.objects.update_or_create(
            room=room,
            user_id=teacher_id,
            defaults={
                "role": ChatParticipant.ParticipantRole.TEACHER,
                "is_active": True,
            },
        )
    for student_id in student_ids:
        if student_id in teacher_ids:
            continue
        ChatParticipant.objects.update_or_create(
            room=room,
            user_id=student_id,
            defaults={
                "role": ChatParticipant.ParticipantRole.STUDENT,
                "is_active": True,
            },
        )

    return room


def ensure_private_chat(teacher_id, student_id, subject):
    """Личный чат (преподаватель ↔ студент) по конкретному предмету."""
    if not teacher_id or not student_id or subject is None:
        return None
    if teacher_id == student_id:
        return None

    subject = _canonical_subject_for_chat(subject)
    title = _normalize_subject_title(subject.title)
    title_key = title.lower()
    course_id = subject.semester.course_id

    room_qs = (
        ChatRoom.objects.filter(
            room_type=ChatRoom.RoomType.PRIVATE,
            subject__semester__course_id=course_id,
            participants__user_id=teacher_id,
        )
        .annotate(_title_key=Lower(Trim("subject__title")))
        .filter(_title_key=title_key)
        .filter(participants__user_id=student_id)
        .distinct()
        .order_by("id")
    )
    room = room_qs.filter(subject=subject).first() or room_qs.first()
    if room:
        updates = []
        if room.subject_id != subject.id:
            room.subject = subject
            updates.append("subject")
        if not room.is_active:
            room.is_active = True
            updates.append("is_active")
        if updates:
            room.save(update_fields=updates)
        ChatParticipant.objects.filter(room=room, user_id=teacher_id).update(is_active=True)
        ChatParticipant.objects.filter(room=room, user_id=student_id).update(is_active=True)

        dup_ids = list(room_qs.exclude(id=room.id).values_list("id", flat=True))
        if dup_ids:
            ChatRoom.objects.filter(id__in=dup_ids).update(is_active=False)
        return room

    try:
        teacher = User.objects.get(id=teacher_id)
        student = User.objects.get(id=student_id)
    except User.DoesNotExist:
        return None

    course = subject.semester.course
    room = ChatRoom.objects.create(
        university_id=course.university_id,
        room_type=ChatRoom.RoomType.PRIVATE,
        subject=subject,
        title=f"{teacher.display_name} — {student.display_name}",
    )
    ChatParticipant.objects.create(
        room=room,
        user=teacher,
        role=ChatParticipant.ParticipantRole.TEACHER,
    )
    ChatParticipant.objects.create(
        room=room,
        user=student,
        role=ChatParticipant.ParticipantRole.STUDENT,
    )
    return room


def ensure_teacher_student_chat(teacher_id, student_id, university_id=None):
    """Единый личный чат (преподаватель ↔ студент) без привязки к предмету.

    Используется независимо от предметов: один чат на пару teacher+student.
    При наличии старых subject-based чатов между той же парой — переиспользует
    одну комнату, очищает subject и деактивирует дубликаты.
    """
    if not teacher_id or not student_id:
        return None
    if teacher_id == student_id:
        return None

    room_qs = (
        ChatRoom.objects.filter(
            room_type=ChatRoom.RoomType.PRIVATE,
            participants__user_id=teacher_id,
        )
        .filter(participants__user_id=student_id)
        .distinct()
        .order_by("id")
    )
    room = room_qs.filter(subject__isnull=True).first() or room_qs.first()
    if room:
        updates = []
        if room.subject_id is not None:
            room.subject = None
            updates.append("subject")
        if university_id is not None and room.university_id != university_id:
            room.university_id = university_id
            updates.append("university")
        if not room.is_active:
            room.is_active = True
            updates.append("is_active")

        try:
            teacher = User.objects.get(id=teacher_id)
            student = User.objects.get(id=student_id)
            next_title = f"{teacher.display_name} — {student.display_name}"
        except User.DoesNotExist:
            teacher = None
            student = None
            next_title = ""
        if next_title and room.title != next_title:
            room.title = next_title
            updates.append("title")

        if updates:
            room.save(update_fields=updates)

        ChatParticipant.objects.update_or_create(
            room=room,
            user_id=teacher_id,
            defaults={
                "role": ChatParticipant.ParticipantRole.TEACHER,
                "is_active": True,
            },
        )
        ChatParticipant.objects.update_or_create(
            room=room,
            user_id=student_id,
            defaults={
                "role": ChatParticipant.ParticipantRole.STUDENT,
                "is_active": True,
            },
        )

        dup_ids = list(room_qs.exclude(id=room.id).values_list("id", flat=True))
        if dup_ids:
            ChatRoom.objects.filter(id__in=dup_ids).update(is_active=False)
        return room

    try:
        teacher = User.objects.get(id=teacher_id)
        student = User.objects.get(id=student_id)
    except User.DoesNotExist:
        return None

    room = ChatRoom.objects.create(
        university_id=university_id,
        room_type=ChatRoom.RoomType.PRIVATE,
        subject=None,
        title=f"{teacher.display_name} — {student.display_name}",
        is_active=True,
    )
    ChatParticipant.objects.create(room=room, user=teacher, role=ChatParticipant.ParticipantRole.TEACHER)
    ChatParticipant.objects.create(room=room, user=student, role=ChatParticipant.ParticipantRole.STUDENT)
    return room


def sync_chats_for_teacher_attachment(attachment):
    """Назначение преподавателя на (group, course, subject).

    Создаём/обновляем групповой чат (group, subject) и личные чаты между этим
    преподавателем и каждым студентом группы.
    """
    group = attachment.group_assignment.group
    subject = attachment.subject
    ensure_group_chat(group, subject)
    course = subject.semester.course
    for student_id in _student_ids_in_group(group):
        ensure_teacher_student_chat(
            attachment.teacher_id,
            student_id,
            university_id=getattr(course, "university_id", None),
        )


def sync_chats_for_group_student(group, student_id):
    """Студент добавлен в группу — добавляем его во все актуальные чаты."""
    from groups.models import CourseGroupAttachment, TeacherAttachment
    from courses.models import Subject

    course_ids = list(
        CourseGroupAttachment.objects.filter(group=group).values_list("course_id", flat=True)
    )
    if not course_ids:
        return

    subjects = list(Subject.objects.filter(semester__course_id__in=course_ids).select_related("semester"))
    for subject in subjects:
        ensure_group_chat(group, subject)
    teacher_links = TeacherAttachment.objects.filter(
        group_assignment__group=group,
        group_assignment__course_id__in=course_ids,
    ).select_related("subject__semester__course")
    for link in teacher_links:
        ensure_private_chat(link.teacher_id, student_id, link.subject)


def sync_chats_for_group_course(group, course):
    """Группе привязали курс — создаём чаты по всем уже назначенным преподавателям."""
    from groups.models import TeacherAttachment

    attachments = TeacherAttachment.objects.filter(
        group_assignment__group=group,
        group_assignment__course=course,
    ).select_related("subject__semester__course")
    for att in attachments:
        sync_chats_for_teacher_attachment(att)


def sync_chats_for_group(group):
    """Полная ресинхронизация всех чатов группы (используется после массовых операций)."""
    from groups.models import CourseGroupAttachment

    for attachment in CourseGroupAttachment.objects.filter(group=group).select_related("course"):
        sync_chats_for_group_course(group, attachment.course)


def ensure_chats_for_teacher(teacher):
    if teacher is None or not getattr(teacher, "id", None):
        return
    if getattr(teacher, "account_type", None) != AccountType.TEACHER:
        return
    from groups.models import TeacherAttachment

    attachments = TeacherAttachment.objects.filter(teacher=teacher).select_related(
        "subject__semester__course",
        "group_assignment__group",
    )
    for att in attachments:
        sync_chats_for_teacher_attachment(att)


def _resolve_admin_for_teacher_chat(teacher, explicit_admin=None):
    if explicit_admin is not None:
        return explicit_admin
    creator = getattr(teacher, "created_by", None)
    if creator is not None and getattr(creator, "account_type", None) in (
        AccountType.OWNER,
        AccountType.UNIVERSITY_OWNER,
        AccountType.EMPLOYEE,
    ):
        return creator
    if not getattr(teacher, "university_id", None):
        owner = (
            User.objects.filter(account_type=AccountType.OWNER, is_active=True)
            .order_by("id")
            .first()
        )
        if owner is not None:
            return owner
        superuser = User.objects.filter(is_superuser=True, is_active=True).order_by("id").first()
        return superuser
    try:
        from universities.models import University
        university = University.objects.select_related("owner").get(pk=teacher.university_id)
        return university.owner
    except Exception:
        return None


def ensure_admin_teacher_chat(teacher, admin=None):
    """Создать PRIVATE-чат между учителем и администратором вуза при создании учителя."""
    admin = _resolve_admin_for_teacher_chat(teacher, explicit_admin=admin)
    if admin is None:
        return None
    if admin.id == teacher.id:
        return None

    existing = ChatRoom.objects.filter(
        room_type=ChatRoom.RoomType.PRIVATE,
        subject__isnull=True,
        participants__user_id=teacher.id,
        participants__role=ChatParticipant.ParticipantRole.TEACHER,
    ).first()
    if existing:
        room = existing
    else:
        room = ChatRoom.objects.create(
            university_id=teacher.university_id,
            room_type=ChatRoom.RoomType.PRIVATE,
            title=f"{admin.display_name} — {teacher.display_name}",
            is_active=True,
        )
        ChatParticipant.objects.create(room=room, user=teacher, role=ChatParticipant.ParticipantRole.TEACHER)

    ChatParticipant.objects.update_or_create(
        room=room,
        user=admin,
        defaults={
            "role": ChatParticipant.ParticipantRole.ADMIN,
            "is_active": True,
        },
    )

    admins_qs = User.objects.filter(is_active=True).filter(
        account_type__in=(
            AccountType.OWNER,
            AccountType.UNIVERSITY_OWNER,
            AccountType.EMPLOYEE,
        )
    )
    if teacher.university_id is None:
        admins_qs = admins_qs.filter(university__isnull=True)
    else:
        admins_qs = admins_qs.filter(university_id=teacher.university_id)

    for admin_user in admins_qs.iterator():
        if admin_user.id == teacher.id:
            continue
        ChatParticipant.objects.update_or_create(
            room=room,
            user=admin_user,
            defaults={
                "role": ChatParticipant.ParticipantRole.ADMIN,
                "is_active": True,
            },
        )

    return room


def ensure_admin_teacher_chats_for_university(university):
    """Проверить и создать недостающие private-чаты admin↔teacher в рамках вуза."""
    if university is None:
        return
    teachers = User.objects.filter(
        university=university,
        account_type=AccountType.TEACHER,
        is_active=True,
    ).only("id", "university_id", "created_by_id", "first_name", "last_name", "middle_name", "email")
    for teacher in teachers:
        ensure_admin_teacher_chat(teacher)


def run_on_commit(fn, *args, **kwargs):
    """Исполнить fn(*args, **kwargs) после коммита транзакции (или сразу, если нет транзакции)."""
    transaction.on_commit(lambda: fn(*args, **kwargs))
