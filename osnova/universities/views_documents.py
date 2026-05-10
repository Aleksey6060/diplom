from rest_framework import permissions
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.viewsets import ModelViewSet

from users.permissions import HasAppPermission
from .models import UniversityDocument
from .serializers import UniversityDocumentSerializer, UniversityDocumentUploadSerializer


class UniversityDocumentViewSet(ModelViewSet):
    queryset = UniversityDocument.objects.select_related("university", "uploaded_by")
    parser_classes = (MultiPartParser, FormParser)

    def get_permissions(self):
        if self.request.method == "GET":
            return [permissions.IsAuthenticated()]
        if self.request.method == "POST":
            return [HasAppPermission("documents.files.upload")]
        if self.request.method == "DELETE":
            return [HasAppPermission("documents.files.delete")]
        return [HasAppPermission("documents.files.upload")]

    def get_serializer_class(self):
        if self.request.method == "POST":
            return UniversityDocumentUploadSerializer
        return UniversityDocumentSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        university = getattr(self.request, "university", None)
        if university is not None:
            return qs.filter(university=university)
        return qs.filter(university__isnull=True)

    def perform_create(self, serializer):
        f = serializer.validated_data.get("file")
        content_type = getattr(f, "content_type", "") or ""
        size = int(getattr(f, "size", 0) or 0)
        serializer.save(
            university=getattr(self.request, "university", None),
            uploaded_by=getattr(self.request, "user", None),
            original_name=getattr(f, "name", "") or "",
            content_type=content_type,
            size=size,
        )
