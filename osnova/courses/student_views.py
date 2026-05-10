from django.shortcuts import get_object_or_404
from django.http import FileResponse, Http404
from django.utils import timezone
from urllib.parse import quote
from django.db.models import Q
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from shared_modules.enums import AccountType
from groups.models import SemesterSchedule, TeacherAttachment

from .models import Assignment, AssignmentSubmission, AssignmentSubmissionFile, Grade, Semester, Subject, Topic, Course, TestAttempt, TestMaterial
from .serializers import CourseListSerializer
from .views import get_available_courses_queryset


class StudentMyCoursesAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        courses = get_available_courses_queryset(request.user, university=getattr(request, "university", None)).order_by("order", "id")
        return Response(CourseListSerializer(courses, many=True, context={"request": request}).data)


class StudentSubjectAssignmentsAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, subject_id):
        subject = get_object_or_404(
            Subject.objects.select_related("semester", "semester__course"),
            pk=subject_id,
        )
        available = get_available_courses_queryset(request.user, university=getattr(request, "university", None))
        if not available.filter(pk=subject.semester.course_id).exists():
            return Response({"detail": "Недостаточно прав."}, status=403)

        assignments = list(subject.assignments.filter(test_source__isnull=True).order_by("position", "id"))
        submissions = AssignmentSubmission.objects.filter(
            student=request.user,
            assignment__in=assignments,
        ).prefetch_related("files")
        submission_map = {s.assignment_id: s for s in submissions}
        grades = Grade.objects.filter(
            student=request.user,
            assignment__in=assignments,
        )
        grade_map = {g.assignment_id: g for g in grades}

        payload = []
        for a in assignments:
            sub = submission_map.get(a.id)
            gr = grade_map.get(a.id)
            payload.append({
                "id": a.id,
                "subject": a.subject_id,
                "title": a.title,
                "description": a.description,
                "max_grade": a.max_grade,
                "position": a.position,
                "submission": None if not sub else {
                    "submitted_at": sub.submitted_at,
                    "updated_at": sub.updated_at,
                    "files_count": sub.files.count(),
                },
                "grade": None if not gr else {
                    "value": gr.value,
                    "comment": gr.comment,
                    "updated_at": gr.updated_at,
                },
            })

        return Response(payload)


class StudentMyScheduleAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if getattr(request.user, "account_type", None) == AccountType.TEACHER:
            uni = getattr(request, "university", None)
            attachments_qs = TeacherAttachment.objects.filter(teacher=request.user).select_related(
                "group_assignment__group",
                "group_assignment__course",
                "subject",
                "subject__semester",
                "subject__semester__course",
            ).order_by("id")
            if uni:
                attachments_qs = attachments_qs.filter(group_assignment__group__university=uni)

            attachments = list(attachments_qs)
            allowed_subject_ids_by_key = {}
            meta_by_key = {}
            for att in attachments:
                if not att.subject_id or not getattr(att.subject, "semester_id", None):
                    continue
                group = att.group_assignment.group
                semester = att.subject.semester
                key = (group.id, semester.id)
                allowed_subject_ids_by_key.setdefault(key, set()).add(att.subject_id)
                if key not in meta_by_key:
                    meta_by_key[key] = {
                        "group": {"id": group.id, "name": group.name},
                        "course": {"id": semester.course_id, "title": semester.course.title},
                        "semester": {"id": semester.id, "title": semester.title},
                    }

            keys = set(meta_by_key.keys())
            if not keys:
                return Response({
                    "config": {
                        "start_time": "09:00",
                        "lessons_per_day": 4,
                        "lesson_duration_minutes": 90,
                        "break_minutes": 10,
                        "breaks_minutes": [],
                    },
                    "entries": [],
                })

            group_ids = sorted({k[0] for k in keys})
            semester_ids = sorted({k[1] for k in keys})
            schedules = list(
                SemesterSchedule.objects.filter(
                    group_id__in=group_ids,
                    semester_id__in=semester_ids,
                ).select_related(
                    "group",
                    "semester",
                    "semester__course",
                ).prefetch_related(
                    "entries__subject",
                    "entries__teacher",
                )
            )

            entries = []
            lessons_per_day = 0
            lesson_duration_minutes = 0
            break_minutes = 0
            start_time = None
            for schedule in schedules:
                key = (schedule.group_id, schedule.semester_id)
                if key not in keys:
                    continue
                if start_time is None or (schedule.start_time and schedule.start_time < start_time):
                    start_time = schedule.start_time
                lessons_per_day = max(lessons_per_day, int(schedule.lessons_per_day))
                lesson_duration_minutes = max(lesson_duration_minutes, int(schedule.lesson_duration_minutes))
                break_minutes = max(break_minutes, int(schedule.break_minutes))

                allowed_subject_ids = allowed_subject_ids_by_key.get(key, set())
                meta = meta_by_key[key]
                for e in schedule.entries.select_related("subject").all():
                    if not e.subject_id or e.subject_id not in allowed_subject_ids:
                        continue
                    entries.append({
                        "weekday": int(e.weekday),
                        "lesson": int(e.lesson),
                        "group": meta["group"],
                        "course": meta["course"],
                        "semester": meta["semester"],
                        "subject": {
                            "id": e.subject_id,
                            "title": e.subject.title,
                        },
                    })

            return Response({
                "config": {
                    "start_time": (start_time.strftime("%H:%M") if start_time else "09:00"),
                    "lessons_per_day": lessons_per_day or 4,
                    "lesson_duration_minutes": lesson_duration_minutes or 90,
                    "break_minutes": break_minutes or 10,
                    "breaks_minutes": [],
                },
                "entries": entries,
            })

        if getattr(request.user, "account_type", None) != AccountType.STUDENT:
            raise Http404

        try:
            membership = request.user.membership
        except Exception:
            membership = None
        if not membership or not getattr(membership, "group_id", None):
            raise Http404

        group = membership.group
        available = get_available_courses_queryset(request.user, university=getattr(request, "university", None))
        enroll_course_ids = list(available.filter(course_type=Course.CourseType.FULL).values_list("id", flat=True))
        course_ids = list(group.courses.filter(course_type=Course.CourseType.FULL).values_list("id", flat=True)) or enroll_course_ids
        if not course_ids:
            raise Http404

        semesters = list(Semester.objects.select_related("course").filter(course_id__in=course_ids).order_by(
            "course__order", "course__id", "order", "id"
        ))
        if not semesters:
            raise Http404

        semester_id = request.query_params.get("semester_id", None)
        semester = None
        if semester_id is not None and str(semester_id).strip() != "":
            try:
                semester_id_int = int(semester_id)
            except (TypeError, ValueError):
                return Response({"detail": "Некорректный идентификатор семестра."}, status=400)
            semester = next((s for s in semesters if s.id == semester_id_int), None)
            if semester is None:
                raise Http404
        else:
            semester = semesters[0]

        course = semester.course

        subjects = list(Subject.objects.filter(semester=semester).order_by("order", "id"))
        subject_ids = [s.id for s in subjects]
        attachments = TeacherAttachment.objects.filter(
            group_assignment__group_id=group.id,
            group_assignment__course_id=course.id,
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

        schedule = SemesterSchedule.objects.filter(group=group, semester=semester).prefetch_related(
            "entries__subject",
            "entries__teacher",
        ).first()

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

        semesters_by_course = {}
        for s in semesters:
            semesters_by_course.setdefault(s.course_id, []).append({"id": s.id, "title": s.title})
        courses_payload = []
        for c in Course.objects.filter(id__in=course_ids, course_type=Course.CourseType.FULL).order_by("order", "id"):
            courses_payload.append({
                "course": {"id": c.id, "title": c.title},
                "semesters": semesters_by_course.get(c.id, []),
            })

        return Response({
            "group": {"id": group.id, "name": group.name},
            "course": {"id": course.id, "title": course.title},
            "semester": {"id": semester.id, "title": semester.title},
            "available": courses_payload,
            "config": {
                "start_time": (schedule.start_time.strftime("%H:%M") if schedule else "09:00"),
                "lessons_per_day": int(schedule.lessons_per_day) if schedule else 4,
                "lesson_duration_minutes": int(schedule.lesson_duration_minutes) if schedule else 90,
                "break_minutes": int(schedule.break_minutes) if schedule else 10,
                "breaks_minutes": ([] if not schedule else (schedule.breaks_minutes or [])),
            },
            "entries": entries,
        })


class StudentTopicAssignmentsAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, topic_id):
        topic = get_object_or_404(
            Topic.objects.select_related("subject", "subject__semester", "subject__semester__course"),
            pk=topic_id,
        )
        if not topic.subject_id:
            return Response({"detail": "Тема не привязана к предмету."}, status=400)
        available = get_available_courses_queryset(request.user, university=getattr(request, "university", None))
        if not available.filter(pk=topic.subject.semester.course_id).exists():
            return Response({"detail": "Недостаточно прав."}, status=403)

        assignments = list(Assignment.objects.filter(topic=topic, test_source__isnull=True).order_by("position", "id"))
        submissions = AssignmentSubmission.objects.filter(
            student=request.user,
            assignment__in=assignments,
        ).prefetch_related("files")
        submission_map = {s.assignment_id: s for s in submissions}
        grades = Grade.objects.filter(
            student=request.user,
            assignment__in=assignments,
        )
        grade_map = {g.assignment_id: g for g in grades}

        payload = []
        for a in assignments:
            sub = submission_map.get(a.id)
            gr = grade_map.get(a.id)
            payload.append({
                "id": a.id,
                "subject": a.subject_id,
                "topic": a.topic_id,
                "title": a.title,
                "description": a.description,
                "max_grade": a.max_grade,
                "position": a.position,
                "submission": None if not sub else {
                    "submitted_at": sub.submitted_at,
                    "updated_at": sub.updated_at,
                    "files_count": sub.files.count(),
                },
                "grade": None if not gr else {
                    "value": gr.value,
                    "comment": gr.comment,
                    "updated_at": gr.updated_at,
                },
            })

        return Response(payload)


class StudentMyGradesAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        semesters_qs = None
        try:
            membership = request.user.membership
        except Exception:
            membership = None

        if membership and getattr(membership, "group_id", None):
            group = membership.group
            course_ids = list(group.courses.filter(course_type=Course.CourseType.FULL).values_list("id", flat=True))
            if course_ids:
                semesters_qs = Semester.objects.select_related("course").filter(course_id__in=course_ids)

        if semesters_qs is None:
            available = get_available_courses_queryset(
                request.user,
                university=getattr(request, "university", None),
            ).filter(course_type=Course.CourseType.FULL)
            semesters_qs = Semester.objects.select_related("course").filter(course__in=available)

        semesters = semesters_qs.order_by("course__order", "course__id", "order", "id")
        subjects = list(Subject.objects.select_related("semester", "semester__course").filter(
            semester__in=semesters,
        ).order_by(
            "semester__course__order",
            "semester__course__id",
            "semester__order",
            "semester__id",
            "order",
            "id",
        ).distinct())
        seen_subject_ids = set()
        unique_subjects = []
        for s in subjects:
            if s.id in seen_subject_ids:
                continue
            seen_subject_ids.add(s.id)
            unique_subjects.append(s)
        subjects = unique_subjects

        assignments = list(Assignment.objects.select_related(
            "subject",
            "subject__semester",
            "subject__semester__course",
            "topic",
            "test_source",
            "test_source__material",
        ).filter(
            subject__in=subjects,
        ).filter(
            Q(test_source__isnull=False) | ~Q(title__startswith="Тест:"),
        ).order_by(
            "subject_id",
            "position",
            "id",
        ))

        grades = Grade.objects.select_related("assignment").filter(
            student=request.user,
            assignment__in=assignments,
        )
        grade_map = {g.assignment_id: g for g in grades}

        assignments_by_subject = {}
        for a in assignments:
            assignments_by_subject.setdefault(a.subject_id, []).append(a)

        tests = list(TestMaterial.objects.select_related(
            "material",
            "material__subject",
            "material__topic",
            "material__topic__subject",
            "grade_assignment",
        ).filter(
            material__is_published=True,
        ).filter(
            Q(material__subject__in=subjects) | Q(material__topic__subject__in=subjects),
        ))

        test_rows_by_subject = {}
        tests_missing_assignment_ids = []
        for t in tests:
            if t.grade_assignment_id:
                continue
            tests_missing_assignment_ids.append(t.id)
            m = t.material
            sid = m.subject_id or (m.topic.subject_id if m.topic_id else None)
            if not sid:
                continue
            test_rows_by_subject.setdefault(sid, []).append(t)

        best_attempt_by_test = {}
        if tests_missing_assignment_ids:
            attempts = TestAttempt.objects.filter(
                student=request.user,
                status=TestAttempt.Status.COMPLETED,
                test_id__in=tests_missing_assignment_ids,
            ).order_by("test_id", "-percentage", "-id")
            for a in attempts:
                if a.test_id not in best_attempt_by_test:
                    best_attempt_by_test[a.test_id] = a

        payload = []
        for s in subjects:
            items = []
            for a in assignments_by_subject.get(s.id, []):
                try:
                    test_source = a.test_source
                except Exception:
                    test_source = None
                is_test = test_source is not None
                title = test_source.material.title if is_test else a.title
                g = grade_map.get(a.id)
                items.append({
                    "assignment": {
                        "id": a.id,
                        "title": title,
                        "max_grade": a.max_grade,
                        "position": a.position,
                        "topic": None if not a.topic_id else {
                            "id": a.topic_id,
                            "title": a.topic.title,
                        },
                        "kind": "test" if is_test else "assignment",
                    },
                    "grade": None if not g else {
                        "id": g.id,
                        "value": g.value,
                        "comment": g.comment,
                        "updated_at": g.updated_at,
                    },
                })

            for t in test_rows_by_subject.get(s.id, []):
                a = best_attempt_by_test.get(t.id)
                grade_value = None
                if a is not None:
                    grade_value = a.grade_value
                    if grade_value is None:
                        pct = a.percentage or 0
                        if pct > 85:
                            grade_value = 5
                        elif pct >= 70:
                            grade_value = 4
                        elif pct >= 50:
                            grade_value = 3
                        else:
                            grade_value = 2
                items.append({
                    "assignment": {
                        "id": f"test:{t.id}",
                        "title": t.material.title,
                        "max_grade": 5,
                        "position": t.material.order or 0,
                        "topic": None,
                        "kind": "test",
                    },
                    "grade": None if grade_value is None else {
                        "id": None,
                        "value": grade_value,
                        "comment": "Авто: тест",
                        "updated_at": None,
                    },
                })

            payload.append({
                "subject": {
                    "id": s.id,
                    "title": s.title,
                    "semester": {"id": s.semester_id, "title": s.semester.title if s.semester_id else None},
                    "course": {"id": s.semester.course_id if s.semester_id else None, "title": s.semester.course.title if s.semester_id else None},
                },
                "items": items,
            })

        semesters_payload = [
            {
                "id": sem.id,
                "title": sem.title,
                "course": {"id": sem.course_id, "title": sem.course.title if sem.course_id else None},
            }
            for sem in semesters
        ]

        return Response({
            "subjects": payload,
            "semesters": semesters_payload,
            "results": payload,
        })


class StudentAssignmentSubmissionAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def _files_payload(self, submission, assignment_id):
        files = list(submission.files.all()) if submission else []
        return [
            {
                "id": f.id,
                "name": f.name,
                "created_at": f.created_at,
                "download_url": f"/api/courses/assignments/{assignment_id}/my-submission/files/{f.id}/",
            }
            for f in files
        ]

    def get(self, request, assignment_id):
        assignment = get_object_or_404(
            Assignment.objects.select_related("subject", "subject__semester", "subject__semester__course"),
            pk=assignment_id,
        )
        available = get_available_courses_queryset(request.user, university=getattr(request, "university", None))
        if not available.filter(pk=assignment.subject.semester.course_id).exists():
            return Response({"detail": "Недостаточно прав."}, status=403)

        submission = AssignmentSubmission.objects.filter(assignment=assignment, student=request.user).prefetch_related("files").first()
        grade = Grade.objects.filter(assignment=assignment, student=request.user).first()
        return Response({
            "assignment": assignment.id,
            "submission": None if not submission else {
                "submitted_at": submission.submitted_at,
                "updated_at": submission.updated_at,
                "files": self._files_payload(submission, assignment_id),
            },
            "grade": None if not grade else {
                "value": grade.value,
                "comment": grade.comment,
                "updated_at": grade.updated_at,
            },
        })

    def put(self, request, assignment_id):
        assignment = get_object_or_404(
            Assignment.objects.select_related("subject", "subject__semester", "subject__semester__course"),
            pk=assignment_id,
        )
        available = get_available_courses_queryset(request.user, university=getattr(request, "university", None))
        if not available.filter(pk=assignment.subject.semester.course_id).exists():
            return Response({"detail": "Недостаточно прав."}, status=403)

        submit_flag = request.data.get("submit", False)
        submit_flag = bool(submit_flag) and str(submit_flag).lower() not in ("0", "false", "no")

        submission, _ = AssignmentSubmission.objects.get_or_create(
            assignment=assignment,
            student=request.user,
            defaults={"text": "", "submitted_at": None},
        )
        if submit_flag:
            submission.submitted_at = timezone.now()
            submission.save(update_fields=["submitted_at", "updated_at"])

        grade = Grade.objects.filter(assignment=assignment, student=request.user).first()
        return Response({
            "assignment": assignment.id,
            "submission": {
                "submitted_at": submission.submitted_at,
                "updated_at": submission.updated_at,
                "files": self._files_payload(submission, assignment_id),
            },
            "grade": None if not grade else {
                "value": grade.value,
                "comment": grade.comment,
                "updated_at": grade.updated_at,
            },
        })


class StudentAssignmentSubmissionFilesAPIView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = (MultiPartParser, FormParser)

    def post(self, request, assignment_id):
        assignment = get_object_or_404(
            Assignment.objects.select_related("subject", "subject__semester", "subject__semester__course"),
            pk=assignment_id,
        )
        available = get_available_courses_queryset(request.user, university=getattr(request, "university", None))
        if not available.filter(pk=assignment.subject.semester.course_id).exists():
            return Response({"detail": "Недостаточно прав."}, status=403)

        file_obj = request.FILES.get("file")
        if not file_obj:
            return Response({"detail": "Файл не передан."}, status=400)

        name = request.data.get("name") or getattr(file_obj, "name", "") or "Файл"
        name = str(name).strip() or "Файл"

        submission, _ = AssignmentSubmission.objects.get_or_create(
            assignment=assignment,
            student=request.user,
            defaults={"text": "", "submitted_at": None},
        )
        existing = submission.files.count()
        if existing >= 10:
            return Response({"detail": "Можно прикрепить не более 10 файлов."}, status=400)

        created = AssignmentSubmissionFile.objects.create(
            submission=submission,
            name=name,
            file=file_obj,
        )
        return Response({
            "id": created.id,
            "name": created.name,
            "created_at": created.created_at,
            "download_url": f"/api/courses/assignments/{assignment_id}/my-submission/files/{created.id}/",
        })

    def get(self, request, assignment_id):
        assignment = get_object_or_404(
            Assignment.objects.select_related("subject", "subject__semester", "subject__semester__course"),
            pk=assignment_id,
        )
        available = get_available_courses_queryset(request.user, university=getattr(request, "university", None))
        if not available.filter(pk=assignment.subject.semester.course_id).exists():
            return Response({"detail": "Недостаточно прав."}, status=403)

        submission = AssignmentSubmission.objects.filter(assignment=assignment, student=request.user).prefetch_related("files").first()
        files = submission.files.all() if submission else []
        return Response([
            {
                "id": f.id,
                "name": f.name,
                "created_at": f.created_at,
                "download_url": f"/api/courses/assignments/{assignment_id}/my-submission/files/{f.id}/",
            }
            for f in files
        ])


class StudentAssignmentSubmissionFileDetailAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, assignment_id, file_id):
        file_obj = get_object_or_404(
            AssignmentSubmissionFile.objects.select_related("submission", "submission__assignment"),
            pk=file_id,
        )
        if file_obj.submission.assignment_id != assignment_id or file_obj.submission.student_id != request.user.id:
            raise Http404

        res = FileResponse(file_obj.file.open("rb"), content_type="application/octet-stream")
        filename = file_obj.name or f"file-{file_obj.id}"
        safe_filename = filename.replace('"', "")
        res["Content-Disposition"] = f'attachment; filename="{safe_filename}"; filename*=UTF-8\'\'{quote(filename)}'
        return res

    def delete(self, request, assignment_id, file_id):
        file_obj = get_object_or_404(
            AssignmentSubmissionFile.objects.select_related("submission", "submission__assignment"),
            pk=file_id,
        )
        if file_obj.submission.assignment_id != assignment_id or file_obj.submission.student_id != request.user.id:
            raise Http404
        file_obj.delete()
        return Response(status=204)
