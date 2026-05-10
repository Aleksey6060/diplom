from django.core.exceptions import ValidationError
from django.conf import settings

from shared_modules.enums import AccountType


def validate_is_student(user):
    if user.account_type != AccountType.STUDENT:
        raise ValidationError("Документы можно прикрепить только для студента")

def validate_file_size(file):
    limit_bytes = settings.SIZE_UNITS[settings.FILE_SIZE_LIMIT_UNIT] * settings.FILE_SIZE_LIMIT
    if file.size > limit_bytes:
        raise ValidationError(
            f"Превышен лимит размера файла в {settings.FILE_SIZE_LIMIT}{settings.FILE_SIZE_LIMIT_UNIT}"
        )
