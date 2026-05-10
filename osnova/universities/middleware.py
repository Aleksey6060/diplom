from django.http import JsonResponse
from django.utils import timezone
from django.utils.deprecation import MiddlewareMixin

from .models import University


class UniversityMiddleware(MiddlewareMixin):
    """
    Определяет ВУЗ из URL-параметра university_slug.

    Если URL содержит <university_slug>, middleware:
    1. Находит ВУЗ по slug.
    2. Ставит request.university = объект University.

    Для запросов без university_slug ставит request.university = None.
    """

    def process_view(self, request, view_func, view_args, view_kwargs):
        slug = view_kwargs.pop("university_slug", None)

        if not slug:
            request.university = None
            return None

        try:
            university = University.objects.get(slug__iexact=slug, is_active=True)
        except University.DoesNotExist:
            return JsonResponse(
                {"detail": f"ВУЗ '{slug}' не найден."},
                status=404,
            )

        if university.expires_at and university.expires_at < timezone.now():
            return JsonResponse(
                {"detail": f"Срок действия ВУЗа '{slug}' истёк."},
                status=404,
            )

        request.university = university
        return None
