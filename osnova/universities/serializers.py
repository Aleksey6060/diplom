from django.db import transaction
from rest_framework import serializers

from shared_modules.enums import AccountType
from users.models import User
from .models import University, Banner, UniversityDocument, AppearanceSettings, AppearanceTheme


class UniversityListSerializer(serializers.ModelSerializer):
    owner_display_name = serializers.CharField(source="owner.display_name", read_only=True)

    class Meta:
        model = University
        fields = (
            "id",
            "name",
            "slug",
            "description",
            "logo",
            "owner",
            "owner_display_name",
            "is_active",
            "expires_at",
            "created_at",
        )


class UniversityReadSerializer(serializers.ModelSerializer):
    owner_display_name = serializers.CharField(source="owner.display_name", read_only=True)
    users_count = serializers.IntegerField(read_only=True)
    courses_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = University
        fields = (
            "id",
            "name",
            "slug",
            "description",
            "logo",
            "owner",
            "owner_display_name",
            "is_active",
            "expires_at",
            "users_count",
            "courses_count",
            "created_at",
            "updated_at",
        )


class UniversityCreateSerializer(serializers.ModelSerializer):
    owner_email = serializers.EmailField(write_only=True)
    owner_password = serializers.CharField(write_only=True, min_length=6)
    owner_first_name = serializers.CharField(write_only=True, required=False, default="")
    owner_last_name = serializers.CharField(write_only=True, required=False, default="")

    class Meta:
        model = University
        fields = (
            "id",
            "name",
            "slug",
            "description",
            "logo",
            "is_active",
            "expires_at",
            "owner_email",
            "owner_password",
            "owner_first_name",
            "owner_last_name",
        )
        read_only_fields = ("id", "is_active")

    def validate_owner_email(self, value):
        if User.objects.filter(email=value).exists():
            raise serializers.ValidationError("Пользователь с такой электронной почтой уже существует.")
        return value

    @transaction.atomic
    def create(self, validated_data):
        owner_email = validated_data.pop("owner_email")
        owner_password = validated_data.pop("owner_password")
        owner_first_name = validated_data.pop("owner_first_name", "")
        owner_last_name = validated_data.pop("owner_last_name", "")

        owner = User.objects.create_user(
            email=owner_email,
            password=owner_password,
            first_name=owner_first_name,
            last_name=owner_last_name,
            account_type=AccountType.UNIVERSITY_OWNER,
        )

        university = University.objects.create(owner=owner, **validated_data)
        owner.university = university
        owner.save(update_fields=["university"])

        return university

    def to_representation(self, instance):
        return UniversityReadSerializer(instance, context=self.context).data


class UniversityUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = University
        fields = (
            "id",
            "name",
            "slug",
            "description",
            "logo",
            "is_active",
            "expires_at",
        )
        read_only_fields = ("id",)

    def to_representation(self, instance):
        return UniversityReadSerializer(instance, context=self.context).data


# =========================================================
# BANNER
# =========================================================

class BannerSerializer(serializers.ModelSerializer):
    uploaded_by_display_name = serializers.CharField(
        source="uploaded_by.display_name", read_only=True, default=None
    )
    university_name = serializers.CharField(
        source="university.name", read_only=True, default=None
    )

    class Meta:
        model = Banner
        fields = (
            "id",
            "university",
            "university_name",
            "image",
            "is_active",
            "uploaded_by",
            "uploaded_by_display_name",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "uploaded_by", "created_at", "updated_at")


class BannerUploadSerializer(serializers.ModelSerializer):
    class Meta:
        model = Banner
        fields = ("image", "is_active")

    def validate_image(self, value):
        # Проверяем, что это валидное изображение. Соотношение сторон не ограничиваем.
        try:
            from PIL import Image
            img = Image.open(value)
            width, height = img.size
            if height == 0:
                raise serializers.ValidationError("Некорректное изображение.")
            value.seek(0)
        except ImportError:
            pass
        except serializers.ValidationError:
            raise
        except Exception:
            raise serializers.ValidationError("Не удалось обработать изображение.")
        return value


class BannerToggleSerializer(serializers.Serializer):
    is_active = serializers.BooleanField()


class UniversityDocumentSerializer(serializers.ModelSerializer):
    uploaded_by_display_name = serializers.CharField(
        source="uploaded_by.display_name", read_only=True, default=None
    )
    university_name = serializers.CharField(
        source="university.name", read_only=True, default=None
    )

    class Meta:
        model = UniversityDocument
        fields = (
            "id",
            "university",
            "university_name",
            "file",
            "original_name",
            "content_type",
            "size",
            "uploaded_by",
            "uploaded_by_display_name",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "university",
            "uploaded_by",
            "original_name",
            "content_type",
            "size",
            "created_at",
            "updated_at",
        )


class UniversityDocumentUploadSerializer(serializers.ModelSerializer):
    class Meta:
        model = UniversityDocument
        fields = ("file",)


class AppearanceSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = AppearanceSettings
        fields = ("id", "university", "settings", "updated_at")
        read_only_fields = ("id", "university", "updated_at")


class AppearanceSettingsWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = AppearanceSettings
        fields = ("settings",)


class AppearanceThemeSerializer(serializers.ModelSerializer):
    class Meta:
        model = AppearanceTheme
        fields = (
            "id",
            "university",
            "name",
            "settings",
            "published",
            "created_by",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "university", "created_by", "created_at", "updated_at")
