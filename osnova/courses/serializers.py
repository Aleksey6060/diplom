from django.db import transaction
from django.utils import timezone
from rest_framework import serializers
from rest_framework.exceptions import ValidationError

from .models import (
    Course,
    CourseStoreCard,
    Semester,
    Subject,
    Topic,
    Material,
    Assignment,
    LectureMaterial,
    PresentationMaterial,
    DocumentMaterial,
    TestMaterial,
    MaterialFolder,
    MaterialFile,
    TestQuestion,
    TestAnswerOption)


# =========================================================
# READ SERIALIZERS
# =========================================================

class CourseListSerializer(serializers.ModelSerializer):
    course_type_display = serializers.CharField(source="get_course_type_display", read_only=True)
    store_card_image = serializers.CharField(source="store_card.image", read_only=True, default="")

    class Meta:
        model = Course
        fields = (
            "id",
            "title",
            "slug",
            "description",
            "course_type",
            "course_type_display",
            "store_card_image",
            "order",
            "is_active",
        )


class CourseStoreCardSerializer(serializers.ModelSerializer):
    class Meta:
        model = CourseStoreCard
        fields = (
            "id",
            "university",
            "course",
            "title",
            "category",
            "price",
            "image",
            "description",
            "level",
            "duration",
            "rating",
            "content_folder_id",
            "is_active",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "university", "created_at", "updated_at")


class SemesterSerializer(serializers.ModelSerializer):
    class Meta:
        model = Semester
        fields = ("id", "course", "title", "order", "delay_published_at")

    def validate_delay_published_at(self, value):
        if value is not None and value <= timezone.now():
            raise ValidationError({
                "delay_published_at": "Отложенная публикация должна быть позже, чем текущая дата"
            })
        return value


class SubjectSerializer(serializers.ModelSerializer):
    class Meta:
        model = Subject
        fields = ("id", "semester", "title", "description", "order")


class TopicSerializer(serializers.ModelSerializer):
    class Meta:
        model = Topic
        fields = ("id", "course", "subject", "title", "description", "order")


class MaterialListSerializer(serializers.ModelSerializer):
    material_type_display = serializers.CharField(source="get_material_type_display", read_only=True)
    test_id = serializers.IntegerField(source="test_data.id", read_only=True, default=None)

    class Meta:
        model = Material
        fields = (
            "id",
            "course",
            "subject",
            "topic",
            "title",
            "material_type",
            "material_type_display",
            "description",
            "order",
            "is_published",
            "free_preview",
            "test_id",
        )


class MaterialFolderSerializer(serializers.ModelSerializer):
    class Meta:
        model = MaterialFolder
        fields = ("id", "material", "parent", "title", "order")


class MaterialFileSerializer(serializers.ModelSerializer):
    file_role_display = serializers.CharField(source="get_file_role_display", read_only=True)

    class Meta:
        model = MaterialFile
        fields = (
            "id",
            "material",
            "folder",
            "title",
            "file",
            "file_role",
            "file_role_display",
            "order",
        )


class LectureMaterialReadSerializer(serializers.ModelSerializer):
    class Meta:
        model = LectureMaterial
        fields = ("content", "duration_minutes")


class PresentationMaterialReadSerializer(serializers.ModelSerializer):
    class Meta:
        model = PresentationMaterial
        fields = ("speaker_notes", "slides_count")


class DocumentMaterialReadSerializer(serializers.ModelSerializer):
    document_format_display = serializers.CharField(source="get_document_format_display", read_only=True)

    class Meta:
        model = DocumentMaterial
        fields = ("document_format", "document_format_display", "extracted_text")


class TestAnswerOptionPublicSerializer(serializers.ModelSerializer):
    class Meta:
        model = TestAnswerOption
        fields = ("id", "text", "order")


class TestQuestionPublicSerializer(serializers.ModelSerializer):
    options = TestAnswerOptionPublicSerializer(many=True, read_only=True)

    class Meta:
        model = TestQuestion
        fields = (
            "id",
            "text",
            "question_type",
            "points",
            "order",
            "options",
        )


class TestMaterialPublicSerializer(serializers.ModelSerializer):
    questions = TestQuestionPublicSerializer(many=True, read_only=True)

    class Meta:
        model = TestMaterial
        fields = (
            "id",
            "time_limit_minutes",
            "attempts_limit",
            "passing_percentage",
            "shuffle_questions",
            "show_correct_answers_after_submit",
            "questions",
        )


class MaterialContentSerializer(serializers.ModelSerializer):
    material_type_display = serializers.CharField(source="get_material_type_display", read_only=True)
    lecture_data = LectureMaterialReadSerializer(read_only=True)
    presentation_data = PresentationMaterialReadSerializer(read_only=True)
    document_data = DocumentMaterialReadSerializer(read_only=True)
    test_data = TestMaterialPublicSerializer(read_only=True)

    class Meta:
        model = Material
        fields = (
            "id",
            "course",
            "subject",
            "topic",
            "title",
            "material_type",
            "material_type_display",
            "description",
            "order",
            "is_published",
            "free_preview",
            "lecture_data",
            "presentation_data",
            "document_data",
            "test_data",
            "created_at",
            "updated_at",
        )


# =========================================================
# WRITE SERIALIZERS
# =========================================================

class CourseWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Course
        fields = (
            "id",
            "title",
            "slug",
            "description",
            "course_type",
            "order",
            "is_active",
        )
        read_only_fields = ("id",)

    def validate(self, attrs):
        if self.instance and "course_type" in attrs and attrs["course_type"] != self.instance.course_type:
            raise serializers.ValidationError({
                "course_type": "Нельзя менять тип курса."
            })
        return attrs


class SemesterWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Semester
        fields = ("id", "course", "title", "order", "delay_published_at")
        read_only_fields = ("id",)

    def validate_delay_published_at(self, value):
        if value is not None and value <= timezone.now():
            raise ValidationError({
                "delay_published_at": "Отложенная публикация должна быть позже, чем текущая дата"
            })
        return value


class SubjectWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Subject
        fields = ("id", "semester", "title", "description", "order")
        read_only_fields = ("id",)

    def create(self, validated_data):
        with transaction.atomic():
            subject = super().create(validated_data)

            title = (subject.title or "").strip()
            course_id = getattr(getattr(subject, "semester", None), "course_id", None)
            if not title or not course_id:
                return subject

            from groups.models import TeacherAttachment

            existing_pairs = TeacherAttachment.objects.filter(
                subject__semester__course_id=course_id,
                subject__title__iexact=title,
            ).exclude(
                subject_id=subject.id
            ).values(
                "group_assignment_id",
                "teacher_id",
            ).distinct()

            for row in existing_pairs:
                TeacherAttachment.objects.get_or_create(
                    group_assignment_id=row["group_assignment_id"],
                    teacher_id=row["teacher_id"],
                    subject_id=subject.id,
                )

            return subject


class TopicWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Topic
        fields = ("id", "course", "subject", "title", "description", "order")
        read_only_fields = ("id",)


class LectureMaterialWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = LectureMaterial
        fields = ("content", "duration_minutes")


class PresentationMaterialWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = PresentationMaterial
        fields = ("speaker_notes", "slides_count")


class DocumentMaterialWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = DocumentMaterial
        fields = ("document_format", "extracted_text")


class TestAnswerOptionWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = TestAnswerOption
        fields = ("text", "is_correct", "order")


class TestQuestionWriteSerializer(serializers.ModelSerializer):
    options = TestAnswerOptionWriteSerializer(many=True, required=False)

    class Meta:
        model = TestQuestion
        fields = (
            "text",
            "question_type",
            "explanation",
            "points",
            "order",
            "correct_text_answers",
            "case_sensitive",
            "options",
        )

    def validate(self, attrs):
        question_type = attrs.get("question_type")
        options = attrs.get("options", [])
        correct_text_answers = attrs.get("correct_text_answers", [])

        if question_type == TestQuestion.QuestionType.TEXT and options:
            raise serializers.ValidationError({
                "options": "Для текстового вопроса нельзя передавать варианты ответа."
            })

        if question_type in (TestQuestion.QuestionType.SINGLE, TestQuestion.QuestionType.MULTIPLE) and correct_text_answers:
            raise serializers.ValidationError({
                "correct_text_answers": "Для single/multiple вопроса правильные ответы нужно хранить в options[].is_correct."
            })

        return attrs


class TestMaterialWriteSerializer(serializers.ModelSerializer):
    questions = TestQuestionWriteSerializer(many=True, required=False)

    class Meta:
        model = TestMaterial
        fields = (
            "time_limit_minutes",
            "attempts_limit",
            "passing_percentage",
            "shuffle_questions",
            "show_correct_answers_after_submit",
            "questions",
        )


class MaterialWriteSerializer(serializers.ModelSerializer):
    lecture_data = LectureMaterialWriteSerializer(required=False)
    presentation_data = PresentationMaterialWriteSerializer(required=False)
    document_data = DocumentMaterialWriteSerializer(required=False)
    test_data = TestMaterialWriteSerializer(required=False)

    class Meta:
        model = Material
        fields = (
            "id",
            "course",
            "subject",
            "topic",
            "title",
            "material_type",
            "description",
            "order",
            "is_published",
            "free_preview",
            "lecture_data",
            "presentation_data",
            "document_data",
            "test_data",
        )
        read_only_fields = ("id",)

    def validate(self, attrs):
        if self.instance and getattr(self, "partial", False):
            parent_fields = [
                attrs.get("course", self.instance.course),
                attrs.get("subject", self.instance.subject),
                attrs.get("topic", self.instance.topic),
            ]
        else:
            parent_fields = [attrs.get("course"), attrs.get("subject"), attrs.get("topic")]
        parents_count = sum(1 for value in parent_fields if value is not None)
        if parents_count != 1:
            raise serializers.ValidationError(
                "Материал должен принадлежать только одному родителю: course, subject или topic."
            )

        details_map = {
            Material.MaterialType.LECTURE: "lecture_data",
            Material.MaterialType.PRESENTATION: "presentation_data",
            Material.MaterialType.DOCUMENT: "document_data",
            Material.MaterialType.TEST: "test_data",
        }

        passed_detail_fields = [
            field_name
            for field_name in ("lecture_data", "presentation_data", "document_data", "test_data")
            if self.initial_data.get(field_name) is not None
        ]

        if len(passed_detail_fields) > 1:
            raise serializers.ValidationError(
                "Можно передать только одну структуру деталей материала: lecture_data / presentation_data / document_data / test_data."
            )

        expected_detail_field = details_map.get(attrs.get("material_type"))
        if passed_detail_fields and expected_detail_field and passed_detail_fields[0] != expected_detail_field:
            raise serializers.ValidationError({
                passed_detail_fields[0]: "Структура деталей не соответствует типу материала."
            })

        return attrs

    def create(self, validated_data):
        lecture_data = validated_data.pop("lecture_data", None)
        presentation_data = validated_data.pop("presentation_data", None)
        document_data = validated_data.pop("document_data", None)
        test_data = validated_data.pop("test_data", None)

        with transaction.atomic():
            material = Material.objects.create(**validated_data)

            if material.material_type == Material.MaterialType.LECTURE:
                LectureMaterial.objects.create(material=material, **(lecture_data or {}))

            elif material.material_type == Material.MaterialType.PRESENTATION:
                PresentationMaterial.objects.create(material=material, **(presentation_data or {}))

            elif material.material_type == Material.MaterialType.DOCUMENT:
                DocumentMaterial.objects.create(material=material, **(document_data or {}))

            elif material.material_type == Material.MaterialType.TEST:
                test_questions = []
                if test_data:
                    test_questions = test_data.pop("questions", [])

                test_instance = TestMaterial.objects.create(material=material, **(test_data or {}))
                subject = material.subject or (material.topic.subject if material.topic_id and material.topic.subject_id else None)
                if subject is not None:
                    topic = material.topic if material.topic_id and material.topic.subject_id else None
                    base_title = f"Тест: {material.title}"
                    title = base_title
                    i = 2
                    while True:
                        if topic:
                            exists = Assignment.objects.filter(topic=topic, title=title).exists()
                        else:
                            exists = Assignment.objects.filter(subject=subject, topic__isnull=True, title=title).exists()
                        if not exists:
                            break
                        title = f"{base_title} ({i})"
                        i += 1
                        if i > 200:
                            break
                    grade_assignment = Assignment.objects.create(
                        subject=subject,
                        topic=topic,
                        title=title,
                        description="",
                        max_grade=5,
                        position=material.order or 0,
                    )
                    test_instance.grade_assignment = grade_assignment
                    test_instance.save(update_fields=["grade_assignment"])

                for question_data in test_questions:
                    options_data = question_data.pop("options", [])
                    question = TestQuestion.objects.create(test=test_instance, **question_data)

                    for option_data in options_data:
                        TestAnswerOption.objects.create(question=question, **option_data)

        return material

    def update(self, instance, validated_data):
        lecture_data = validated_data.pop("lecture_data", None)
        presentation_data = validated_data.pop("presentation_data", None)
        document_data = validated_data.pop("document_data", None)
        test_data = validated_data.pop("test_data", None)

        with transaction.atomic():
            for attr, value in validated_data.items():
                setattr(instance, attr, value)
            instance.save()

            if lecture_data is not None and hasattr(instance, "lecture_data"):
                for k, v in lecture_data.items():
                    setattr(instance.lecture_data, k, v)
                instance.lecture_data.save()
            if presentation_data is not None and hasattr(instance, "presentation_data"):
                for k, v in presentation_data.items():
                    setattr(instance.presentation_data, k, v)
                instance.presentation_data.save()
            if document_data is not None and hasattr(instance, "document_data"):
                for k, v in document_data.items():
                    setattr(instance.document_data, k, v)
                instance.document_data.save()
            if test_data is not None and hasattr(instance, "test_data"):
                questions = test_data.pop("questions", None)
                for k, v in test_data.items():
                    setattr(instance.test_data, k, v)
                instance.test_data.save()
                if questions is not None:
                    TestQuestion.objects.filter(test=instance.test_data).delete()
                    for question_data in questions:
                        options_data = question_data.pop("options", [])
                        question = TestQuestion.objects.create(test=instance.test_data, **question_data)
                        for option_data in options_data:
                            TestAnswerOption.objects.create(question=question, **option_data)
                if instance.title and instance.test_data.grade_assignment_id:
                    ga = instance.test_data.grade_assignment
                    desired = f"Тест: {instance.title}"
                    if ga.title != desired:
                        ga.title = desired
                        ga.save(update_fields=["title", "updated_at"])

        return instance


class MaterialFolderWriteSerializer(serializers.ModelSerializer):
    def validate_material(self, value):
        if getattr(value, "material_type", None) == Material.MaterialType.TEST:
            raise serializers.ValidationError("Материал типа 'тест' не может содержать папки.")
        return value

    class Meta:
        model = MaterialFolder
        fields = ("id", "material", "parent", "title", "order")
        read_only_fields = ("id",)


class MaterialFileWriteSerializer(serializers.ModelSerializer):
    def validate_material(self, value):
        if getattr(value, "material_type", None) == Material.MaterialType.TEST:
            raise serializers.ValidationError("Материал типа 'тест' не может содержать файлы.")
        return value

    class Meta:
        model = MaterialFile
        fields = ("id", "material", "folder", "title", "file", "file_role", "order")
        read_only_fields = ("id",)
