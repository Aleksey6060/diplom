import secrets

from django.contrib.auth.models import UserManager as DjangoUserManager
from django.contrib.auth.hashers import make_password
from django.utils import timezone

from users.enums import AccountType
from shared_modules.enums import AccountType


class UserManager(DjangoUserManager):
    use_in_migrations = True

    def get_by_natural_key(self, username):
        username = (username or "").strip()
        if not username:
            return super().get_by_natural_key(username)
        return self.get(**{f"{self.model.USERNAME_FIELD}__iexact": username})

    def _create_user_object(self, email, password, **extra_fields):
        if not email:
            raise ValueError("Необходимо указать email.")
        email = self.normalize_email(email).lower()
        user = self.model(email=email, **extra_fields)
        user.password = make_password(password)
        return user

    def _create_user(self, email, password, **extra_fields):
        """
        Create and save a user with the given username, email, and password.
        """
        user = self._create_user_object(email, password, **extra_fields)
        user.save(using=self._db)
        return user

    async def _acreate_user(self, email, password, **extra_fields):
        """See _create_user()"""
        user = self._create_user_object(email, password, **extra_fields)
        await user.asave(using=self._db)
        return user

    def create_user(self, email, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", False)
        extra_fields.setdefault("is_superuser", False)
        return self._create_user(email, password, **extra_fields)

    create_user.alters_data = True

    async def acreate_user(self, email, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", False)
        extra_fields.setdefault("is_superuser", False)
        return await self._acreate_user(email, password, **extra_fields)

    acreate_user.alters_data = True

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        extra_fields.setdefault("account_type", "owner")
        extra_fields.setdefault("must_change_password", False)

        if extra_fields.get("is_staff") is not True:
            raise ValueError("Суперпользователь должен иметь is_staff=True.")
        if extra_fields.get("is_superuser") is not True:
            raise ValueError("Суперпользователь должен иметь is_superuser=True.")

        return self._create_user(email, password, **extra_fields)

    create_superuser.alters_data = True

    async def acreate_superuser(
        self, email, password=None, **extra_fields
    ):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        extra_fields.setdefault("account_type", "owner")
        extra_fields.setdefault("must_change_password", False)

        if extra_fields.get("is_staff") is not True:
            raise ValueError("Суперпользователь должен иметь is_staff=True.")
        if extra_fields.get("is_superuser") is not True:
            raise ValueError("Суперпользователь должен иметь is_superuser=True.")

        return await self._acreate_user(email, password, **extra_fields)

    acreate_superuser.alters_data = True

    def create_employee_account(self, *, role, email, password=None, **extra_fields):
        if role is None:
            raise ValueError("Для сотрудника обязательно нужно указать роль.")

        email = self.normalize_email(email).lower()
        raw_password = password or secrets.token_urlsafe(10)

        user = self.model(
            email=email,
            account_type=AccountType.EMPLOYEE,
            role=role,
            **extra_fields,
        )
        user.set_password(raw_password)
        user.password_changed_at = timezone.now()
        user.must_change_password = password is None
        user.save(using=self._db)

        user._generated_password = raw_password if password is None else None
        return user

    def create_student_account(self, *, email, password=None, **extra_fields):
        """
        Позже это можно вызывать из оплаты/покупки курса.
        """
        email = self.normalize_email(email).lower()
        raw_password = password or secrets.token_urlsafe(10)

        user = self.model(
            email=email,
            account_type=AccountType.STUDENT,
            **extra_fields,
        )
        user.set_password(raw_password)
        user.password_changed_at = timezone.now()
        user.must_change_password = password is None
        user.save(using=self._db)

        user._generated_password = raw_password if password is None else None
        return user
