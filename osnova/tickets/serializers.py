from rest_framework import serializers

from shared_modules.enums import AccountType
from .models import Ticket, TicketTemplate, TicketStatus


def _can_manage_tickets(user):
    if not user or not user.is_authenticated:
        return False
    if getattr(user, "is_superuser", False):
        return True
    account_type = getattr(user, "account_type", None)
    return account_type in (AccountType.OWNER, AccountType.UNIVERSITY_OWNER, AccountType.EMPLOYEE)


class TicketTemplateSerializer(serializers.ModelSerializer):
    class Meta:
        model = TicketTemplate
        fields = ("id", "title", "description", "fields", "published", "created_at", "updated_at")


class TicketTemplateWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = TicketTemplate
        fields = ("title", "description", "fields", "published")


class TicketSerializer(serializers.ModelSerializer):
    templateId = serializers.IntegerField(source="template_id", read_only=True)
    templateTitle = serializers.CharField(source="template_title", read_only=True)
    subject = serializers.CharField(source="template_title", read_only=True)
    createdAt = serializers.DateTimeField(source="created_at", read_only=True)
    updatedAt = serializers.DateTimeField(source="updated_at", read_only=True)
    assignedTo = serializers.SerializerMethodField()
    student = serializers.SerializerMethodField()

    class Meta:
        model = Ticket
        fields = (
            "id",
            "templateId",
            "templateTitle",
            "subject",
            "data",
            "images",
            "status",
            "assignedTo",
            "student",
            "createdAt",
            "updatedAt",
        )

    def get_assignedTo(self, obj):
        if not obj.assigned_to:
            return None
        return getattr(obj.assigned_to, "email", None) or None

    def get_student(self, obj):
        u = obj.student
        name = " ".join([str(getattr(u, "last_name", "")).strip(), str(getattr(u, "first_name", "")).strip(), str(getattr(u, "patronymic", "")).strip()]).strip()
        if not name:
            name = getattr(u, "email", "") or ""
        return {"name": name, "email": getattr(u, "email", "")}


class TicketCreateSerializer(serializers.ModelSerializer):
    templateId = serializers.PrimaryKeyRelatedField(source="template", queryset=TicketTemplate.objects.all())
    data = serializers.JSONField(required=False)
    images = serializers.JSONField(required=False)

    class Meta:
        model = Ticket
        fields = ("templateId", "data", "images")

    def validate_template(self, tpl):
        request = self.context.get("request")
        scope_university = getattr(request, "university", None) if request else None
        user = getattr(request, "user", None)
        user_university_id = getattr(user, "university_id", None) if user and user.is_authenticated else None

        if scope_university is not None:
            if tpl.university_id != scope_university.id:
                raise serializers.ValidationError("Шаблон недоступен для этого университета.")
        else:
            if tpl.university_id is not None and tpl.university_id != user_university_id:
                raise serializers.ValidationError("Шаблон недоступен для вашего университета.")

        if not _can_manage_tickets(user) and not tpl.published:
            raise serializers.ValidationError("Шаблон скрыт.")
        return tpl

    def create(self, validated_data):
        request = self.context.get("request")
        user = getattr(request, "user", None)
        tpl = validated_data.get("template")
        scope_university = getattr(request, "university", None) if request else None
        university = tpl.university if tpl and tpl.university_id is not None else scope_university
        if university is None and user and user.is_authenticated and getattr(user, "university_id", None):
            university = user.university

        return Ticket.objects.create(
            university=university,
            template=tpl,
            template_title=str(getattr(tpl, "title", "") or "").strip() or "",
            student=user,
            data=validated_data.get("data") or {},
            images=validated_data.get("images") or [],
            status=TicketStatus.SUBMITTED,
            assigned_to=None,
        )
