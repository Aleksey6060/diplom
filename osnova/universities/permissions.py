from rest_framework import permissions


class IsUniversityOwner(permissions.BasePermission):
    """
    Разрешает доступ только управляющему ВУЗа.
    """
    message = "Только управляющий ВУЗа имеет доступ к этому действию."

    def has_permission(self, request, view):
        university = getattr(request, "university", None)
        if university is None:
            return True
        return request.user.is_authenticated and (
            request.user.is_superuser or university.owner_id == request.user.id
        )

    def has_object_permission(self, request, view, obj):
        if hasattr(obj, "owner_id"):
            return request.user.is_superuser or obj.owner_id == request.user.id
        return True


class IsUniversityMember(permissions.BasePermission):
    """
    Разрешает доступ пользователям, принадлежащим к данному ВУЗу,
    или управляющему ВУЗа.
    """
    message = "Вы не являетесь участником данного ВУЗа."

    def has_permission(self, request, view):
        university = getattr(request, "university", None)
        if university is None:
            return True
        if not request.user.is_authenticated:
            return False
        if request.user.is_superuser:
            return True
        if university.owner_id == request.user.id:
            return True
        return request.user.university_id == university.id
