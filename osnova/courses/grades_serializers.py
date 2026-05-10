from rest_framework import serializers

from .models import Assignment, Grade


# =========================================================
# ASSIGNMENT SERIALIZERS
# =========================================================

class AssignmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Assignment
        fields = (
            "id",
            "subject",
            "topic",
            "title",
            "description",
            "max_grade",
            "position",
            "created_at",
            "updated_at",
        )


class AssignmentWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Assignment
        fields = ("id", "topic", "subject", "title", "description", "max_grade", "position")
        read_only_fields = ("id",)
        extra_kwargs = {
            "subject": {"required": False, "allow_null": True},
            "max_grade": {"required": False},
        }
        validators = []

    def _validate_unique_title(self, *, subject, topic, title):
        if topic is not None:
            exists = Assignment.objects.filter(topic=topic, title=title)
        else:
            exists = Assignment.objects.filter(subject=subject, topic__isnull=True, title=title)
        if self.instance is not None:
            exists = exists.exclude(pk=self.instance.pk)
        if exists.exists():
            raise serializers.ValidationError({"title": "Задание с таким названием уже существует."})

    def validate(self, attrs):
        attrs = super().validate(attrs)
        if self.instance is None:
            topic = attrs.get("topic")
            if not topic:
                raise serializers.ValidationError({"topic": "Тема обязательна для задания."})
            if not topic.subject_id:
                raise serializers.ValidationError({"topic": "Задание можно создавать только в теме, привязанной к предмету."})
            attrs["subject"] = topic.subject
            attrs["max_grade"] = 5
            self._validate_unique_title(subject=attrs["subject"], topic=topic, title=attrs.get("title"))
            return attrs
        topic = attrs.get("topic", self.instance.topic)
        if topic:
            if topic.subject_id != self.instance.subject_id:
                attrs["subject"] = topic.subject
        else:
            attrs["topic"] = self.instance.topic
            topic = self.instance.topic
        subject = attrs.get("subject", self.instance.subject)
        title = attrs.get("title", self.instance.title)
        self._validate_unique_title(subject=subject, topic=topic, title=title)
        try:
            has_large_grades = Grade.objects.filter(assignment=self.instance, value__gt=5).exists()
        except Exception:
            has_large_grades = False
        if not has_large_grades:
            attrs["max_grade"] = 5
        else:
            attrs["max_grade"] = self.instance.max_grade
        return attrs

    def to_representation(self, instance):
        return AssignmentSerializer(instance, context=self.context).data


# =========================================================
# GRADE SERIALIZERS
# =========================================================

class GradeSerializer(serializers.ModelSerializer):
    student_display_name = serializers.CharField(
        source="student.display_name", read_only=True
    )
    assignment_title = serializers.CharField(
        source="assignment.title", read_only=True
    )

    class Meta:
        model = Grade
        fields = (
            "id",
            "assignment",
            "assignment_title",
            "student",
            "student_display_name",
            "value",
            "comment",
            "graded_by",
            "created_at",
            "updated_at",
        )


class GradeWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Grade
        fields = ("assignment", "student", "value", "comment")
        validators = []
    def validate(self, attrs):
        assignment = attrs.get("assignment") or (
            self.instance.assignment if self.instance else None
        )
        value = attrs.get("value")
        if assignment and value is not None and value > assignment.max_grade:
            raise serializers.ValidationError({
                "value": f"Оценка не может превышать максимальный балл ({assignment.max_grade})."
            })
        return attrs

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        if self.instance is not None:
            self.fields["student"].read_only=True
            self.fields["assignment"].read_only=True
            # Удаляем UniqueTogetherValidator при обновлении
            self.validators = [
                v for v in self.validators 
                if not isinstance(v, serializers.UniqueTogetherValidator)
            ] 
    
    
    def create(self, validated_data):
        validated_data["graded_by"] = self.context["request"].user
        grade, _ = Grade.objects.update_or_create(
            assignment=validated_data["assignment"],
            student=validated_data["student"],
            defaults={
                "value": validated_data["value"],
                "comment": validated_data.get("comment", ""),
                "graded_by": validated_data["graded_by"],
            },
        )
        return grade

    def update(self, instance, validated_data):
        instance.value = validated_data.get("value", instance.value)
        instance.comment = validated_data.get("comment", instance.comment)
        instance.graded_by = self.context["request"].user
        instance.save(update_fields=["value", "comment", "graded_by", "updated_at"])
        return instance


class GradeBulkWriteSerializer(serializers.Serializer):
    """Массовое выставление оценок (несколько студентов / заданий за раз)."""

    grades = GradeWriteSerializer(many=True)

    def create(self, validated_data):
        request = self.context["request"]
        results = []
        for item in validated_data["grades"]:
            item["graded_by"] = request.user
            grade, _ = Grade.objects.update_or_create(
                assignment=item["assignment"],
                student=item["student"],
                defaults={
                    "value": item["value"],
                    "comment": item.get("comment", ""),
                    "graded_by": item["graded_by"],
                },
            )
            results.append(grade)
        return results

    def to_representation(self, instance):
        return {
            "grades": GradeSerializer(instance, many=True).data
        }


# =========================================================
# ТАБЕЛЬ — ТАБЛИЦА ОЦЕНОК ГРУППЫ ПО ПРЕДМЕТУ
# =========================================================

class StudentGradeRowSerializer(serializers.Serializer):
    """Одна строка табеля: студент + оценки по всем заданиям предмета."""

    student_id = serializers.IntegerField()
    student_display_name = serializers.CharField()
    grades = serializers.DictField(
        help_text="Словарь {assignment_id: {value, comment}} для каждого задания",
    )
