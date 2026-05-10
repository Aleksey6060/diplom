from django.contrib.auth import authenticate
from django.contrib.auth.password_validation import validate_password
from django.db import transaction
from django.db.models import Prefetch
from django.urls import reverse
from django.utils import timezone
from rest_framework import serializers
from rest_framework.exceptions import ValidationError
from groups.serializers import StudentGroupsSerializer

from shared_modules.enums import AccountType
from universities.models import AppearanceTheme
from .models import (
    FilesProfile,
    PermissionAction,
    PermissionModule,
    Role,
    User,
)


def build_permission_modules_payload(*, granted_action_ids=None, grant_all=False):
    granted_action_ids = set(granted_action_ids or [])

    modules = PermissionModule.objects.filter(is_active=True).prefetch_related(
        Prefetch(
            "actions",
            queryset=PermissionAction.objects.filter(is_active=True).order_by("position", "id"),
        )
    ).order_by("position", "id")

    result = []
    for module in modules:
        actions_payload = []
        has_access = False

        for action in module.actions.all():
            granted = grant_all or (action.id in granted_action_ids)
            if granted:
                has_access = True

            actions_payload.append({
                "id": action.id,
                "code": action.code,
                "title": action.title,
                "description": action.description,
                "position": action.position,
                "granted": granted,
            })

        result.append({
            "id": module.id,
            "code": module.code,
            "title": module.title,
            "position": module.position,
            "allow_partial_permissions": module.allow_partial_permissions,
            "has_access": grant_all or has_access,
            "actions": actions_payload,
        })

    return result


class PermissionActionReadSerializer(serializers.ModelSerializer):
    class Meta:
        model = PermissionAction
        fields = (
            "id",
            "code",
            "title",
            "description",
            "position",
        )


class PermissionModuleReadSerializer(serializers.ModelSerializer):
    actions = PermissionActionReadSerializer(many=True, read_only=True)

    class Meta:
        model = PermissionModule
        fields = (
            "id",
            "code",
            "title",
            "position",
            "allow_partial_permissions",
            "actions",
        )


class RoleShortSerializer(serializers.ModelSerializer):
    class Meta:
        model = Role
        fields = ("id", "name", "slug")


class RoleListSerializer(serializers.ModelSerializer):
    user_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Role
        fields = (
            "id",
            "name",
            "slug",
            "description",
            "is_system",
            "is_active",
            "user_count",
        )


class RoleReadSerializer(serializers.ModelSerializer):
    permission_codes = serializers.SerializerMethodField()
    modules = serializers.SerializerMethodField()

    class Meta:
        model = Role
        fields = (
            "id",
            "name",
            "slug",
            "description",
            "is_system",
            "is_active",
            "permission_codes",
            "modules",
        )

    def get_permission_codes(self, obj):
        return list(
            obj.permissions.filter(
                is_active=True,
                module__is_active=True,
            ).order_by("module__position", "position", "id").values_list("code", flat=True)
        )

    def get_modules(self, obj):
        granted_action_ids = list(
            obj.permissions.filter(
                is_active=True,
                module__is_active=True,
            ).values_list("id", flat=True)
        )
        return build_permission_modules_payload(granted_action_ids=granted_action_ids)


class RoleWriteSerializer(serializers.ModelSerializer):
    permission_codes = serializers.ListField(
        child=serializers.CharField(),
        write_only=True,
        required=False,
    )

    class Meta:
        model = Role
        fields = (
            "id",
            "name",
            "slug",
            "description",
            "is_active",
            "permission_codes",
        )
        read_only_fields = ("id", "slug")

    def validate_permission_codes(self, value):
        unique_codes = list(dict.fromkeys(value))

        permissions = list(
            PermissionAction.objects.select_related("module").filter(
                code__in=unique_codes,
                is_active=True,
                module__is_active=True,
            )
        )
        permissions_map = {permission.code: permission for permission in permissions}
        missing_codes = [code for code in unique_codes if code not in permissions_map]

        if missing_codes:
            raise serializers.ValidationError(
                f"Неизвестные permission codes: {', '.join(missing_codes)}"
            )

        permissions_ordered = [permissions_map[code] for code in unique_codes]

        modules_map = {}
        for permission in permissions_ordered:
            modules_map.setdefault(permission.module_id, []).append(permission)

        for module_id, selected_permissions in modules_map.items():
            module = selected_permissions[0].module
            if not module.allow_partial_permissions:
                total_active_in_module = PermissionAction.objects.filter(
                    module_id=module_id,
                    is_active=True,
                ).count()
                if len(selected_permissions) != total_active_in_module:
                    raise serializers.ValidationError(
                        f"Для модуля '{module.title}' нужно либо выдать весь доступ, либо не выдавать вообще."
                    )

        self._validated_permissions = permissions_ordered
        return unique_codes

    @transaction.atomic
    def create(self, validated_data):
        validated_data.pop("permission_codes", None)
        permissions = getattr(self, "_validated_permissions", [])
        role = Role.objects.create(**validated_data)
        if permissions:
            role.permissions.set(permissions)
        return role

    @transaction.atomic
    def update(self, instance, validated_data):
        permission_codes_passed = "permission_codes" in self.initial_data
        validated_data.pop("permission_codes", None)
        permissions = getattr(self, "_validated_permissions", None)

        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        if permission_codes_passed:
            instance.permissions.set(permissions or [])

        return instance

    def to_representation(self, instance):
        return RoleReadSerializer(instance, context=self.context).data


class UserProfileSerializer(serializers.ModelSerializer):
    display_name = serializers.CharField(read_only=True)
    account_type_display = serializers.CharField(source="get_account_type_display", read_only=True)
    role = RoleShortSerializer(read_only=True)
    appearance_theme = serializers.PrimaryKeyRelatedField(
        queryset=AppearanceTheme.objects.all(),
        required=False,
        allow_null=True,
    )
    appearance_theme_name = serializers.CharField(
        source="appearance_theme.name",
        read_only=True,
        default=None,
    )
    university_id = serializers.IntegerField(source="university.id", read_only=True, default=None)
    university_slug = serializers.CharField(source="university.slug", read_only=True, default=None)
    university_name = serializers.CharField(source="university.name", read_only=True, default=None)

    class Meta:
        model = User
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
            "account_type_display",
            "role",
            "appearance_theme",
            "appearance_theme_name",
            "university_id",
            "university_slug",
            "university_name",
            "must_change_password",
            "date_joined",
        )
        read_only_fields = (
            "id",
            "display_name",
            "account_type",
            "account_type_display",
            "role",
            "university_id",
            "university_slug",
            "university_name",
            "must_change_password",
            "date_joined",
        )

    def validate_appearance_theme(self, value):
        if value is None:
            return None

        request = self.context.get("request")
        user = getattr(request, "user", None)
        account_type = getattr(user, "account_type", None) if user and user.is_authenticated else None
        can_manage = account_type in (AccountType.OWNER, AccountType.UNIVERSITY_OWNER, AccountType.EMPLOYEE) or getattr(user, "is_superuser", False)

        if not can_manage and not value.published:
            raise serializers.ValidationError("Эта тема скрыта.")

        user_university_id = getattr(user, "university_id", None)
        if value.university_id is not None and value.university_id != user_university_id:
            raise serializers.ValidationError("Эта тема недоступна для вашего университета.")

        return value


class UserAccessSerializer(serializers.Serializer):
    user = serializers.SerializerMethodField()
    role = serializers.SerializerMethodField()
    modules = serializers.SerializerMethodField()

    def get_user(self, obj):
        return UserProfileSerializer(obj, context=self.context).data

    def get_role(self, obj):
        if obj.is_superuser or obj.account_type == AccountType.OWNER:
            return {
                "id": None,
                "name": "Главный пользователь",
                "slug": "owner",
            }
        if obj.role_id:
            return RoleShortSerializer(obj.role, context=self.context).data
        return None

    def get_modules(self, obj):
        grant_all = obj.is_superuser or obj.account_type == AccountType.OWNER
        granted_action_ids = []

        if obj.role_id and obj.role and obj.role.is_active:
            granted_action_ids = list(
                obj.role.permissions.filter(
                    is_active=True,
                    module__is_active=True,
                ).values_list("id", flat=True)
            )

        return build_permission_modules_payload(
            granted_action_ids=granted_action_ids,
            grant_all=grant_all,
        )


class StaffUserListSerializer(serializers.ModelSerializer):
    display_name = serializers.CharField(read_only=True)
    account_type_display = serializers.CharField(source="get_account_type_display", read_only=True)
    role = RoleShortSerializer(read_only=True)

    class Meta:
        model = User
        fields = (
            "id",
            "display_name",
            "email",
            "phone",
            "avatar",
            "account_type",
            "account_type_display",
            "role",
            "is_active",
        )


class StaffUserReadSerializer(serializers.ModelSerializer):
    display_name = serializers.CharField(read_only=True)
    account_type_display = serializers.CharField(source="get_account_type_display", read_only=True)
    role = RoleShortSerializer(read_only=True)
    temporary_password = serializers.SerializerMethodField()

    class Meta:
        model = User
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
            "account_type_display",
            "role",
            "is_active",
            "must_change_password",
            "temporary_password",
            "date_joined",
        )

    def get_temporary_password(self, obj):
        return getattr(obj, "_generated_password", None)


class StaffUserCreateSerializer(serializers.ModelSerializer):
    role = serializers.PrimaryKeyRelatedField(
        queryset=Role.objects.filter(is_active=True),
    )
    password = serializers.CharField(write_only=True, required=False, allow_blank=False)

    class Meta:
        model = User
        fields = (
            "id",
            "password",
            "first_name",
            "last_name",
            "middle_name",
            "email",
            "phone",
            "avatar",
            "role",
            "is_active",
        )
        read_only_fields = ("id",)

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        request = self.context.get("request") if hasattr(self, "context") else None
        university = getattr(request, "university", None) if request is not None else None
        if university is not None:
            self.fields["role"].queryset = Role.objects.filter(
                is_active=True, university=university
            )

    def validate_email(self, value):
        return (value or "").strip().lower()

    @transaction.atomic
    def create(self, validated_data):
        password = validated_data.pop("password", None)
        role = validated_data.pop("role")
        request = self.context["request"]
        creator = request.user
        university = getattr(request, "university", None)

        user = User.objects.create_employee_account(
            role=role,
            password=password,
            created_by=creator,
            university=university,
            **validated_data,
        )

        if password:
            user._generated_password = None

        return user

    def to_representation(self, instance):
        return StaffUserReadSerializer(instance, context=self.context).data


class StaffUserUpdateSerializer(serializers.ModelSerializer):
    role = serializers.PrimaryKeyRelatedField(
        queryset=Role.objects.filter(is_active=True),
        required=False,
        allow_null=True,
    )
    password = serializers.CharField(write_only=True, required=False, allow_blank=False)

    class Meta:
        model = User
        fields = (
            "password",
            "first_name",
            "last_name",
            "middle_name",
            "email",
            "phone",
            "avatar",
            "role",
            "is_active",
        )

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        request = self.context.get("request") if hasattr(self, "context") else None
        university = getattr(request, "university", None) if request is not None else None
        if university is not None:
            self.fields["role"].queryset = Role.objects.filter(
                is_active=True, university=university
            )

    def validate_email(self, value):
        return (value or "").strip().lower()

    @transaction.atomic
    def update(self, instance, validated_data):
        password = validated_data.pop("password", None)

        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        if password:
            instance.set_password(password)
            instance.must_change_password = True

        instance.save()
        return instance

    def to_representation(self, instance):
        return StaffUserReadSerializer(instance, context=self.context).data


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField(required=True)
    password = serializers.CharField(required=True)

    def validate(self, attrs):
        email = attrs.get("email")
        password = attrs.get("password")

        if not (email and password):
            raise ValidationError(
                "Необходимо передать email и пароль."
            )

        email = email.strip().lower()
        user = authenticate(
            request=self.context.get("request"),
            username=email,
            password=password
        )

        if not user or not user.is_active:
            raise ValidationError(
                "Пользователь не найден или деактивирован."
            )

        attrs['user'] = user
        return attrs


class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField(write_only=True, required=True)
    new_password = serializers.CharField(write_only=True, required=True)
    confirm_password = serializers.CharField(write_only=True, required=True)

    def validate_old_password(self, value):
        user = self.context['request'].user
        if not user.check_password(value):
            raise serializers.ValidationError("Старый пароль неверен")
        return value

    def validate(self, attrs):
        if attrs['new_password'] != attrs['confirm_password']:
            raise serializers.ValidationError("Пароли не совпадают")

        validate_password(attrs['new_password'])
        return attrs


class StudentSerializer(UserProfileSerializer):
    email = serializers.EmailField(required=True) # чтобы убрать проверку на уникальность
    group = serializers.CharField(required=False, default=None, allow_blank=True, allow_null=True)
    password = serializers.CharField(write_only=True, required=True)

    class Meta(UserProfileSerializer.Meta):
        fields = UserProfileSerializer.Meta.fields + ("password", "group")
        read_only_fields = UserProfileSerializer.Meta.read_only_fields

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

        if self.instance is not None:
            self.fields.pop("password")

    def validate_email(self, value):
        email = (value or "").strip().lower()
        view = self.context.get("view")
        if getattr(view, "action", None) == "many_create":
            return email
        qs = User.objects.filter(email=email)
        if self.instance is not None and getattr(self.instance, "pk", None):
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError("Пользователь с таким email уже существует.")
        return email

    def validate_group(self, value):
        v = "" if value is None else str(value)
        v = v.strip()
        return v or None

    def to_representation(self, instance):
        rep = super().to_representation(instance)

        rep["group"] = StudentGroupsSerializer(instance.membership.group).data \
            if getattr(instance, "membership", None) and instance.membership.group else None

        return rep


class FilesProfileSerializer(serializers.ModelSerializer):

    class Meta:
        model = FilesProfile
        fields = "__all__"
        read_only_fields = ("id", "user")

    def to_representation(self, instance):
        rep = super().to_representation(instance)

        request = self.context.get('request')
        view_name = f"{request.resolver_match.namespace}:student-files-detail" # переопределяем стандартный путь файла с media на наш endpoint

        rep["file"] = reverse(
                viewname=view_name,
                kwargs={
                    'student_id': instance.user_id,
                    'pk': instance.id
                }
        )
        return rep


class StaffProfileSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=True, allow_blank=False)
    display_name = serializers.CharField(read_only=True)
    is_superuser = serializers.BooleanField(read_only=True)
    account_type_display = serializers.CharField(source="get_account_type_display", read_only=True)
    account_type = serializers.ChoiceField(
        choices=[
            AccountType.TEACHER,
            AccountType.EMPLOYEE
        ]
    )

    class Meta:
        model = User
        fields = (
            "id",
            "display_name",
            "is_superuser",
            "first_name",
            "last_name",
            "middle_name",
            "email",
            "phone",
            "avatar",
            "account_type",
            "account_type_display",
            "role",
            "date_joined",
            "password",
        )
        read_only_fields = (
            "id",
            "display_name",
            "account_type_display",
            "date_joined",
        )
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

        if self.instance is not None:
            self.fields.pop("password")
    
    def validate_email(self, value):
        return (value or "").strip().lower()

    @transaction.atomic
    def update(self, instance, validated_data):
        password = validated_data.pop("password", None)

        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        if password:
            instance.set_password(password)
            instance.must_change_password = True
            if hasattr(instance, "password_changed_at"):
                instance.password_changed_at = timezone.now()

        instance.save()
        return instance
