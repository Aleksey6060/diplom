from rest_framework import permissions


class HasAppPermission(permissions.BasePermission):

    message = "Недостаточно прав для выполнения действия."

    def __init__(self, permission_code=None):
        if permission_code is None:
            self.permission_codes = None
        elif isinstance(permission_code, (list, tuple, set, frozenset)):
            self.permission_codes = set(permission_code)
        else:
            self.permission_codes = {permission_code}

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False

        if not self.permission_codes:
            return True

        # Если account_type == OWNER (глобальный владелец) — полный доступ
        if user.account_type == "owner":
            return True

        # owner ВУЗа — полный доступ внутри своего ВУЗа
        university = getattr(request, "university", None)
        if university is not None and university.owner_id == user.id:
            return True

        # university_owner на глобальных эндпоинтах — доступ к своим данным
        if user.account_type == "university_owner" and university is None:
            return True

        # Сотрудник ВУЗа не может лазить в чужой ВУЗ
        user_university_id = getattr(user, "university_id", None)
        if university is not None and user_university_id is not None:
            if university.id != user_university_id:
                return False

        # Проверяем наличие хотя бы одного из указанных кодов в роли пользователя
        if hasattr(user, "get_permission_codes"):
            user_codes = user.get_permission_codes()
        else:
            user_codes = user.get_permission_code()

        # "*" означает все права (superuser-like через роль)
        if "*" in user_codes:
            return True

        return bool(user_codes & self.permission_codes)
