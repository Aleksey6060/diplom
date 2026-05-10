from rest_framework.routers import DefaultRouter

from .views_documents import UniversityDocumentViewSet

app_name = "documents"

router = DefaultRouter()
router.register(r"", UniversityDocumentViewSet, basename="documents")

urlpatterns = router.urls

