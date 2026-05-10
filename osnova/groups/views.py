from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import Prefetch, BooleanField, Case, When, IntegerField, Subquery, OuterRef, Count
from django.db.models.functions import Coalesce
from django.shortcuts import get_object_or_404

# Create your views here.
from django.http import Http404
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import status, permissions
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.mixins import ListModelMixin, CreateModelMixin, DestroyModelMixin
from rest_framework.response import Response
from datetime import time as dt_time

from rest_framework.viewsets import ModelViewSet, GenericViewSet

from courses.serializers import CourseListSerializer
from courses.models import Course, Semester, Subject
from groups.models import StudentGroupThrough, StudentGroups, TeacherAttachment, CourseGroupAttachment
from groups.serializers import (
    GroupParticipantSerializer,
    ParticipantsSerializer,
    StudentGroupsSerializer,
    TeacherAttachmentSerializer,
    SemesterScheduleWriteSerializer,
)
from osnova import settings
from shared_modules.mixins import PermissionMapMixin
from shared_modules.enums import CourseType
from users.permissions import HasAppPermission
from .models import SemesterSchedule, SemesterScheduleEntry


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

    bindings_qs = TeacherAttachment.objects.filter(
        group_assignment__group=group,
        group_assignment__course_id=int(course_id),
        subject__semester=semester,
    ).select_related("teacher", "subject").order_by("subject__order", "subject__id", "id")
    bindings = []
    for b in bindings_qs:
        t = b.teacher
        bindings.append({
            "id": b.id,
            "subject": {"id": b.subject_id, "title": b.subject.title},
            "teacher": {"id": t.id, "display_name": getattr(t, "display_name", None) or t.email},
        })

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
        "config": {
            "start_time": ((schedule.start_time if schedule else dt_time(9, 0)).strftime("%H:%M")),
            "lessons_per_day": int((schedule.lessons_per_day if schedule else 4)),
            "lesson_duration_minutes": int((schedule.lesson_duration_minutes if schedule else 90)),
            "break_minutes": int((schedule.break_minutes if schedule else 10)),
            "breaks_minutes": ([] if not schedule else (schedule.breaks_minutes or [])),
        },
        "subjects": [
            {
                "id": s.id,
                "title": s.title,
                "teacher": teacher_by_subject.get(s.id),
            }
            for s in subjects
        ],
        "bindings": bindings,
        "entries": entries,
    }


def _weekday_label(idx):
    labels = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"]
    try:
        i = int(idx)
    except Exception:
        return str(idx)
    return labels[i] if 0 <= i < len(labels) else str(idx)


def _ensure_no_teacher_schedule_conflicts(group, course_id, semester, new_entries):
    required_slots = []
    for e in new_entries:
        if not getattr(e, "teacher_id", None):
            continue
        if not getattr(e, "subject_id", None):
            continue
        required_slots.append((int(e.teacher_id), int(e.weekday), int(e.lesson)))

    if not required_slots:
        return

    required_slots.sort(key=lambda t: (t[0], t[1], t[2]))
    seen = set()
    unique_slots = []
    for t in required_slots:
        if t in seen:
            continue
        seen.add(t)
        unique_slots.append(t)

    teacher_ids = sorted({t[0] for t in unique_slots})
    teacher_label_by_id = {}
    if teacher_ids:
        for u in get_user_model().objects.filter(id__in=teacher_ids).only("id", "email", "first_name", "last_name", "middle_name"):
            teacher_label_by_id[u.id] = getattr(u, "display_name", None) or u.email or f"ID {u.id}"

    university_id = getattr(group, "university_id", None)
    if university_id:
        allowed_full_courses = Course.objects.filter(course_type=Course.CourseType.FULL, university_id=university_id)
    else:
        allowed_full_courses = Course.objects.filter(course_type=Course.CourseType.FULL, university__isnull=True)

    for teacher_id, weekday, lesson in unique_slots:
        qs_same_semester = SemesterScheduleEntry.objects.select_related(
            "schedule__group",
            "schedule__semester__course",
            "teacher",
        ).filter(
            schedule__semester_id=semester.id,
            weekday=weekday,
            lesson=lesson,
            subject_id__isnull=False,
        ).exclude(schedule__group_id=group.id)

        conflict_same_semester = qs_same_semester.filter(teacher_id=teacher_id).first()
        if conflict_same_semester is None:
            null_entries = list(qs_same_semester.filter(teacher_id__isnull=True).values_list("schedule__group_id", "subject_id"))
            if null_entries:
                att_set = set(
                    TeacherAttachment.objects.filter(
                        teacher_id=teacher_id,
                        group_assignment__group_id__in=[gid for gid, _ in null_entries],
                        group_assignment__course_id=course_id,
                        subject_id__in=[sid for _, sid in null_entries],
                    ).values_list("group_assignment__group_id", "subject_id")
                )
                if att_set:
                    for e in qs_same_semester.filter(teacher_id__isnull=True):
                        if (e.schedule.group_id, e.subject_id) in att_set:
                            conflict_same_semester = e
                            break

        if conflict_same_semester is not None:
            t = conflict_same_semester.teacher
            teacher_label = (
                (getattr(t, "display_name", None) or t.email)
                if t is not None
                else (teacher_label_by_id.get(teacher_id) or f"ID {teacher_id}")
            )
            group_label = getattr(conflict_same_semester.schedule.group, "name", None) or f"Группа #{conflict_same_semester.schedule.group_id}"
            course_title = getattr(conflict_same_semester.schedule.semester.course, "title", None) or f"Курс #{course_id}"
            semester_title = getattr(conflict_same_semester.schedule.semester, "title", None) or f"Семестр #{conflict_same_semester.schedule.semester_id}"
            raise ValidationError({
                "detail": f"Преподаватель {teacher_label} занят: {group_label}, {course_title}, {semester_title} — {_weekday_label(weekday)} {lesson} пара.",
                "conflict": {"weekday": int(weekday), "lesson": int(lesson)},
            })

        qs_other_course = SemesterScheduleEntry.objects.select_related(
            "schedule__group",
            "schedule__semester__course",
            "teacher",
        ).filter(
            schedule__semester__course__in=allowed_full_courses,
            schedule__semester__order=semester.order,
            weekday=weekday,
            lesson=lesson,
            subject_id__isnull=False,
        ).exclude(schedule__semester_id=semester.id)

        conflict_other_course = qs_other_course.filter(teacher_id=teacher_id).first()
        if conflict_other_course is None:
            null_entries = list(
                qs_other_course.filter(teacher_id__isnull=True).values_list(
                    "schedule__group_id",
                    "schedule__semester__course_id",
                    "subject_id",
                )
            )
            if null_entries:
                att_set = set(
                    TeacherAttachment.objects.filter(
                        teacher_id=teacher_id,
                        group_assignment__group_id__in=[k[0] for k in null_entries],
                        group_assignment__course_id__in=[k[1] for k in null_entries],
                        subject_id__in=[k[2] for k in null_entries],
                    ).values_list("group_assignment__group_id", "group_assignment__course_id", "subject_id")
                )
                if att_set:
                    for e in qs_other_course.filter(teacher_id__isnull=True):
                        if (e.schedule.group_id, e.schedule.semester.course_id, e.subject_id) in att_set:
                            conflict_other_course = e
                            break

        if conflict_other_course is not None:
            t = conflict_other_course.teacher
            teacher_label = (
                (getattr(t, "display_name", None) or t.email)
                if t is not None
                else (teacher_label_by_id.get(teacher_id) or f"ID {teacher_id}")
            )
            group_label = getattr(conflict_other_course.schedule.group, "name", None) or f"Группа #{conflict_other_course.schedule.group_id}"
            course_title = getattr(conflict_other_course.schedule.semester.course, "title", None) or f"Курс #{conflict_other_course.schedule.semester.course_id}"
            semester_title = getattr(conflict_other_course.schedule.semester, "title", None) or f"Семестр #{conflict_other_course.schedule.semester_id}"
            raise ValidationError({
                "detail": f"Преподаватель {teacher_label} занят в другом курсе (Высшее образование): {group_label}, {course_title}, {semester_title} — {_weekday_label(weekday)} {lesson} пара.",
                "conflict": {"weekday": int(weekday), "lesson": int(lesson)},
            })


class StudentGroupViewSet(PermissionMapMixin, ModelViewSet):
    filter_backends = [DjangoFilterBackend]

    queryset = StudentGroups.objects.all()
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = StudentGroupsSerializer

    method_map = {
        PermissionMapMixin.Methods.GET: [HasAppPermission("students.groups.view")],
        PermissionMapMixin.Methods.POST: [HasAppPermission("students.groups.create")],
        PermissionMapMixin.Methods.UPDATE: [HasAppPermission("students.groups.edit")],
        PermissionMapMixin.Methods.DELETE: [HasAppPermission("students.groups.delete")],
    }

    action_map = {
        "retrieve": [HasAppPermission("students.groups.view")],
        "list": [HasAppPermission("students.groups.view")],
        "create": [HasAppPermission("students.groups.create")],
        "update": [HasAppPermission("students.groups.edit")],
        "partial_update": [HasAppPermission("students.groups.edit")],
        "destroy": [HasAppPermission("students.groups.delete")],
        "participants": [HasAppPermission("students.groups.view")],
        "add_to_group": [HasAppPermission("distribution.students.groups.add")],
        "remove_from_group": [HasAppPermission("distribution.students.groups.remove")],
        "courses": [HasAppPermission("distribution.course.groups.view")],
        "bind_to_courses": [HasAppPermission("distribution.course.groups.create")],
        "detach_group": [HasAppPermission("distribution.course.groups.remove")],
        "schedule": [HasAppPermission(["students.schedule.manage", "students.groups.edit"])],
        "course_semesters": [HasAppPermission("distribution.teacher.course.view")],
        "semester_subjects": [HasAppPermission("distribution.teacher.course.view")],
    }

    def get_queryset(self):
        students_count = StudentGroupThrough.objects.filter(
            group_id=OuterRef('pk')
        ).values('group_id').annotate(cnt=Count('id')).values('cnt')

        queryset = super().get_queryset()

        # Фильтрация по университету
        university = getattr(self.request, "university", None)
        if university is not None:
            queryset = queryset.filter(university=university)
        else:
            queryset = queryset.filter(university__isnull=True)

        queryset = queryset.annotate(
            count_participants=Coalesce(Subquery(students_count, output_field=IntegerField()), 0)
        )

        queryset = queryset.annotate(
            is_overflow=Case(
                When(count_participants__gte=settings.MAX_STUDENTS_IN_GROUP, then=True),
                default=False,
                output_field=BooleanField()
            )
        )

        if self.action == "participants":
            queryset = queryset.prefetch_related(
                Prefetch("students", queryset=get_user_model().objects.select_related("role"), to_attr="participants")
            )
        elif self.action == "courses":
            queryset = queryset.prefetch_related("courses")

        return queryset

    def perform_create(self, serializer):
        university = getattr(self.request, "university", None)
        serializer.save(university=university)

    @action(methods=["GET"], detail=True, serializer_class=GroupParticipantSerializer)
    def participants(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = self.get_serializer(instance.participants, many=True)
        return Response(data=serializer.data)

    @action(
        methods=["GET"],
        detail=True,
        serializer_class=CourseListSerializer
    )
    def courses(self, request, *args, **kwargs):
        instance = self.get_object()
        filtered_queryset = self.filter_queryset(instance.courses.filter(course_type=CourseType.FULL))
        serializer = self.get_serializer(filtered_queryset, many=True)
        return Response(data=serializer.data)

    @action(
        methods=["GET"],
        detail=True,
        url_path=r"courses/(?P<course_id>\d+)/semesters",
    )
    def course_semesters(self, request, *args, **kwargs):
        group = self.get_object()
        course_id = int(kwargs["course_id"])
        if not group.courses.filter(id=course_id, course_type=CourseType.FULL).exists():
            raise Http404

        semesters = Semester.objects.filter(course_id=course_id).order_by("order", "id")
        return Response([{"id": s.id, "title": s.title} for s in semesters])

    @action(
        methods=["GET"],
        detail=True,
        url_path=r"courses/(?P<course_id>\d+)/semesters/(?P<semester_id>\d+)/subjects",
    )
    def semester_subjects(self, request, *args, **kwargs):
        group = self.get_object()
        course_id = int(kwargs["course_id"])
        semester_id = int(kwargs["semester_id"])

        if not group.courses.filter(id=course_id, course_type=CourseType.FULL).exists():
            raise Http404

        get_object_or_404(
            Semester.objects.select_related("course"),
            pk=semester_id,
            course_id=course_id,
        )

        subjects = Subject.objects.filter(semester_id=semester_id).order_by("order", "id")
        return Response([{"id": s.id, "title": s.title} for s in subjects])

    @action(methods=["POST"], detail=True, serializer_class=CourseListSerializer)
    def bind_to_courses(self, request, *args, **kwargs):
        instance = self.get_object()
        courses = request.data.get("courses", [])
        CourseModel = instance.__class__.courses.field.remote_field.model

        if courses:
            courses_obj = list(CourseModel.objects.filter(id__in=courses))
            if len(courses_obj) != len(courses):
                raise ValidationError({
                    "courses": "Были переданы невалидные идентификаторы курсов"
                })
        else: courses_obj = []

        instance.courses.set(courses_obj)

        return Response(
            data=self.get_serializer(instance.courses.all(), many=True).data,
            status=status.HTTP_201_CREATED
        )

    @action(methods=["POST"], detail=True)
    def detach_from_group(self, request, *args, **kwargs):
        instance = self.get_object()
        course = request.data.get("course", None)

        if course is None:
            raise ValidationError({"course": "Данное поле обязательно для передачи"})

        ThroughModel = instance.__class__.courses.through
        if ThroughModel.objects.filter(
                group_id=instance.pk, course_id=course
        ).delete() == 0:
            return Response(data={"error": "Группы или курса не найдено"}, status=status.HTTP_400_BAD_REQUEST)

        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(
        methods=["GET", "PUT"],
        detail=True,
        url_path=r"courses/(?P<course_id>\d+)/semesters/(?P<semester_id>\d+)/schedule",
    )
    @transaction.atomic
    def schedule(self, request, *args, **kwargs):
        group = self.get_object()
        course_id = int(kwargs["course_id"])
        semester_id = int(kwargs["semester_id"])

        if not group.courses.filter(id=course_id, course_type=CourseType.FULL).exists():
            raise Http404

        semester = get_object_or_404(
            Semester.objects.select_related("course"),
            pk=semester_id,
            course_id=course_id,
        )

        schedule = SemesterSchedule.objects.filter(group=group, semester=semester).prefetch_related(
            "entries__subject",
            "entries__teacher",
        ).first()

        if request.method == "GET":
            return Response(_build_semester_schedule_payload(group, course_id, semester, schedule))

        write_serializer = SemesterScheduleWriteSerializer(data=request.data)
        write_serializer.is_valid(raise_exception=True)
        data = write_serializer.validated_data

        if schedule is None:
            schedule = SemesterSchedule.objects.create(
                group=group,
                semester=semester,
                start_time=data.get("start_time", dt_time(9, 0)),
                lessons_per_day=data.get("lessons_per_day", 4),
                lesson_duration_minutes=data.get("lesson_duration_minutes", 90),
                break_minutes=data.get("break_minutes", 10),
                breaks_minutes=data.get("breaks_minutes", []),
            )
        else:
            for field in ("start_time", "lessons_per_day", "lesson_duration_minutes", "break_minutes", "breaks_minutes"):
                if field in data:
                    setattr(schedule, field, data[field])
            schedule.save(update_fields=["start_time", "lessons_per_day", "lesson_duration_minutes", "break_minutes", "breaks_minutes", "updated_at"])

        if "breaks_minutes" in data:
            raw_breaks = schedule.breaks_minutes or []
            resolved_lessons = int(schedule.lessons_per_day or 0)
            if not isinstance(raw_breaks, list):
                raise ValidationError({"breaks_minutes": "Ожидается массив чисел."})
            if any((not isinstance(x, int)) for x in raw_breaks):
                raise ValidationError({"breaks_minutes": "Ожидается массив целых чисел."})
            if any((x < 0 or x > 600) for x in raw_breaks):
                raise ValidationError({"breaks_minutes": "Некорректное значение перерыва."})
            max_len = max(0, resolved_lessons - 1)
            if len(raw_breaks) > 0 and len(raw_breaks) != max_len:
                raise ValidationError({"breaks_minutes": "Нужно указать перерыв после каждой пары (кроме последней)."})

        entries_provided = "entries" in data
        entries_data = list(data.get("entries", []))
        if entries_provided:
            max_lessons = int(schedule.lessons_per_day)
            subject_ids = set()
            teacher_ids = set()
            normalized_pairs = set()
            for row in entries_data:
                if int(row["lesson"]) > max_lessons:
                    raise ValidationError({"entries": "Номер пары превышает настройку количества пар."})
                sid = row.get("subject", None)
                if sid is None:
                    continue
                subject_ids.add(int(sid))
                tid = row.get("teacher", None)
                if tid is not None:
                    teacher_ids.add(int(tid))
                    normalized_pairs.add((int(sid), int(tid)))

            if subject_ids:
                valid_subject_ids = set(Subject.objects.filter(semester=semester, id__in=subject_ids).values_list("id", flat=True))
                if valid_subject_ids != subject_ids:
                    raise ValidationError({"entries": "Есть предметы, которые не принадлежат выбранному семестру."})

            if normalized_pairs:
                valid_pairs = set(
                    TeacherAttachment.objects.filter(
                        group_assignment__group=group,
                        group_assignment__course_id=course_id,
                        subject_id__in=[p[0] for p in normalized_pairs],
                        teacher_id__in=[p[1] for p in normalized_pairs],
                        subject__semester=semester,
                    ).values_list("subject_id", "teacher_id")
                )
                if valid_pairs != normalized_pairs:
                    raise ValidationError({"detail": "Есть связки преподаватель + предмет, которые не привязаны к выбранной группе/курсу/семестру."})

            SemesterScheduleEntry.objects.filter(schedule=schedule).delete()
            new_entries = []
            for row in entries_data:
                sid = row.get("subject", None)
                if sid is None:
                    continue
                tid = row.get("teacher", None)
                new_entries.append(SemesterScheduleEntry(
                    schedule=schedule,
                    weekday=int(row["weekday"]),
                    lesson=int(row["lesson"]),
                    subject_id=int(sid),
                    teacher_id=(None if tid is None else int(tid)),
                ))
            if new_entries:
                _ensure_no_teacher_schedule_conflicts(group, course_id, semester, new_entries)
            if new_entries:
                SemesterScheduleEntry.objects.bulk_create(new_entries)

        schedule = SemesterSchedule.objects.filter(pk=schedule.pk).prefetch_related("entries__subject", "entries__teacher").first()
        return Response(_build_semester_schedule_payload(group, course_id, semester, schedule))

    @action(methods=["POST"], detail=True, serializer_class=ParticipantsSerializer)
    @transaction.atomic
    def add_to_group(self, request, *args, **kwargs):
        try:
            instance = (
                self.get_queryset()  # Берем базу из вашего get_queryset (с фильтрами и т.д.)
                    .select_for_update()  # Блокируем строку
                    .get(pk=kwargs['pk'])  # Находим конкретную группу
            )
        except StudentGroups.DoesNotExist:  # Ошибка в названии: DoesNotExist (ед. число)
            raise Http404
        else:
            self.check_object_permissions(self.request, instance)

        if instance.is_overflow:
            raise ValidationError({
                "students": "Группа переполнена"
            })

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        students = serializer.validated_data["participants"]

        available_count = settings.MAX_STUDENTS_IN_GROUP - instance.count_participants
        if len(students) > available_count:
            raise ValidationError({
                "participants": "Превышено колличество участников на курс",
                "rest_count": available_count
            })

        already_enrolled = [
            student.pk for student in students if student.is_enrolled
        ]

        if already_enrolled:
            raise ValidationError({
                "participants": "Данные студенты уже присутствуют в группах",
                "ids": already_enrolled
            })

        instance.students.add(*students)
        return Response(status=status.HTTP_201_CREATED)

    @action(methods=["DELETE"], detail=True, serializer_class=ParticipantsSerializer)
    def remove_from_group(self, request, *args, **kwargs):
        instance = self.get_object()

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        students = serializer.validated_data["participants"]

        instance.students.remove(*students)
        return Response(status=status.HTTP_204_NO_CONTENT)



class TeacherAttachmentViewSet(
    PermissionMapMixin,
    ListModelMixin,
    CreateModelMixin,
    DestroyModelMixin,
    GenericViewSet
):
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['group_assignment__group__id', 'group_assignment__group__name', 'teacher__email', 'subject__title']
    queryset = TeacherAttachment.objects.select_related("group_assignment__group", "teacher", "subject")
    serializer_class = TeacherAttachmentSerializer

    method_map = {
        "list": [HasAppPermission("distribution.teacher.course.view")],
        "create": [HasAppPermission("distribution.teacher.course.create")],
        "destroy": [HasAppPermission("distribution.teacher.course.remove")],
    }

    def get_queryset(self):
        qs = super().get_queryset().filter(
            group_assignment__group_id=self.kwargs["group_id"],
            group_assignment__course_id=self.kwargs["course_id"]
        )
        semester_id = self.request.query_params.get("semester_id", None)
        if semester_id is not None and str(semester_id).strip() != "":
            try:
                semester_id_int = int(semester_id)
            except (TypeError, ValueError):
                raise ValidationError({"semester_id": "Некорректный идентификатор семестра."})
            qs = qs.filter(subject__semester_id=semester_id_int)
        return qs

    def create(self, request, *args, **kwargs):
        try:
            group_assignment = CourseGroupAttachment.objects.get(
                group_id=self.kwargs["group_id"],
                course_id=self.kwargs["course_id"]
            )
        except StudentGroups.DoesNotExist:  # Ошибка в названии: DoesNotExist (ед. число)
            raise Http404

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(group_assignment=group_assignment)

        return Response(data=serializer.data, status=status.HTTP_201_CREATED)

    @transaction.atomic
    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()

        group_id = getattr(instance.group_assignment, "group_id", None)
        semester_id = getattr(instance.subject, "semester_id", None)
        subject_id = getattr(instance, "subject_id", None)
        teacher_id = getattr(instance, "teacher_id", None)

        has_other_bindings = TeacherAttachment.objects.filter(
            group_assignment=instance.group_assignment,
            subject_id=subject_id,
        ).exclude(pk=instance.pk).exists()

        if group_id and semester_id and subject_id:
            schedule = SemesterSchedule.objects.filter(group_id=group_id, semester_id=semester_id).first()
            if schedule is not None:
                qs = SemesterScheduleEntry.objects.filter(schedule=schedule, subject_id=subject_id)
                if has_other_bindings:
                    qs = qs.filter(teacher_id=teacher_id)
                qs.delete()

        self.perform_destroy(instance)
        return Response(status=status.HTTP_204_NO_CONTENT)
