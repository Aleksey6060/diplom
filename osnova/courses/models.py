import os

from ordered_model.models import OrderedModel

from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.db.models import Q
from django.utils import timezone
from django.utils.text import slugify

from users.validators import validate_file_size


def material_file_upload_to(instance, filename):
    return f"courses/materials/{instance.material_id}/{filename}"


class BaseModel(models.Model):
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True

    def save(self, *args, **kwargs):
        self.full_clean()
        return super().save(*args, **kwargs)


# =========================================================
# 1. ИЕРАРХИЯ КУРСОВ
# =========================================================

class Course(BaseModel, OrderedModel):
    class CourseType(models.TextChoices):
        FULL = "full", "Высшее образование"
        SIMPLE = "simple", "Дополнительное образование"

    university = models.ForeignKey(
        "universities.University",
        on_delete=models.CASCADE,
        related_name="courses",
        null=True,
        blank=True,
        verbose_name="ВУЗ",
    )
    title = models.CharField(max_length=255)
    slug = models.SlugField(max_length=255, blank=True, allow_unicode=True)
    description = models.TextField(blank=True)
    course_type = models.CharField(max_length=10, choices=CourseType.choices)
    is_active = models.BooleanField(default=True)

    class Meta(OrderedModel.Meta):
        indexes = [
            models.Index(fields=["course_type", "is_active"]),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["university", "title"],
                name="uq_course_university_title",
                violation_error_message="Курс с таким названием уже существует.",
            ),
            models.UniqueConstraint(
                fields=["university", "slug"],
                name="uq_course_university_slug",
            ),
            models.UniqueConstraint(
                fields=["title"],
                condition=Q(university__isnull=True),
                name="uq_course_nulluniversity_title",
                violation_error_message="Курс с таким названием уже существует.",
            ),
            models.UniqueConstraint(
                fields=["slug"],
                condition=Q(university__isnull=True),
                name="uq_course_nulluniversity_slug",
            ),
        ]

    def __str__(self):
        return self.title

    def save(self, *args, **kwargs):
        if not self.slug:
            base_slug = slugify(self.title, allow_unicode=True)[:240] or "course"
            slug = base_slug
            counter = 1

            qs = Course.objects.filter(slug=slug, university=self.university)
            while qs.exclude(pk=self.pk).exists():
                slug = f"{base_slug}-{counter}"
                counter += 1
                qs = Course.objects.filter(slug=slug, university=self.university)

            self.slug = slug

        return super().save(*args, **kwargs)


class CourseStoreCard(BaseModel):
    university = models.ForeignKey(
        "universities.University",
        on_delete=models.CASCADE,
        related_name="course_store_cards",
        null=True,
        blank=True,
        verbose_name="ВУЗ",
    )
    course = models.OneToOneField(
        Course,
        on_delete=models.CASCADE,
        related_name="store_card",
        null=True,
        blank=True,
    )
    title = models.CharField(max_length=255)
    category = models.CharField(max_length=255, blank=True)
    price = models.PositiveIntegerField(default=0)
    image = models.TextField(blank=True)
    description = models.TextField(blank=True)
    level = models.CharField(max_length=64, blank=True)
    duration = models.CharField(max_length=64, blank=True)
    rating = models.DecimalField(
        max_digits=3,
        decimal_places=1,
        default=0,
        validators=[MinValueValidator(0), MaxValueValidator(5)],
    )
    content_folder_id = models.CharField(max_length=255, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ("-created_at",)
        constraints = [
            models.UniqueConstraint(
                fields=["university", "title"],
                name="uq_course_store_card_university_title",
            ),
            models.UniqueConstraint(
                fields=["title"],
                condition=Q(university__isnull=True),
                name="uq_course_store_card_nulluniversity_title",
            ),
        ]

    def clean(self):
        if self.course_id and self.university_id and self.course.university_id != self.university_id:
            raise ValidationError({
                "university": "ВУЗ карточки должен совпадать с ВУЗом курса."
            })
        if self.course_id and self.course.course_type != Course.CourseType.SIMPLE:
            raise ValidationError({
                "course": "Карточку магазина можно привязать только к курсу типа Дополнительное образование."
            })

    def save(self, *args, **kwargs):
        if self.course_id and self.university_id is None:
            self.university = self.course.university
        return super().save(*args, **kwargs)


class Semester(BaseModel, OrderedModel):
    course = models.ForeignKey(
        Course,
        on_delete=models.CASCADE,
        related_name="semesters",
    )
    title = models.CharField(max_length=255)
    delay_published_at = models.DateTimeField(null=True, blank=True)

    order_with_respect_to = 'course'

    class Meta(OrderedModel.Meta):
        constraints = [
            models.UniqueConstraint(
                fields=["course", "title"],
                name="uq_semester_course_title",
            ),
        ]

    def __str__(self):
        return f"{self.course.title} -> {self.title}"

    def clean(self):
        if self.delay_published_at is not None and self.delay_published_at <= timezone.now():
            raise ValidationError({
                "delay_published_at": "Отложенная публикация должна быть позже, чем текущая дата"
            })
        if self.course and self.course.course_type != Course.CourseType.FULL:
            raise ValidationError({
                "course": "Семестры можно создавать только у курса типа Высшее образование."
            })


class Subject(BaseModel, OrderedModel):
    semester = models.ForeignKey(
        Semester,
        on_delete=models.CASCADE,
        related_name="subjects",
    )
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)

    order_with_respect_to = 'semester'

    class Meta(OrderedModel.Meta):
        constraints = [
            models.UniqueConstraint(
                fields=["semester", "title"],
                name="uq_subject_sem_title",
            ),
        ]

    def __str__(self):
        return f"{self.semester} -> {self.title}"

    @property
    def course(self):
        return self.semester.course

    def clean(self):
        if self.semester and self.semester.course.course_type != Course.CourseType.FULL:
            raise ValidationError({
                "semester": "Предметы можно создавать только внутри курса типа Высшее образование."
            })


class Topic(BaseModel, OrderedModel):
    """
    Для высшего образования topic привязывается к Subject.
    Для дополнительного образования topic привязывается напрямую к Course.
    """

    course = models.ForeignKey(
        Course,
        on_delete=models.CASCADE,
        related_name="root_topics",
        null=True,
        blank=True,
    )
    subject = models.ForeignKey(
        Subject,
        on_delete=models.CASCADE,
        related_name="topics",
        null=True,
        blank=True,
    )
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)

    order_with_respect_to = ('course', 'subject')

    class Meta(OrderedModel.Meta):
        constraints = [
            models.CheckConstraint(
                check=(
                    Q(course__isnull=False, subject__isnull=True) |
                    Q(course__isnull=True, subject__isnull=False)
                ),
                name="topic_one_parent",
            ),
            models.UniqueConstraint(
                fields=["course", "title"],
                condition=Q(course__isnull=False),
                name="uq_topic_course_title",
            ),
            models.UniqueConstraint(
                fields=["subject", "title"],
                condition=Q(subject__isnull=False),
                name="uq_topic_subject_title",
            ),
        ]

    def _wrt_map(self):
        d = {}
        for order_wrt_name in self.get_order_with_respect_to():
            field_path = f"{order_wrt_name}_id"
            if field_path in self.get_deferred_fields():
                d[order_wrt_name] = None
            else:
                d[order_wrt_name] = self.__dict__.get(field_path)
        return d

    def __str__(self):
        return self.title

    @property
    def course_owner(self):
        if self.course_id:
            return self.course
        if self.subject_id:
            return self.subject.semester.course
        return None

    def clean(self):
        if bool(self.course_id) == bool(self.subject_id):
            raise ValidationError("Тема должна принадлежать либо курсу, либо предмету.")

        if self.course_id and self.course.course_type != Course.CourseType.SIMPLE:
            raise ValidationError({
                "course": "Тему напрямую к курсу можно привязать только у курса типа Дополнительное образование."
            })

        if self.subject_id and self.subject.semester.course.course_type != Course.CourseType.FULL:
            raise ValidationError({
                "subject": "Тему к предмету можно привязать только у курса типа Высшее образование."
            })


# =========================================================
# 2. БАЗОВЫЙ МАТЕРИАЛ
# =========================================================

class Material(BaseModel, OrderedModel):
    class MaterialType(models.TextChoices):
        LECTURE = "lecture", "Лекция"
        PRESENTATION = "presentation", "Презентация"
        DOCUMENT = "document", "Документ"
        TEST = "test", "Тест"
        OTHER = "other", "Другое"

    # У дополнительного образования материал можно вешать прямо на Course
    course = models.ForeignKey(
        Course,
        on_delete=models.CASCADE,
        related_name="materials",
        null=True,
        blank=True,
    )

    # У высшего образования материал можно вешать на Subject
    subject = models.ForeignKey(
        Subject,
        on_delete=models.CASCADE,
        related_name="materials",
        null=True,
        blank=True,
    )

    # У обоих типов курса материал можно вешать на Topic
    topic = models.ForeignKey(
        Topic,
        on_delete=models.CASCADE,
        related_name="materials",
        null=True,
        blank=True,
    )

    title = models.CharField(max_length=255)
    material_type = models.CharField(max_length=20, choices=MaterialType.choices)
    description = models.TextField(blank=True)
    is_published = models.BooleanField(default=False)
    free_preview = models.BooleanField(default=False)

    order_with_respect_to = ('course', 'subject', 'topic')

    class Meta(OrderedModel.Meta):
        indexes = [
            models.Index(fields=["material_type", "is_published"]),
        ]
        constraints = [
            models.CheckConstraint(
                check=(
                    Q(course__isnull=False, subject__isnull=True, topic__isnull=True) |
                    Q(course__isnull=True, subject__isnull=False, topic__isnull=True) |
                    Q(course__isnull=True, subject__isnull=True, topic__isnull=False)
                ),
                name="material_one_parent",
            ),

            models.UniqueConstraint(
                fields=["course", "title"],
                condition=Q(course__isnull=False),
                name="uq_mat_course_title",
            ),
            models.UniqueConstraint(
                fields=["subject", "title"],
                condition=Q(subject__isnull=False),
                name="uq_mat_subject_title",
            ),
            models.UniqueConstraint(
                fields=["topic", "title"],
                condition=Q(topic__isnull=False),
                name="uq_mat_topic_title",
            ),
        ]

    def _wrt_map(self):
        d = {}
        for order_wrt_name in self.get_order_with_respect_to():
            field_path = f"{order_wrt_name}_id"
            if field_path in self.get_deferred_fields():
                d[order_wrt_name] = None
            else:
                d[order_wrt_name] = self.__dict__.get(field_path)
        return d

    def __str__(self):
        return f"{self.get_material_type_display()}: {self.title}"

    @property
    def course_owner(self):
        if self.course_id:
            return self.course
        if self.subject_id:
            return self.subject.semester.course
        if self.topic_id:
            return self.topic.course_owner
        return None

    def clean(self):
        parents_count = sum([
            bool(self.course_id),
            bool(self.subject_id),
            bool(self.topic_id),
        ])
        if parents_count != 1:
            raise ValidationError("Материал должен принадлежать только одному родителю: курсу, предмету или теме.")

        if self.course_id and self.course.course_type != Course.CourseType.SIMPLE:
            raise ValidationError({
                "course": "Материалы напрямую к курсу можно прикреплять только у курса типа Дополнительное образование."
            })

        if self.subject_id and self.subject.semester.course.course_type != Course.CourseType.FULL:
            raise ValidationError({
                "subject": "Материалы к предмету можно прикреплять только у курса типа Высшее образование."
            })


# =========================================================
# 3. ДЕТАЛИ ПО ТИПАМ МАТЕРИАЛА
# =========================================================

class LectureMaterial(BaseModel):
    material = models.OneToOneField(
        Material,
        on_delete=models.CASCADE,
        related_name="lecture_data",
    )
    content = models.TextField(blank=True)
    duration_minutes = models.PositiveIntegerField(null=True, blank=True)

    def __str__(self):
        return f"LectureData -> {self.material.title}"

    def clean(self):
        if self.material and self.material.material_type != Material.MaterialType.LECTURE:
            raise ValidationError({
                "material": "LectureMaterial можно создавать только для материала типа Лекция."
            })


class PresentationMaterial(BaseModel):
    material = models.OneToOneField(
        Material,
        on_delete=models.CASCADE,
        related_name="presentation_data",
    )
    speaker_notes = models.TextField(blank=True)
    slides_count = models.PositiveIntegerField(null=True, blank=True)

    def __str__(self):
        return f"PresentationData -> {self.material.title}"

    def clean(self):
        if self.material and self.material.material_type != Material.MaterialType.PRESENTATION:
            raise ValidationError({
                "material": "PresentationMaterial можно создавать только для материала типа Презентация."
            })


class DocumentMaterial(BaseModel):
    class DocumentFormat(models.TextChoices):
        PDF = "pdf", "PDF"
        DOC = "doc", "DOC"
        DOCX = "docx", "DOCX"
        XLS = "xls", "XLS"
        XLSX = "xlsx", "XLSX"
        TXT = "txt", "TXT"
        OTHER = "other", "Другое"

    material = models.OneToOneField(
        Material,
        on_delete=models.CASCADE,
        related_name="document_data",
    )
    document_format = models.CharField(
        max_length=10,
        choices=DocumentFormat.choices,
        default=DocumentFormat.OTHER,
    )
    extracted_text = models.TextField(blank=True)

    def __str__(self):
        return f"DocumentData -> {self.material.title}"

    def clean(self):
        if self.material and self.material.material_type != Material.MaterialType.DOCUMENT:
            raise ValidationError({
                "material": "DocumentMaterial можно создавать только для материала типа Документ."
            })


class TestMaterial(BaseModel):
    material = models.OneToOneField(
        Material,
        on_delete=models.CASCADE,
        related_name="test_data",
    )
    grade_assignment = models.OneToOneField(
        "courses.Assignment",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="test_source",
    )
    time_limit_minutes = models.PositiveIntegerField(null=True, blank=True)
    attempts_limit = models.PositiveIntegerField(
        null=True,
        blank=True,
        help_text="NULL = без ограничения",
    )
    passing_percentage = models.PositiveSmallIntegerField(
        default=0,
        validators=[MinValueValidator(0), MaxValueValidator(100)],
    )
    shuffle_questions = models.BooleanField(default=False)
    show_correct_answers_after_submit = models.BooleanField(default=False)

    def __str__(self):
        return f"TestData -> {self.material.title}"

    def clean(self):
        if self.material and self.material.material_type != Material.MaterialType.TEST:
            raise ValidationError({
                "material": "TestMaterial можно создавать только для материала типа Тест."
            })


# =========================================================
# 4. ПАПКИ И ФАЙЛЫ ВНУТРИ МАТЕРИАЛА
# =========================================================

class MaterialFolder(BaseModel, OrderedModel):
    material = models.ForeignKey(
        Material,
        on_delete=models.CASCADE,
        related_name="folders",
    )
    parent = models.ForeignKey(
        "self",
        on_delete=models.CASCADE,
        related_name="children",
        null=True,
        blank=True,
    )
    title = models.CharField(max_length=255)

    order_with_respect_to = ('material', 'parent')

    class Meta(OrderedModel.Meta):
        constraints = [
            models.UniqueConstraint(
                fields=["material", "title"],
                condition=Q(parent__isnull=True),
                name="uq_root_folder_title",
            ),
            models.UniqueConstraint(
                fields=["parent", "title"],
                condition=Q(parent__isnull=False),
                name="uq_child_folder_title",
            ),
        ]

    def _wrt_map(self):
        d = {}
        for order_wrt_name in self.get_order_with_respect_to():
            field_path = f"{order_wrt_name}_id"
            if field_path in self.get_deferred_fields():
                d[order_wrt_name] = None
            else:
                d[order_wrt_name] = self.__dict__.get(field_path)
        return d

    def __str__(self):
        return self.title

    def clean(self):
        if self.parent_id:
            if self.parent_id == self.pk:
                raise ValidationError({"parent": "Папка не может быть родителем самой себе."})

            if self.parent.material_id != self.material_id:
                raise ValidationError({
                    "parent": "Родительская папка должна принадлежать тому же материалу."
                })


class MaterialFile(BaseModel, OrderedModel):
    class FileRole(models.TextChoices):
        MAIN = "main", "Основной файл"
        ATTACHMENT = "attachment", "Вложение"
        IMAGE = "image", "Изображение"
        OTHER = "other", "Другое"

    material = models.ForeignKey(
        Material,
        on_delete=models.CASCADE,
        related_name="files",
    )
    folder = models.ForeignKey(
        MaterialFolder,
        on_delete=models.CASCADE,
        related_name="files",
        null=True,
        blank=True,
    )
    title = models.CharField(max_length=255, blank=True)
    file = models.FileField(upload_to=material_file_upload_to)
    file_role = models.CharField(
        max_length=20,
        choices=FileRole.choices,
        default=FileRole.ATTACHMENT,
    )

    order_with_respect_to = ('material', 'folder')

    class Meta(OrderedModel.Meta):
        pass

    def _wrt_map(self):
        d = {}
        for order_wrt_name in self.get_order_with_respect_to():
            field_path = f"{order_wrt_name}_id"
            if field_path in self.get_deferred_fields():
                d[order_wrt_name] = None
            else:
                d[order_wrt_name] = self.__dict__.get(field_path)
        return d

    def __str__(self):
        return self.title or os.path.basename(self.file.name)

    def save(self, *args, **kwargs):
        if not self.title and self.file:
            self.title = os.path.basename(self.file.name)
        return super().save(*args, **kwargs)

    def clean(self):
        if self.folder_id and self.folder.material_id != self.material_id:
            raise ValidationError({
                "folder": "Файл и папка должны принадлежать одному и тому же материалу."
            })


# =========================================================
# 5. ТЕСТЫ: ВОПРОСЫ И ПРАВИЛЬНЫЕ ОТВЕТЫ
# =========================================================

class TestQuestion(BaseModel, OrderedModel):
    class QuestionType(models.TextChoices):
        SINGLE = "single", "Один вариант"
        MULTIPLE = "multiple", "Несколько вариантов"
        TEXT = "text", "Текстовый ответ"

    test = models.ForeignKey(
        TestMaterial,
        on_delete=models.CASCADE,
        related_name="questions",
    )
    text = models.TextField()
    question_type = models.CharField(
        max_length=20,
        choices=QuestionType.choices,
        default=QuestionType.SINGLE,
    )
    explanation = models.TextField(blank=True)
    points = models.PositiveIntegerField(default=1)

    # Для текстовых вопросов можно хранить сразу список допустимых ответов
    correct_text_answers = models.JSONField(default=list, blank=True)
    case_sensitive = models.BooleanField(default=False)

    order_with_respect_to = 'test'

    class Meta(OrderedModel.Meta):
        pass

    def __str__(self):
        return f"Q: {self.text[:50]}"

    def clean(self):
        if self.question_type == self.QuestionType.TEXT and not self.correct_text_answers:
            raise ValidationError({
                "correct_text_answers": "Для текстового вопроса нужно указать хотя бы один правильный ответ."
            })

        if self.question_type != self.QuestionType.TEXT and self.correct_text_answers:
            raise ValidationError({
                "correct_text_answers": "correct_text_answers используется только для текстовых вопросов."
            })


class TestAnswerOption(BaseModel, OrderedModel):
    question = models.ForeignKey(
        TestQuestion,
        on_delete=models.CASCADE,
        related_name="options",
    )
    text = models.CharField(max_length=1000)
    is_correct = models.BooleanField(default=False)

    order_with_respect_to = 'question'

    class Meta(OrderedModel.Meta):
        pass

    def __str__(self):
        return self.text

    def clean(self):
        if self.question and self.question.question_type == TestQuestion.QuestionType.TEXT:
            raise ValidationError({
                "question": "У текстового вопроса не должно быть вариантов ответа."
            })


# =========================================================
# 6. ГРУППЫ, ЗАПИСИ НА КУРС, ПРЕПОДАВАТЕЛИ
# =========================================================

class StudentGroup(BaseModel):
    """Группа студентов внутри курса."""

    course = models.ForeignKey(
        Course,
        on_delete=models.CASCADE,
        related_name="student_groups",
    )
    title = models.CharField("Название группы", max_length=255)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ("title", "id")
        constraints = [
            models.UniqueConstraint(
                fields=["course", "title"],
                name="uq_student_group_course_title",
            ),
        ]

    def __str__(self):
        return f"{self.course.title} — {self.title}"


class CourseEnrollment(BaseModel):
    """Запись студента на курс с опциональной привязкой к группе."""

    student = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="enrollments",
    )
    course = models.ForeignKey(
        Course,
        on_delete=models.CASCADE,
        related_name="enrollments",
    )
    group = models.ForeignKey(
        StudentGroup,
        on_delete=models.SET_NULL,
        related_name="enrollments",
        null=True,
        blank=True,
    )
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ("id",)
        constraints = [
            models.UniqueConstraint(
                fields=["student", "course"],
                name="uq_enrollment_student_course",
            ),
        ]

    def __str__(self):
        return f"{self.student} -> {self.course.title}"

    def clean(self):
        if self.group and self.group.course_id != self.course_id:
            raise ValidationError({
                "group": "Группа должна принадлежать тому же курсу."
            })


class SubjectTeacher(BaseModel):
    """Привязка преподавателя (сотрудника) к предмету."""

    teacher = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="taught_subjects",
    )
    subject = models.ForeignKey(
        Subject,
        on_delete=models.CASCADE,
        related_name="teachers",
    )
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ("id",)
        constraints = [
            models.UniqueConstraint(
                fields=["teacher", "subject"],
                name="uq_subject_teacher",
            ),
        ]

    def __str__(self):
        return f"{self.teacher} -> {self.subject.title}"


# =========================================================
# 7. ЗАДАНИЯ И ОЦЕНКИ
# =========================================================

class Assignment(BaseModel):
    """Задание по предмету, за которое выставляется оценка."""

    subject = models.ForeignKey(
        Subject,
        on_delete=models.CASCADE,
        related_name="assignments",
    )
    topic = models.ForeignKey(
        Topic,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="assignments",
        verbose_name="Тема",
    )
    title = models.CharField("Название задания", max_length=255)
    description = models.TextField("Описание", blank=True)
    max_grade = models.PositiveSmallIntegerField(
        "Максимальный балл",
        default=5,
        validators=[MinValueValidator(1)],
    )
    position = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ("position", "id")
        constraints = [
            models.UniqueConstraint(
                fields=["subject", "title"],
                condition=Q(topic__isnull=True),
                name="uq_assignment_subject_title_no_topic",
            ),
            models.UniqueConstraint(
                fields=["topic", "title"],
                condition=Q(topic__isnull=False),
                name="uq_assignment_topic_title",
            ),
        ]

    def __str__(self):
        return f"{self.subject.title} — {self.title}"

    @property
    def course(self):
        return self.subject.semester.course


class AssignmentSubmission(BaseModel):
    assignment = models.ForeignKey(
        Assignment,
        on_delete=models.CASCADE,
        related_name="submissions",
    )
    student = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="assignment_submissions",
    )
    text = models.TextField(blank=True)
    submitted_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ("id",)
        constraints = [
            models.UniqueConstraint(
                fields=["assignment", "student"],
                name="uq_assignment_submission_student",
            ),
        ]


def assignment_submission_file_upload_to(instance, filename):
    return f"courses/assignments/{instance.submission.assignment_id}/students/{instance.submission.student_id}/{filename}"


class AssignmentSubmissionFile(BaseModel):
    submission = models.ForeignKey(
        AssignmentSubmission,
        on_delete=models.CASCADE,
        related_name="files",
    )
    name = models.CharField(max_length=255)
    file = models.FileField(
        upload_to=assignment_submission_file_upload_to,
        validators=[validate_file_size],
    )

    class Meta:
        ordering = ("id",)



class Grade(BaseModel):

    assignment = models.ForeignKey(
        Assignment,
        on_delete=models.CASCADE,
        related_name="grades",
    )
    student = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="grades",
    )
    value = models.PositiveSmallIntegerField(
        "Балл",
        validators=[MinValueValidator(0)],
    )
    comment = models.TextField("Комментарий", blank=True)
    graded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="given_grades",
        verbose_name="Кто выставил",
    )

    class Meta:
        ordering = ("id",)
        constraints = [
            models.UniqueConstraint(
                fields=["assignment", "student"],
                name="uq_grade_assignment_student",
            ),
        ]

    def __str__(self):
        return f"{self.student} — {self.assignment.title}: {self.value}"

    def clean(self):
        if self.assignment_id and self.value is not None:
            if self.value > self.assignment.max_grade:
                raise ValidationError({
                    "value": f"Оценка не может превышать максимальный балл ({self.assignment.max_grade})."
                })


# =========================================================
# 8. ПОПЫТКИ ПРОХОЖДЕНИЯ ТЕСТОВ
# =========================================================

class TestAttempt(BaseModel):
    class Status(models.TextChoices):
        IN_PROGRESS = "in_progress", "В процессе"
        COMPLETED = "completed", "Завершено"
        TIMED_OUT = "timed_out", "Время вышло"

    test = models.ForeignKey(
        TestMaterial,
        on_delete=models.CASCADE,
        related_name="attempts",
    )
    student = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="test_attempts",
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.IN_PROGRESS,
    )
    started_at = models.DateTimeField(auto_now_add=True)
    finished_at = models.DateTimeField(null=True, blank=True)
    score = models.PositiveIntegerField("Набранные баллы", default=0)
    max_score = models.PositiveIntegerField("Максимальный балл", default=0)
    percentage = models.PositiveSmallIntegerField("Процент", default=0)
    is_passed = models.BooleanField("Пройден", default=False)
    grade_value = models.PositiveSmallIntegerField("Оценка", null=True, blank=True)

    class Meta:
        ordering = ("-started_at",)

    def __str__(self):
        return f"{self.student} — {self.test.material.title} ({self.status})"


class TestStudentAnswer(BaseModel):
    attempt = models.ForeignKey(
        TestAttempt,
        on_delete=models.CASCADE,
        related_name="answers",
    )
    question = models.ForeignKey(
        TestQuestion,
        on_delete=models.CASCADE,
        related_name="student_answers",
    )
    selected_option = models.ForeignKey(
        TestAnswerOption,
        on_delete=models.CASCADE,
        related_name="student_answers",
    )
    is_correct = models.BooleanField(default=False)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["attempt", "question"],
                name="uq_attempt_question",
            ),
        ]

    def __str__(self):
        return f"Attempt {self.attempt_id} — Q{self.question_id}"

    def save(self, *args, **kwargs):
        self.is_correct = self.selected_option.is_correct
        super().save(*args, **kwargs)
