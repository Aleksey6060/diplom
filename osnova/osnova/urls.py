from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path

urlpatterns = [
    path("admin/", admin.site.urls),

    # ВУЗы — CRUD
    path("api/universities/", include("universities.urls", namespace="universities")),

    # Глобальные эндпоинты (без привязки к ВУЗу)
    path("api/users/", include("users.urls", namespace="users")),
    path("api/courses/", include("courses.urls", namespace="courses")),
    path("api/groups/", include("groups.urls", namespace="groups")),

    # Чаты
    path("api/chats/", include("chats.urls", namespace="chats")),

    # Баннер — глобальный
    path("api/banner/", include("universities.banner_urls", namespace="banner")),

    # Документы — глобальные
    path("api/documents/", include("universities.documents_urls", namespace="documents")),
    # Оформление — глобальное
    path("api/appearance/", include("universities.appearance_urls", namespace="appearance")),
    # Заявки — глобальные
    path("api/tickets/", include("tickets.urls", namespace="tickets")),

    # Эндпоинты внутри ВУЗа: /api/u/<slug>/users/... и /api/u/<slug>/courses/...
    # Middleware UniversityMiddleware устанавливает request.university,
    # а views фильтруют данные по request.university.
    path("api/u/<slug:university_slug>/users/", include("users.urls", namespace="university-users")),
    path("api/u/<slug:university_slug>/courses/", include("courses.urls", namespace="university-courses")),
    path("api/u/<slug:university_slug>/chats/", include("chats.urls", namespace="university-chats")),
    path("api/u/<slug:university_slug>/banner/", include("universities.banner_urls", namespace="university-banner")),
    path("api/u/<slug:university_slug>/documents/", include("universities.documents_urls", namespace="university-documents")),
    path("api/u/<slug:university_slug>/appearance/", include("universities.appearance_urls", namespace="university-appearance")),
    path("api/u/<slug:university_slug>/groups/", include("groups.urls", namespace="university-groups")),
    path("api/u/<slug:university_slug>/tickets/", include("tickets.urls", namespace="university-tickets")),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
