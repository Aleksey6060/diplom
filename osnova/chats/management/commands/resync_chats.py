from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand

from shared_modules.enums import AccountType

from chats.services import (
    ensure_admin_teacher_chat,
    sync_chats_for_group_course,
    sync_chats_for_group_student,
    sync_chats_for_teacher_attachment,
)


User = get_user_model()


class Command(BaseCommand):
    help = "Resync chats for current teachers and teacher<->subject attachments (group + private), including admin<->teacher."

    def add_arguments(self, parser):
        parser.add_argument("--university-id", type=int, default=None)

    def handle(self, *args, **options):
        university_id = options.get("university_id")
        from groups.models import CourseGroupAttachment, StudentGroupThrough, TeacherAttachment
        from universities.models import University

        universities = University.objects.all()
        if university_id:
            universities = universities.filter(id=university_id)

        total_admin_teacher = 0
        total_teacher_attachments = 0
        total_students = 0
        total_courses = 0

        def _sync_scope(university):
            nonlocal total_admin_teacher, total_teacher_attachments, total_students, total_courses

            teachers = User.objects.filter(
                university=university,
                account_type=AccountType.TEACHER,
                is_active=True,
            )
            for t in teachers.iterator():
                ensure_admin_teacher_chat(t)
                total_admin_teacher += 1

            attachments = TeacherAttachment.objects.filter(
                group_assignment__group__university=university,
            ).select_related(
                "subject__semester__course",
                "group_assignment__group",
            )
            for att in attachments.iterator():
                sync_chats_for_teacher_attachment(att)
                total_teacher_attachments += 1

            student_links = StudentGroupThrough.objects.filter(
                group__university=university,
            ).select_related("group")
            for rel in student_links.iterator():
                sync_chats_for_group_student(rel.group, rel.student_id)
                total_students += 1

            course_links = CourseGroupAttachment.objects.filter(
                group__university=university,
            ).select_related("group", "course")
            for link in course_links.iterator():
                sync_chats_for_group_course(link.group, link.course)
                total_courses += 1

        if not university_id:
            _sync_scope(None)
        for uni in universities.iterator():
            _sync_scope(uni)

        self.stdout.write(
            self.style.SUCCESS(
                f"OK: admin<->teacher={total_admin_teacher}, teacher_attachments={total_teacher_attachments}, "
                f"group_students={total_students}, group_courses={total_courses}"
            )
        )
