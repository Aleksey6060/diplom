from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.db import models
from datetime import time

# Create your models here.
from django.db.models import Q

from shared_modules.enums import AccountType, CourseType


class StudentGroups(models.Model):
    university = models.ForeignKey(
        "universities.University",
        on_delete=models.CASCADE,
        related_name="groups",
        null=True,
        blank=True,
        verbose_name="ВУЗ",
    )
    name = models.CharField(max_length=50, verbose_name="Название")
    students = models.ManyToManyField(
        get_user_model(),
        through="StudentGroupThrough",
        related_name="study_groups",
        verbose_name="Студенты",
    )
    courses = models.ManyToManyField(
        "courses.Course",
        through="CourseGroupAttachment",
        related_name="bind_groups",
        verbose_name="Курсы",
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Дата создания")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="Дата обновления")

    class Meta:
        verbose_name = "Группа студентов"
        verbose_name_plural = "Группы студентов"
        constraints = [
            models.UniqueConstraint(
                fields=["university", "name"],
                name="uq_group_university_name_v2",
                nulls_distinct=False,
            ),
        ]


class StudentGroupThrough(models.Model):
    group = models.ForeignKey(
        StudentGroups,
        on_delete=models.CASCADE,
        db_index=True,
        verbose_name="Группа",
    )
    student = models.OneToOneField(
        get_user_model(),
        on_delete=models.CASCADE,
        related_name="membership",
        verbose_name="Студент",
    )
    enrolled_at = models.DateField(auto_now_add=True, verbose_name="Дата зачисления")

    class Meta:
        verbose_name = "Участник группы"
        verbose_name_plural = "Участники групп"


class CourseGroupAttachment(models.Model):
    group = models.ForeignKey(StudentGroups, on_delete=models.CASCADE, verbose_name="Группа")
    course = models.ForeignKey("courses.Course", on_delete=models.CASCADE, verbose_name="Курс")


    class Meta:
        verbose_name = "Привязка курса к группе"
        verbose_name_plural = "Привязки курсов к группам"
        constraints = [
            models.UniqueConstraint(
                fields=['group', 'course'],
                name='unique_course_group'
            )
        ]


class TeacherAttachment(models.Model):
    group_assignment = models.ForeignKey(
        CourseGroupAttachment,
        on_delete=models.CASCADE,
        limit_choices_to=Q(
            course__course_type=CourseType.FULL
        ),
        verbose_name="Привязка курса к группе",
    )
    teacher = models.ForeignKey(
        "users.User",
        on_delete=models.CASCADE,
        limit_choices_to=Q(
            account_type=AccountType.TEACHER
        ),
        verbose_name="Преподаватель",
    )
    subject = models.ForeignKey("courses.Subject", on_delete=models.CASCADE, verbose_name="Предмет")

    class Meta:
        verbose_name = "Привязка преподавателя к предмету"
        verbose_name_plural = "Привязки преподавателей к предметам"
        constraints = [
            models.UniqueConstraint(
                fields=['group_assignment', 'teacher', 'subject'],
                name='unique_subject_teacher_course_group'
            )
        ]

    def clean(self):
        # Проверяем, что предмет действительно относится к курсу из связки
        if self.subject.semester.course_id != self.group_assignment.course_id:
            raise ValidationError("Выбранный предмет не принадлежит данному курсу.")


class SemesterSchedule(models.Model):
    group = models.ForeignKey(
        StudentGroups,
        on_delete=models.CASCADE,
        related_name="semester_schedules",
        verbose_name="Группа",
    )
    semester = models.ForeignKey(
        "courses.Semester",
        on_delete=models.CASCADE,
        related_name="group_schedules",
        verbose_name="Семестр",
    )

    start_time = models.TimeField(default=time(9, 0), verbose_name="Время начала")
    lessons_per_day = models.PositiveSmallIntegerField(default=4, verbose_name="Количество пар в день")
    lesson_duration_minutes = models.PositiveSmallIntegerField(default=90, verbose_name="Длительность пары (мин.)")
    break_minutes = models.PositiveSmallIntegerField(default=10, verbose_name="Перерыв (мин.)")
    breaks_minutes = models.JSONField(default=list, blank=True, verbose_name="Перерывы по парам (мин.)")

    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Дата создания")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="Дата обновления")

    class Meta:
        verbose_name = "Расписание семестра"
        verbose_name_plural = "Расписания семестров"
        constraints = [
            models.UniqueConstraint(
                fields=["group", "semester"],
                name="uq_semester_schedule_group_semester",
            ),
        ]

    def clean(self):
        course_ids = list(self.group.courses.values_list("id", flat=True))
        if self.semester and self.semester.course_id not in course_ids:
            raise ValidationError("Семестр не принадлежит курсу, привязанному к группе.")


class SemesterScheduleEntry(models.Model):
    schedule = models.ForeignKey(
        SemesterSchedule,
        on_delete=models.CASCADE,
        related_name="entries",
        verbose_name="Расписание",
    )
    weekday = models.PositiveSmallIntegerField(verbose_name="День недели")
    lesson = models.PositiveSmallIntegerField(verbose_name="Номер пары")
    subject = models.ForeignKey(
        "courses.Subject",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="schedule_entries",
        verbose_name="Предмет",
    )
    teacher = models.ForeignKey(
        "users.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="schedule_entries",
        verbose_name="Преподаватель",
    )

    class Meta:
        verbose_name = "Ячейка расписания"
        verbose_name_plural = "Ячейки расписания"
        indexes = [
            models.Index(fields=["schedule", "weekday", "lesson"]),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["schedule", "weekday", "lesson"],
                name="uq_schedule_entry_cell",
            ),
        ]

    def clean(self):
        if self.subject and self.schedule and self.subject.semester_id != self.schedule.semester_id:
            raise ValidationError("Предмет не принадлежит семестру расписания.")
        if self.teacher_id and not self.subject_id:
            raise ValidationError("Нельзя указать преподавателя без предмета.")
