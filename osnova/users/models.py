from django.contrib.auth.base_user import AbstractBaseUser
from django.contrib.auth.models import AbstractUser, PermissionsMixin
from django.core.exceptions import ValidationError
from django.db import models
from django.utils import timezone
from django.utils.translation import gettext_lazy as _
from django.utils.text import slugify


from users.managers import UserManager
from osnova import settings
from shared_modules.enums import AccountType
from .managers import UserManager
from .validators import validate_file_size, validate_is_student


def user_avatar_upload_to(instance, filename):
    user_part = instance.pk or "new"
    return f"users/avatars/{user_part}/{filename}"


class TimeStampedModel(models.Model):
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Дата создания")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="Дата обновления")

    class Meta:
        abstract = True


class PermissionModule(TimeStampedModel):
    """
    Вкладка / раздел интерфейса.
    Пример:
    - store_settings
    - courses
    - employees
    """

    code = models.CharField(max_length=100, unique=True, verbose_name="Код")
    title = models.CharField(max_length=255, verbose_name="Название")
    position = models.PositiveIntegerField(default=0, verbose_name="Позиция")
    allow_partial_permissions = models.BooleanField(default=True, verbose_name="Разрешать частичные права")
    is_active = models.BooleanField(default=True, verbose_name="Активен")

    class Meta:
        ordering = ("position", "id")
        verbose_name = "Модуль прав"
        verbose_name_plural = "Модули прав"

    def __str__(self):
        return self.title


class PermissionAction(TimeStampedModel):
    """
    Конкретное действие внутри вкладки.
    Пример:
    - courses.folder.create
    - courses.tests.edit
    """

    module = models.ForeignKey(
        PermissionModule,
        on_delete=models.CASCADE,
        related_name="actions",
        verbose_name="Модуль",
    )
    code = models.CharField(max_length=150, unique=True, verbose_name="Код")
    title = models.CharField(max_length=255, verbose_name="Название")
    description = models.TextField(blank=True, verbose_name="Описание")
    position = models.PositiveIntegerField(default=0, verbose_name="Позиция")
    is_active = models.BooleanField(default=True, verbose_name="Активен")

    class Meta:
        ordering = ("module__position", "position", "id")
        verbose_name = "Действие"
        verbose_name_plural = "Действия"
        constraints = [
            models.UniqueConstraint(
                fields=["module", "title"],
                name="uq_permission_action_module_title",
            ),
        ]

    def __str__(self):
        return f"{self.module.code} -> {self.title}"


class Role(TimeStampedModel):
    """
    Роль сотрудника.
    Пример:
    - Контент-менеджер
    - Куратор
    - Менеджер оплаты
    """

    university = models.ForeignKey(
        "universities.University",
        on_delete=models.CASCADE,
        related_name="roles",
        null=True,
        blank=True,
        verbose_name="ВУЗ",
    )
    name = models.CharField(max_length=150, verbose_name="Название")
    slug = models.SlugField(max_length=170, blank=True, allow_unicode=True, verbose_name="Слаг")
    description = models.TextField(blank=True, verbose_name="Описание")
    is_system = models.BooleanField(default=False, verbose_name="Системная")
    is_active = models.BooleanField(default=True, verbose_name="Активна")

    permissions = models.ManyToManyField(
        PermissionAction,
        through="RolePermission",
        related_name="roles",
        blank=True,
        verbose_name="Права",
    )

    class Meta:
        ordering = ("name", "id")
        verbose_name = "Роль"
        verbose_name_plural = "Роли"
        constraints = [
            models.UniqueConstraint(
                fields=["university", "name"],
                name="uq_role_university_name",
            ),
            models.UniqueConstraint(
                fields=["university", "slug"],
                name="uq_role_university_slug",
            ),
            models.UniqueConstraint(
                fields=["name"],
                condition=models.Q(university__isnull=True),
                name="uq_role_nulluniversity_name",
            ),
            models.UniqueConstraint(
                fields=["slug"],
                condition=models.Q(university__isnull=True),
                name="uq_role_nulluniversity_slug",
            ),
        ]

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        if not self.slug:
            base_slug = slugify(self.name, allow_unicode=True)[:160] or "role"
            slug = base_slug
            counter = 1
            qs = Role.objects.filter(slug=slug, university=self.university)
            while qs.exclude(pk=self.pk).exists():
                slug = f"{base_slug}-{counter}"
                counter += 1
                qs = Role.objects.filter(slug=slug, university=self.university)
            self.slug = slug
        return super().save(*args, **kwargs)


class RolePermission(TimeStampedModel):
    role = models.ForeignKey(
        Role,
        on_delete=models.CASCADE,
        related_name="role_permissions",
        verbose_name="Роль",
    )
    permission = models.ForeignKey(
        PermissionAction,
        on_delete=models.CASCADE,
        related_name="permission_roles",
        verbose_name="Разрешение",
    )

    class Meta:
        ordering = ("role_id", "permission__module__position", "permission__position", "id")
        verbose_name = "Разрешение роли"
        verbose_name_plural = "Разрешения ролей"
        constraints = [
            models.UniqueConstraint(
                fields=["role", "permission"],
                name="uq_role_permission",
            ),
        ]

    def __str__(self):
        return f"{self.role.name} -> {self.permission.code}"


class User(AbstractBaseUser, PermissionsMixin):
    email = models.EmailField(unique=True, verbose_name="Электронная почта")

    first_name = models.CharField(max_length=150, blank=True, verbose_name="Имя")
    last_name = models.CharField(max_length=150, blank=True, verbose_name="Фамилия")
    middle_name = models.CharField(max_length=150, blank=True, verbose_name="Отчество")

    avatar = models.ImageField(upload_to=user_avatar_upload_to, null=True, blank=True, verbose_name="Аватар")
    phone = models.CharField(max_length=32, null=True, blank=True, verbose_name="Телефон")

    account_type = models.CharField(
        max_length=20,
        choices=AccountType.choices,
        default=AccountType.STUDENT,
        db_index=True,
        verbose_name="Тип аккаунта",
    )
    role = models.ForeignKey(
        Role,
        on_delete=models.SET_NULL,
        related_name="users",
        null=True,
        blank=True,
        verbose_name="Роль",
    )

    must_change_password = models.BooleanField(default=False, verbose_name="Требуется смена пароля")

    university = models.ForeignKey(
        "universities.University",
        on_delete=models.CASCADE,
        related_name="users",
        null=True,
        blank=True,
        verbose_name="ВУЗ",
    )

    appearance_theme = models.ForeignKey(
        "universities.AppearanceTheme",
        on_delete=models.SET_NULL,
        related_name="selected_users",
        null=True,
        blank=True,
        verbose_name="Тема оформления пользователя",
    )

    created_by = models.ForeignKey(
        "self",
        on_delete=models.SET_NULL,
        related_name="created_accounts",
        null=True,
        blank=True,
        verbose_name="Создал",
    )

    is_staff = models.BooleanField(
        "Сотрудник",
        default=False,
        help_text="Определяет, может ли пользователь входить в административную часть сайта.",
    )
    is_active = models.BooleanField(
        "Активен",
        default=True,
        help_text="Определяет, считается ли пользователь активным. Отключайте это вместо удаления аккаунта.",
    )
    date_joined = models.DateTimeField("Дата регистрации", default=timezone.now)

    EMAIL_FIELD = "email"
    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = []

    objects = UserManager()

    class Meta(AbstractUser.Meta):
        verbose_name = "Пользователь"
        verbose_name_plural = "Пользователи"
        ordering = ("id",)
        indexes = [
            models.Index(fields=["account_type", "is_active"]),
            models.Index(fields=["role", "is_active"]),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["phone"],
                condition=models.Q(phone__isnull=False),
                name="phone_uniq"
                ),
        ]

    def __str__(self):
        return self.display_name

    def get_full_name(self):
        """
        Return the first_name plus the last_name, with a space in between.
        """
        full_name = "%s %s %s" % (self.first_name, self.last_name, self.middle_name)
        return full_name.strip()

    def get_short_name(self):
        """Return the short name for the user."""
        return self.first_name

    @property
    def display_name(self):
        parts = [self.last_name, self.first_name, self.middle_name]
        full_name = " ".join(part for part in parts if part).strip()
        return full_name

    def clean(self):
        super().clean()
        self.email = self.__class__.objects.normalize_email(self.email)

        if self.account_type == AccountType.EMPLOYEE and not self.role_id:
            raise ValidationError({
                "role": "Для сотрудника обязательно нужно указать роль."
            })

        if self.account_type != AccountType.EMPLOYEE and self.role_id:
            raise ValidationError({
                "role": "Роль назначается только сотрудникам."
            })

    def get_permission_codes(self):
        if not self.is_authenticated or not self.is_active:
            return set()

        if self.is_superuser or self.account_type == AccountType.OWNER:
            return {"*"}

        if not self.role_id or not self.role or not self.role.is_active:
            return set()

        if hasattr(self, "_permission_codes_cache"):
            return self._permission_codes_cache

        codes = set(
            self.role.permissions.filter(
                is_active=True,
                module__is_active=True,
            ).values_list("code", flat=True)
        )
        self._permission_codes_cache = codes
        return codes

    def has_app_permission(self, permission_code: str) -> bool:
        permission_codes = self.get_permission_codes()
        return "*" in permission_codes or permission_code in permission_codes


def student_file_upload_to(instance, filename):
    return f"students/{instance.user.pk}/{filename}"


class FilesProfile(TimeStampedModel):
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        validators=[validate_is_student],
        verbose_name="Студент",
    )
    name = models.CharField(max_length=100, verbose_name="Название")
    file = models.FileField(
        upload_to=student_file_upload_to,
        storage=settings.protected_storage,
        validators=[validate_file_size],
        verbose_name="Файл",
    )

    class Meta:
        verbose_name = "Файл профиля"
        verbose_name_plural = "Файлы профиля"
