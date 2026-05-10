from rest_framework import permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet

from shared_modules.enums import AccountType
from users.permissions import HasAppPermission
from .models import Ticket, TicketTemplate, TicketStatus
from .serializers import (
    TicketCreateSerializer,
    TicketSerializer,
    TicketTemplateSerializer,
    TicketTemplateWriteSerializer,
)


def _has_app_permission(request, view, permission_code):
    user = getattr(request, "user", None)
    if not user or not getattr(user, "is_authenticated", False):
        return False
    if getattr(user, "is_superuser", False):
        return True
    return HasAppPermission(permission_code).has_permission(request, view)


def _can_manage_tickets(request, view):
    user = getattr(request, "user", None)
    if not user or not getattr(user, "is_authenticated", False):
        return False
    if getattr(user, "is_superuser", False):
        return True
    account_type = getattr(user, "account_type", None)
    if account_type in (AccountType.OWNER, AccountType.UNIVERSITY_OWNER):
        return True
    return _has_app_permission(
        request,
        view,
        [
            "applications.all.view",
            "applications.take_in_work",
            "applications.templates.view",
            "applications.templates.manage",
        ],
    )


def _get_scope_university(request):
    return getattr(request, "university", None)


class TicketTemplateViewSet(ModelViewSet):
    queryset = TicketTemplate.objects.all()
    serializer_class = TicketTemplateSerializer

    def get_permissions(self):
        if self.request.method == "GET":
            return [permissions.AllowAny()]
        return [
            permissions.IsAuthenticated(),
            HasAppPermission("applications.templates.manage"),
        ]

    def get_serializer_class(self):
        if self.request.method in ("POST", "PUT", "PATCH"):
            return TicketTemplateWriteSerializer
        return TicketTemplateSerializer

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

        if _has_app_permission(
            self.request,
            self,
            ["applications.templates.view", "applications.templates.manage"],
        ):
            return qs
        return qs.filter(published=True)

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user, university=_get_scope_university(self.request))

    def perform_update(self, serializer):
        serializer.save()

    def perform_destroy(self, instance):
        return super().perform_destroy(instance)


class TicketViewSet(ModelViewSet):
    queryset = Ticket.objects.select_related("student", "assigned_to", "template").all()
    serializer_class = TicketSerializer

    def get_permissions(self):
        return [permissions.IsAuthenticated()]

    def get_queryset(self):
        qs = super().get_queryset()
        university = _get_scope_university(self.request)
        user = self.request.user
        if university is None:
            user_university_id = getattr(user, "university_id", None)
            if user_university_id:
                qs = qs.filter(university__in=[None, user_university_id])
            else:
                qs = qs.filter(university__isnull=True)
        else:
            qs = qs.filter(university=university)

        if _can_manage_tickets(self.request, self):
            return qs
        return qs.filter(student=user)

    def get_serializer_class(self):
        if self.action == "create":
            return TicketCreateSerializer
        return TicketSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        obj = serializer.save()
        return Response(TicketSerializer(obj, context={"request": request}).data, status=status.HTTP_201_CREATED)

    @action(methods=["GET"], detail=False, url_path="open")
    def open(self, request):
        if not _has_app_permission(request, self, "applications.all.view"):
            return Response({"detail": "Недостаточно прав."}, status=status.HTTP_403_FORBIDDEN)
        qs = self.get_queryset().filter(status=TicketStatus.SUBMITTED, assigned_to__isnull=True)
        return Response(TicketSerializer(qs, many=True, context={"request": request}).data)

    @action(methods=["GET"], detail=False, url_path="mine")
    def mine(self, request):
        if not _has_app_permission(request, self, "applications.all.view"):
            return Response({"detail": "Недостаточно прав."}, status=status.HTTP_403_FORBIDDEN)
        qs = self.get_queryset().filter(status=TicketStatus.IN_PROGRESS, assigned_to=request.user)
        return Response(TicketSerializer(qs, many=True, context={"request": request}).data)

    @action(methods=["GET"], detail=False, url_path="done")
    def done(self, request):
        if not _has_app_permission(request, self, "applications.all.view"):
            return Response({"detail": "Недостаточно прав."}, status=status.HTTP_403_FORBIDDEN)
        qs = self.get_queryset().filter(status=TicketStatus.DONE)
        if not (getattr(request.user, "is_superuser", False) or getattr(request.user, "account_type", None) == AccountType.OWNER):
            qs = qs.filter(assigned_to=request.user)
        return Response(TicketSerializer(qs, many=True, context={"request": request}).data)

    @action(methods=["GET"], detail=False, url_path="my")
    def my(self, request):
        qs = self.get_queryset().filter(student=request.user)
        return Response(TicketSerializer(qs, many=True, context={"request": request}).data)

    @action(methods=["POST"], detail=True, url_path="assign")
    def assign(self, request, pk=None):
        if not _has_app_permission(request, self, "applications.take_in_work"):
            return Response({"detail": "Недостаточно прав."}, status=status.HTTP_403_FORBIDDEN)
        obj = self.get_object()
        ok = obj.assign_to(request.user)
        if not ok:
            return Response({"detail": "заявка уже в обработке"}, status=status.HTTP_409_CONFLICT)
        return Response(TicketSerializer(obj, context={"request": request}).data)

    @action(methods=["POST"], detail=True, url_path="complete")
    def complete(self, request, pk=None):
        if not _has_app_permission(request, self, "applications.take_in_work"):
            return Response({"detail": "Недостаточно прав."}, status=status.HTTP_403_FORBIDDEN)
        obj = self.get_object()
        if obj.status != TicketStatus.IN_PROGRESS:
            return Response({"detail": "Нельзя завершить заявку в этом статусе."}, status=status.HTTP_400_BAD_REQUEST)
        if obj.assigned_to_id and obj.assigned_to_id != request.user.id and not (getattr(request.user, "is_superuser", False) or getattr(request.user, "account_type", None) == AccountType.OWNER):
            return Response({"detail": "Недостаточно прав."}, status=status.HTTP_403_FORBIDDEN)
        obj.status = TicketStatus.DONE
        obj.save(update_fields=["status", "updated_at"])
        return Response(TicketSerializer(obj, context={"request": request}).data)
