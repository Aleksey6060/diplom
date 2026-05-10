from django.contrib.auth import get_user_model
from django.db.models import Exists, OuterRef
from rest_framework import serializers
from rest_framework.exceptions import ValidationError

from courses.serializers import SubjectSerializer
from osnova import settings
from shared_modules.enums import AccountType
from .models import StudentGroups, StudentGroupThrough, TeacherAttachment, SemesterSchedule, SemesterScheduleEntry


class StudentGroupsSerializer(serializers.ModelSerializer):

    is_overflow = serializers.BooleanField(required=False, read_only=True)
    count_participants = serializers.IntegerField(required=False, read_only=True)

    class Meta:
        model = StudentGroups
        fields = ("id", "name", "is_overflow", "count_participants")
        read_only_fields = ("id", "is_overflow", "count_participants")


class GroupParticipantSerializer(serializers.ModelSerializer):
    display_name = serializers.CharField(read_only=True)

    class Meta:
        model = get_user_model()
        fields = (
            "id",
            "display_name",
            "first_name",
            "last_name",
            "middle_name",
            "email",
            "phone",
            "avatar",
            "account_type",
        )
        read_only_fields = fields


class ParticipantsSerializer(serializers.Serializer):
    participants = serializers.ListField(
        child=serializers.IntegerField(),
        min_length=1,
        max_length=settings.MAX_STUDENTS_IN_GROUP
    )

    def validate_participants(self, participants):
        subquery_enrolled = StudentGroupThrough.objects.filter(student_id=OuterRef("id"))
        students = get_user_model().objects.filter(
            id__in=participants,
            account_type=AccountType.STUDENT
        ).annotate(
            is_enrolled=Exists(subquery_enrolled)
        )

        if len(students) != len(participants):
            raise ValidationError({
                "participants": "Были указаны невалидные идентификаторы студентов"
            })

        return students



class TeacherProfileSerializer(serializers.ModelSerializer):
    display_name = serializers.CharField(read_only=True)

    class Meta:
        model = get_user_model()
        fields = (
            "id",
            "display_name",
            "first_name",
            "last_name",
            "middle_name",
            "avatar",
            "email"
        )


class TeacherAttachmentSerializer(serializers.ModelSerializer):

    class Meta:
        model = TeacherAttachment
        fields = ("id", "group_assignment", "teacher", "subject")
        read_only_fields = ("id", "group_assignment")

    def to_representation(self, instance):
        rep = super().to_representation(instance)
        rep["teacher"] = TeacherProfileSerializer(instance.teacher).data
        rep["subject"] = SubjectSerializer(instance.subject).data

        return rep


class SemesterScheduleEntryWriteSerializer(serializers.Serializer):
    weekday = serializers.IntegerField(min_value=0, max_value=6)
    lesson = serializers.IntegerField(min_value=1, max_value=20)
    subject = serializers.IntegerField(required=False, allow_null=True)
    teacher = serializers.IntegerField(required=False, allow_null=True)


class SemesterScheduleWriteSerializer(serializers.Serializer):
    start_time = serializers.TimeField(required=False)
    lessons_per_day = serializers.IntegerField(required=False, min_value=1, max_value=20)
    lesson_duration_minutes = serializers.IntegerField(required=False, min_value=10, max_value=600)
    break_minutes = serializers.IntegerField(required=False, min_value=0, max_value=600)
    breaks_minutes = serializers.ListField(
        child=serializers.IntegerField(min_value=0, max_value=600),
        required=False,
        allow_empty=True,
    )
    entries = SemesterScheduleEntryWriteSerializer(many=True, required=False)


class SemesterScheduleSerializer(serializers.ModelSerializer):
    class Meta:
        model = SemesterSchedule
        fields = (
            "id",
            "group",
            "semester",
            "start_time",
            "lessons_per_day",
            "lesson_duration_minutes",
            "break_minutes",
            "breaks_minutes",
            "created_at",
            "updated_at",
        )
        read_only_fields = fields


class SemesterScheduleEntrySerializer(serializers.ModelSerializer):
    class Meta:
        model = SemesterScheduleEntry
        fields = ("id", "weekday", "lesson", "subject", "teacher")
        read_only_fields = fields
