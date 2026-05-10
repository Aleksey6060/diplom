from django.db.models import Count
from django.shortcuts import get_object_or_404
from rest_framework import generics, permissions, status
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from users.permissions import HasAppPermission
from .models import University, Banner
from .serializers import (
    UniversityCreateSerializer,
    UniversityListSerializer,
    UniversityReadSerializer,
    UniversityUpdateSerializer,
    BannerSerializer,
    BannerUploadSerializer,
    BannerToggleSerializer,
)


class UniversityListCreateAPIView(generics.ListCreateAPIView):
    """
    GET  - список всех активных ВУЗов.
    POST - создать новый ВУЗ (нужен код universities.create).
    """
    parser_classes = (MultiPartParser, FormParser, JSONParser)

    def get_permissions(self):
        if self.request.method == "GET":
            return [HasAppPermission("universities.view")]
        return [HasAppPermission("universities.create")]

    def get_queryset(self):
        qs = University.objects.filter(is_active=True).select_related("owner").order_by("name")
        user = self.request.user
        if getattr(user, "account_type", None) == "university_owner":
            qs = qs.filter(owner=user)
        return qs

    def get_serializer_class(self):
        if self.request.method == "POST":
            return UniversityCreateSerializer
        return UniversityListSerializer


class UniversityRetrieveUpdateDestroyAPIView(generics.RetrieveUpdateDestroyAPIView):
    """
    GET    - детали ВУЗа.
    PUT/PATCH - обновить ВУЗ (universities.edit).
    DELETE - деактивировать ВУЗ (universities.delete).
    """
    parser_classes = (MultiPartParser, FormParser, JSONParser)
    lookup_field = "slug"

    def get_permissions(self):
        if self.request.method == "GET":
            return [HasAppPermission("universities.view")]
        if self.request.method in ("PUT", "PATCH"):
            return [HasAppPermission("universities.edit")]
        return [HasAppPermission("universities.delete")]

    def get_queryset(self):
        return University.objects.select_related("owner").annotate(
            users_count=Count("users", distinct=True),
            courses_count=Count("courses", distinct=True),
        )

    def get_serializer_class(self):
        if self.request.method in ("PUT", "PATCH"):
            return UniversityUpdateSerializer
        return UniversityReadSerializer

    def perform_destroy(self, instance):
        instance.is_active = False
        instance.save()


# =========================================================
# BANNER
# =========================================================

def _get_banner_scope(request):
    """
    Возвращает (university, scope_label).
    Если запрос идёт через /api/u/<slug>/... — university из request.university.
    Иначе — глобальный scope (university = None).
    """
    return getattr(request, "university", None)


class BannerCurrentAPIView(APIView):
    """
    GET /api/banner/                       — глобальный баннер.
    GET /api/u/<slug>/banner/              — баннер ВУЗа.

    Публичный эндпоинт: возвращает активный баннер для отображения у всех пользователей.
    Если баннер выключен (is_active=False) или отсутствует — возвращает 204 No Content.
    """

    permission_classes = [permissions.AllowAny]

    def get(self, request):
        university = _get_banner_scope(request)
        banner = Banner.objects.filter(
            university=university, is_active=True
        ).select_related("uploaded_by", "university").first()

        if not banner:
            return Response(status=status.HTTP_204_NO_CONTENT)

        return Response(
            BannerSerializer(banner, context={"request": request}).data
        )


class BannerManageAPIView(APIView):
    """
    GET    /api/banner/manage/                — получить баннер (включая выключенный) глобальный.
    POST   /api/banner/manage/                — загрузить / заменить баннер.
    DELETE /api/banner/manage/                — удалить баннер.

    То же для ВУЗа: /api/u/<slug>/banner/manage/

    Права:
    - GET    — IsAuthenticated;
    - POST   — banner.image.upload;
    - DELETE — banner.image.upload.
    """

    parser_classes = (MultiPartParser, FormParser, JSONParser)

    def get_permissions(self):
        if self.request.method == "GET":
            return [IsAuthenticated()]
        return [HasAppPermission("banner.image.upload")]

    def get(self, request):
        university = _get_banner_scope(request)
        banner = Banner.objects.filter(university=university).first()
        if not banner:
            return Response(status=status.HTTP_204_NO_CONTENT)
        return Response(BannerSerializer(banner, context={"request": request}).data)

    def post(self, request):
        university = _get_banner_scope(request)
        serializer = BannerUploadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        banner = Banner.objects.filter(university=university).first()

        if banner:
            # удаляем старый файл
            if banner.image:
                banner.image.delete(save=False)
            banner.image = serializer.validated_data["image"]
            if "is_active" in serializer.validated_data:
                banner.is_active = serializer.validated_data["is_active"]
            banner.uploaded_by = request.user
            banner.save()
        else:
            banner = Banner.objects.create(
                university=university,
                image=serializer.validated_data["image"],
                is_active=serializer.validated_data.get("is_active", True),
                uploaded_by=request.user,
            )

        return Response(
            BannerSerializer(banner, context={"request": request}).data,
            status=status.HTTP_200_OK if banner else status.HTTP_201_CREATED,
        )

    def delete(self, request):
        university = _get_banner_scope(request)
        banner = Banner.objects.filter(university=university).first()
        if not banner:
            return Response(
                {"detail": "Баннер не найден."},
                status=status.HTTP_404_NOT_FOUND,
            )
        if banner.image:
            banner.image.delete(save=False)
        banner.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class BannerToggleAPIView(APIView):
    """
    POST /api/banner/toggle/                — включить / выключить глобальный баннер.
    POST /api/u/<slug>/banner/toggle/       — включить / выключить баннер ВУЗа.

    Тело: {"is_active": true | false}.
    Право: banner.visibility.toggle
    """

    def get_permissions(self):
        return [HasAppPermission("banner.visibility.toggle")]

    def post(self, request):
        university = _get_banner_scope(request)
        banner = Banner.objects.filter(university=university).first()
        if not banner:
            return Response(
                {"detail": "Баннер не найден. Сначала загрузите изображение."},
                status=status.HTTP_404_NOT_FOUND,
            )

        serializer = BannerToggleSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        banner.is_active = serializer.validated_data["is_active"]
        banner.save(update_fields=["is_active", "updated_at"])

        return Response(
            BannerSerializer(banner, context={"request": request}).data
        )
