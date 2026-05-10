from rest_framework import permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet, ViewSet

from shared_modules.enums import AccountType
from .models import AppearanceSettings, AppearanceTheme
from .serializers import (
    AppearanceSettingsSerializer,
    AppearanceSettingsWriteSerializer,
    AppearanceThemeSerializer,
)


def _get_scope_university(request):
    return getattr(request, "university", None)


def _can_manage_appearance(user):
    if not user or not user.is_authenticated:
        return False
    account_type = getattr(user, "account_type", None)
    return account_type in (AccountType.OWNER, AccountType.UNIVERSITY_OWNER, AccountType.EMPLOYEE)


class AppearanceSettingsViewSet(ViewSet):
    """
    /api/appearance/settings/
    /api/u/<university_slug>/appearance/settings/
    """

    def get_permissions(self):
        if self.request.method == "GET":
            return [permissions.AllowAny()]
        return [permissions.IsAuthenticated()]

    def retrieve(self, request):
        university = _get_scope_university(request)
        obj = AppearanceSettings.objects.filter(university=university).first()
        if not obj:
            return Response(
                {"id": None, "university": university.id if university else None, "settings": {}, "updated_at": None}
            )
        return Response(AppearanceSettingsSerializer(obj).data)

    def partial_update(self, request):
        if not _can_manage_appearance(request.user):
            return Response({"detail": "Недостаточно прав."}, status=status.HTTP_403_FORBIDDEN)
        university = _get_scope_university(request)
        obj = AppearanceSettings.objects.filter(university=university).first()
        serializer = AppearanceSettingsWriteSerializer(
            instance=obj, data=request.data, partial=True
        )
        serializer.is_valid(raise_exception=True)
        saved = serializer.save(university=university)
        return Response(AppearanceSettingsSerializer(saved).data)

    def update(self, request):
        return self.partial_update(request)


class AppearanceThemeViewSet(ModelViewSet):
    serializer_class = AppearanceThemeSerializer
    queryset = AppearanceTheme.objects.select_related("university", "created_by")

    def get_permissions(self):
        if self.request.method == "GET":
            return [permissions.AllowAny()]
        return [permissions.IsAuthenticated()]

    def get_queryset(self):
        qs = super().get_queryset()
        university = _get_scope_university(self.request)
        if university is None:
            user_university_id = getattr(getattr(self.request, "user", None), "university_id", None)
            if user_university_id:
                qs = qs.filter(university__in=[None, user_university_id])
            else:
                qs = qs.filter(university__isnull=True)
        else:
            qs = qs.filter(university=university)

        if _can_manage_appearance(self.request.user):
            return qs
        return qs.filter(published=True)

    def perform_create(self, serializer):
        if not _can_manage_appearance(self.request.user):
            raise permissions.PermissionDenied("Недостаточно прав.")
        serializer.save(
            university=_get_scope_university(self.request),
            created_by=self.request.user,
        )

    def perform_update(self, serializer):
        if not _can_manage_appearance(self.request.user):
            raise permissions.PermissionDenied("Недостаточно прав.")
        serializer.save()

    def perform_destroy(self, instance):
        if not _can_manage_appearance(self.request.user):
            raise permissions.PermissionDenied("Недостаточно прав.")
        return super().perform_destroy(instance)

    @action(methods=["POST"], detail=True)
    def publish(self, request, pk=None):
        if not _can_manage_appearance(request.user):
            return Response({"detail": "Недостаточно прав."}, status=status.HTTP_403_FORBIDDEN)
        obj = self.get_object()
        obj.published = True
        obj.save(update_fields=["published", "updated_at"])
        return Response(AppearanceThemeSerializer(obj).data)

    @action(methods=["POST"], detail=True)
    def unpublish(self, request, pk=None):
        if not _can_manage_appearance(request.user):
            return Response({"detail": "Недостаточно прав."}, status=status.HTTP_403_FORBIDDEN)
        obj = self.get_object()
        obj.published = False
        obj.save(update_fields=["published", "updated_at"])
        return Response(AppearanceThemeSerializer(obj).data)
