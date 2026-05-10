from django.conf import settings as _settings
from django.core.exceptions import ValidationError
from django.db import models
from django.utils.text import slugify


def university_logo_upload_to(instance, filename):
    return f"universities/{instance.slug or 'new'}/{filename}"


def banner_image_upload_to(instance, filename):
    if instance.university_id:
        return f"banners/u_{instance.university_id}/{filename}"
    return f"banners/global/{filename}"

def document_file_upload_to(instance, filename):
    if instance.university_id:
        return f"documents/u_{instance.university_id}/{filename}"
    return f"documents/global/{filename}"


class University(models.Model):
    name = models.CharField("Название", max_length=255, unique=True)
    slug = models.SlugField(
        max_length=270,
        unique=True,
        blank=True,
        allow_unicode=True,
        help_text="Используется в URL: domain.com/api/<slug>/...",
    )
    description = models.TextField("Описание", blank=True)
    logo = models.ImageField(
        upload_to=university_logo_upload_to,
        null=True,
        blank=True,
    )
    owner = models.ForeignKey(
        _settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="owned_universities",
        verbose_name="Управляющий",
        help_text="Пользователь с полным доступом к данному ВУЗу.",
    )
    is_active = models.BooleanField("Активен", default=True)
    expires_at = models.DateTimeField(
        "Срок использования",
        null=True,
        blank=True,
        help_text="Дата окончания срока использования ВУЗа. Информационное поле.",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("name",)
        verbose_name = "ВУЗ"
        verbose_name_plural = "ВУЗы"

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        if not self.slug:
            base_slug = slugify(self.name, allow_unicode=False)[:255] or "university"
            slug = base_slug
            counter = 1
            while University.objects.filter(slug=slug).exclude(pk=self.pk).exists():
                slug = f"{base_slug}-{counter}"
                counter += 1
            self.slug = slug
        super().save(*args, **kwargs)


class Banner(models.Model):
    """
    Баннер 16:3 — отображается у всех пользователей.

    Если university = NULL — глобальный баннер (для основного проекта).
    Если university указан — баннер конкретного ВУЗа.

    На каждый scope (global / university) может быть только один баннер.
    """

    university = models.OneToOneField(
        University,
        on_delete=models.CASCADE,
        related_name="banner",
        null=True,
        blank=True,
        verbose_name="ВУЗ",
        help_text="NULL = глобальный баннер для всего проекта",
    )
    image = models.ImageField(
        "Изображение (16:3)",
        upload_to=banner_image_upload_to,
    )
    is_active = models.BooleanField("Включен", default=True)
    uploaded_by = models.ForeignKey(
        _settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="uploaded_banners",
        verbose_name="Кто загрузил",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Баннер"
        verbose_name_plural = "Баннеры"
        constraints = [
            models.UniqueConstraint(
                fields=["university"],
                condition=models.Q(university__isnull=False),
                name="uq_banner_university",
            ),
            models.UniqueConstraint(
                fields=["id"],
                condition=models.Q(university__isnull=True),
                name="uq_banner_global_singleton",
            ),
        ]

    def __str__(self):
        if self.university_id:
            return f"Баннер ВУЗа {self.university.name}"
        return "Глобальный баннер"

    def clean(self):
        # Гарантируем, что глобальный баннер только один
        if self.university_id is None:
            qs = Banner.objects.filter(university__isnull=True)
            if self.pk:
                qs = qs.exclude(pk=self.pk)
            if qs.exists():
                raise ValidationError(
                    "Глобальный баннер уже существует. Обновите существующий вместо создания нового."
                )


class UniversityDocument(models.Model):
    university = models.ForeignKey(
        University,
        on_delete=models.CASCADE,
        related_name="documents",
        null=True,
        blank=True,
        verbose_name="ВУЗ",
        help_text="NULL = глобальные документы для всего проекта",
    )
    file = models.FileField(upload_to=document_file_upload_to)
    original_name = models.CharField(max_length=255, blank=True)
    content_type = models.CharField(max_length=255, blank=True)
    size = models.PositiveIntegerField(default=0)
    uploaded_by = models.ForeignKey(
        _settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="uploaded_documents",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("-created_at",)
        verbose_name = "Документ"
        verbose_name_plural = "Документы"

    def save(self, *args, **kwargs):
        if self.file and not self.original_name:
            self.original_name = getattr(self.file, "name", "") or ""
        if self.file and not self.size:
            try:
                self.size = int(getattr(self.file, "size", 0) or 0)
            except Exception:
                self.size = 0
        return super().save(*args, **kwargs)


class AppearanceSettings(models.Model):
    university = models.OneToOneField(
        University,
        on_delete=models.CASCADE,
        related_name="appearance",
        null=True,
        blank=True,
        verbose_name="ВУЗ",
        help_text="NULL = глобальные настройки оформления",
    )
    settings = models.JSONField(default=dict)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Настройки оформления"
        verbose_name_plural = "Настройки оформления"
        constraints = [
            models.UniqueConstraint(
                fields=["university"],
                condition=models.Q(university__isnull=False),
                name="uq_appearance_settings_university",
            ),
            models.UniqueConstraint(
                fields=["id"],
                condition=models.Q(university__isnull=True),
                name="uq_appearance_settings_global_singleton",
            ),
        ]

    def clean(self):
        if self.university_id is None:
            qs = AppearanceSettings.objects.filter(university__isnull=True)
            if self.pk:
                qs = qs.exclude(pk=self.pk)
            if qs.exists():
                raise ValidationError(
                    "Глобальные настройки оформления уже существуют. Обновите существующие вместо создания новых."
                )


class AppearanceTheme(models.Model):
    university = models.ForeignKey(
        University,
        on_delete=models.CASCADE,
        related_name="appearance_themes",
        null=True,
        blank=True,
        verbose_name="ВУЗ",
        help_text="NULL = глобальные темы",
    )
    name = models.CharField(max_length=255)
    settings = models.JSONField(default=dict)
    published = models.BooleanField(default=False)
    created_by = models.ForeignKey(
        _settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_appearance_themes",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("-updated_at", "-created_at", "-id")
        verbose_name = "Тема оформления"
        verbose_name_plural = "Темы оформления"
