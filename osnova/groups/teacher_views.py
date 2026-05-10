from django.http import FileResponse, Http404
from django.shortcuts import get_object_or_404
from django.db.models import Count
from django.core.exceptions import ValidationError
from urllib.parse import quote
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from shared_modules.enums import AccountType
from users.models import User
from courses.models import Assignment, AssignmentSubmission, AssignmentSubmissionFile, Course, Grade, Semester, Subject
from .models import StudentGroups, StudentGroupThrough, TeacherAttachment, SemesterSchedule


def _ensure_teacher(request):
    if not request.user or not request.user.is_authenticated:
        raise Http404
    if getattr(request.user, "account_type", None) != AccountType.TEACHER:
        raise Http404


def _teacher_subject_ids_for_group(teacher_id, group_id):
    return list(
        TeacherAttachment.objects.filter(
            teacher_id=teacher_id,
            group_assignment__group_id=group_id,
        ).values_list("subject_id", flat=True).distinct()
    )


def _ensure_teacher_can_access_assignment(teacher_id, group_id, assignment):
    subject_ids = _teacher_subject_ids_for_group(teacher_id, group_id)
    if assignment.subject_id not in subject_ids:
        raise Http404


def _teacher_can_access_group_course(teacher_id, group_id, course_id):
    return TeacherAttachment.objects.filter(
        teacher_id=teacher_id,
        group_assignment__group_id=group_id,
        group_assignment__course_id=course_id,
    ).exists()


def _teacher_map_for_subject_ids(group_id, course_id, subject_ids):
    attachments = TeacherAttachment.objects.filter(
        group_assignment__group_id=group_id,
        group_assignment__course_id=course_id,
        subject_id__in=subject_ids,
    ).select_related("teacher").order_by("id")
    teacher_by_subject = {}
    for att in attachments:
        if att.subject_id not in teacher_by_subject:
            t = att.teacher
            teacher_by_subject[att.subject_id] = {
                "id": t.id,
                "display_name": getattr(t, "display_name", None) or t.email,
            }
    return teacher_by_subject


def _build_semester_schedule_payload(group, course_id, semester, schedule):
    subjects = list(Subject.objects.filter(semester=semester).order_by("order", "id"))
    subject_ids = [s.id for s in subjects]
    teacher_by_subject = _teacher_map_for_subject_ids(group.id, course_id, subject_ids)

    entries = []
    if schedule:
        for e in schedule.entries.select_related("subject", "teacher").all():
            fallback_teacher = None if not e.subject_id else teacher_by_subject.get(e.subject_id)
            entries.append({
                "weekday": int(e.weekday),
                "lesson": int(e.lesson),
                "subject": None if not e.subject_id else {
                    "id": e.subject_id,
                    "title": e.subject.title,
                },
                "teacher": (
                    None
                    if not e.subject_id
                    else (
                        {
                            "id": e.teacher_id,
                            "display_name": getattr(e.teacher, "display_name", None) or e.teacher.email,
                        }
                        if getattr(e, "teacher_id", None)
                        else fallback_teacher
                    )
                ),
            })

    return {
        "group": {"id": group.id, "name": group.name},
        "course_id": int(course_id),
        "semester": {"id": semester.id, "title": semester.title},
        "config": None if not schedule else {
            "start_time": schedule.start_time.strftime("%H:%M"),
            "lessons_per_day": int(schedule.lessons_per_day),
            "lesson_duration_minutes": int(schedule.lesson_duration_minutes),
            "break_minutes": int(schedule.break_minutes),
            "breaks_minutes": (schedule.breaks_minutes or []),
        },
        "entries": entries,
    }


class TeacherMyGroupsAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        _ensure_teacher(request)
        group_ids = TeacherAttachment.objects.filter(teacher=request.user).values_list(
            "group_assignment__group_id", flat=True
        ).distinct()

        students_count = StudentGroupThrough.objects.filter(group_id__in=group_ids).values("group_id").annotate(cnt=Count("id"))
        count_map = {row["group_id"]: row["cnt"] for row in students_count}

        groups = StudentGroups.objects.filter(id__in=group_ids).order_by("name", "id")
        payload = []
        for g in groups:
            payload.append({
                "id": g.id,
                "name": g.name,
                "studentsCount": int(count_map.get(g.id, 0)),
            })
        return Response(payload)


class TeacherGroupAssignmentsAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, group_id):
        _ensure_teacher(request)
        group = get_object_or_404(StudentGroups, pk=group_id)
        subject_ids = _teacher_subject_ids_for_group(request.user.id, group.id)
        if not subject_ids:
            raise Http404

        semester_id = request.query_params.get("semester_id", None)
        assignments_qs = Assignment.objects.filter(subject_id__in=subject_ids).select_related(
            "subject",
            "subject__semester",
            "subject__semester__course",
        )
        if semester_id is not None and str(semester_id).strip() != "":
            try:
                semester_id_int = int(semester_id)
            except (TypeError, ValueError):
                return Response({"detail": "Некорректный идентификатор семестра."}, status=400)
            assignments_qs = assignments_qs.filter(subject__semester_id=semester_id_int)

        assignments = assignments_qs.order_by("-created_at", "-id")

        return Response({
            "group": {"id": group.id, "name": group.name},
            "assignments": [
                {
                    "id": a.id,
                    "title": a.title,
                    "created_at": a.created_at,
                    "subject": {
                        "id": a.subject_id,
                        "title": a.subject.title,
                        "course": None if not getattr(a.subject, "semester_id", None) else {
                            "id": a.subject.semester.course_id,
                            "title": a.subject.semester.course.title,
                        },
                        "semester": None if not getattr(a.subject, "semester_id", None) else {
                            "id": a.subject.semester_id,
                            "title": a.subject.semester.title,
                        },
                    },
                    "max_grade": a.max_grade,
                }
                for a in assignments
            ]
        })


class TeacherAssignmentDetailAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, group_id, assignment_id):
        _ensure_teacher(request)
        group = get_object_or_404(StudentGroups, pk=group_id)
        assignment = get_object_or_404(
            Assignment.objects.select_related("subject"),
            pk=assignment_id,
        )
        _ensure_teacher_can_access_assignment(request.user.id, group.id, assignment)

        students = User.objects.filter(
            membership__group_id=group.id,
            account_type=AccountType.STUDENT,
        ).order_by("last_name", "first_name", "id")

        submissions = AssignmentSubmission.objects.filter(
            assignment_id=assignment.id,
            student__in=students,
        ).prefetch_related("files")
        sub_map = {s.student_id: s for s in submissions}

        grades = Grade.objects.filter(
            assignment_id=assignment.id,
            student__in=students,
        )
        grade_map = {g.student_id: g for g in grades}

        students_payload = []
        for st in students:
            sub = sub_map.get(st.id)
            gr = grade_map.get(st.id)
            students_payload.append({
                "id": st.id,
                "display_name": getattr(st, "display_name", None) or st.email,
                "email": st.email,
                "submitted_at": getattr(sub, "submitted_at", None),
                "files_count": 0 if not sub else sub.files.count(),
                "grade": None if not gr else {
                    "value": gr.value,
                    "comment": gr.comment,
                    "updated_at": gr.updated_at,
                }
            })

        return Response({
            "group": {"id": group.id, "name": group.name},
            "assignment": {
                "id": assignment.id,
                "title": assignment.title,
                "description": assignment.description,
                "created_at": assignment.created_at,
                "max_grade": assignment.max_grade,
                "subject": {"id": assignment.subject_id, "title": assignment.subject.title},
            },
            "students": students_payload,
        })


class TeacherAssignmentStudentWorkAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, group_id, assignment_id, student_id):
        _ensure_teacher(request)
        group = get_object_or_404(StudentGroups, pk=group_id)
        assignment = get_object_or_404(
            Assignment.objects.select_related("subject"),
            pk=assignment_id,
        )
        _ensure_teacher_can_access_assignment(request.user.id, group.id, assignment)

        student = get_object_or_404(
            User,
            pk=student_id,
            account_type=AccountType.STUDENT,
            membership__group_id=group.id,
        )

        submission = AssignmentSubmission.objects.filter(
            assignment_id=assignment.id,
            student_id=student.id,
        ).prefetch_related("files").first()

        grade = Grade.objects.filter(
            assignment_id=assignment.id,
            student_id=student.id,
        ).first()

        files = []
        if submission:
            for f in submission.files.all():
                files.append({
                    "id": f.id,
                    "name": f.name,
                    "created_at": f.created_at,
                    "download_url": f"/api/groups/teacher/groups/{group.id}/assignments/{assignment.id}/students/{student.id}/files/{f.id}/",
                })

        return Response({
            "student": {
                "id": student.id,
                "display_name": getattr(student, "display_name", None) or student.email,
                "email": student.email,
            },
            "submission": None if not submission else {
                "submitted_at": submission.submitted_at,
                "updated_at": submission.updated_at,
                "files": files,
            },
            "grade": None if not grade else {
                "value": grade.value,
                "comment": grade.comment,
                "updated_at": grade.updated_at,
            }
        })


class TeacherAssignmentStudentFileDownloadAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, group_id, assignment_id, student_id, file_id):
        _ensure_teacher(request)
        group = get_object_or_404(StudentGroups, pk=group_id)
        assignment = get_object_or_404(
            Assignment.objects.select_related("subject"),
            pk=assignment_id,
        )
        _ensure_teacher_can_access_assignment(request.user.id, group.id, assignment)

        file_obj = get_object_or_404(
            AssignmentSubmissionFile.objects.select_related("submission"),
            pk=file_id,
        )
        if file_obj.submission.assignment_id != assignment.id or file_obj.submission.student_id != int(student_id):
            raise Http404

        res = FileResponse(file_obj.file.open("rb"), content_type="application/octet-stream")
        filename = file_obj.name or f"file-{file_obj.id}"
        safe_filename = filename.replace('"', "")
        res["Content-Disposition"] = f'attachment; filename="{safe_filename}"; filename*=UTF-8\'\'{quote(filename)}'
        return res


class TeacherAssignmentStudentGradeAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def put(self, request, group_id, assignment_id, student_id):
        _ensure_teacher(request)
        group = get_object_or_404(StudentGroups, pk=group_id)
        assignment = get_object_or_404(
            Assignment.objects.select_related("subject"),
            pk=assignment_id,
        )
        _ensure_teacher_can_access_assignment(request.user.id, group.id, assignment)

        student = get_object_or_404(
            User,
            pk=student_id,
            account_type=AccountType.STUDENT,
            membership__group_id=group.id,
        )

        value = request.data.get("value", None)
        try:
            value = int(value)
        except (TypeError, ValueError):
            return Response({"detail": "Некорректная оценка."}, status=400)

        comment = request.data.get("comment", "")
        if comment is None:
            comment = ""
        comment = str(comment)

        grade, _ = Grade.objects.get_or_create(
            assignment=assignment,
            student=student,
            defaults={"value": 0, "comment": "", "graded_by": request.user},
        )
        grade.value = value
        grade.comment = comment
        grade.graded_by = request.user
        try:
            grade.full_clean()
        except ValidationError as e:
            return Response(e.message_dict, status=400)
        grade.save()

        return Response({
            "value": grade.value,
            "comment": grade.comment,
            "updated_at": grade.updated_at,
        })


class TeacherGroupSemestersAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, group_id):
        _ensure_teacher(request)
        group = get_object_or_404(StudentGroups, pk=group_id)

        course_ids = list(
            TeacherAttachment.objects.filter(
                teacher_id=request.user.id,
                group_assignment__group_id=group.id,
            ).values_list("group_assignment__course_id", flat=True).distinct()
        )
        if not course_ids:
            subject_ids = _teacher_subject_ids_for_group(request.user.id, group.id)
            course_ids = list(
                Subject.objects.filter(id__in=subject_ids).values_list("semester__course_id", flat=True).distinct()
            )
        if not course_ids:
            raise Http404

        semesters = Semester.objects.filter(course_id__in=course_ids).order_by("course_id", "order", "id")
        semesters_by_course = {}
        for s in semesters:
            semesters_by_course.setdefault(s.course_id, []).append({"id": s.id, "title": s.title})

        courses = Course.objects.filter(id__in=course_ids).order_by("order", "id")
        payload = []
        for c in courses:
            payload.append({
                "course": {"id": c.id, "title": c.title},
                "semesters": semesters_by_course.get(c.id, []),
            })
        return Response(payload)


class TeacherGroupSemesterScheduleAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, group_id, course_id, semester_id):
        _ensure_teacher(request)
        group = get_object_or_404(StudentGroups, pk=group_id)
        if not _teacher_can_access_group_course(request.user.id, group.id, int(course_id)):
            raise Http404

        semester = get_object_or_404(Semester.objects.select_related("course"), pk=semester_id, course_id=course_id)
        schedule = SemesterSchedule.objects.filter(group=group, semester=semester).prefetch_related(
            "entries__subject",
            "entries__teacher",
        ).first()
        return Response(_build_semester_schedule_payload(group, int(course_id), semester, schedule))
