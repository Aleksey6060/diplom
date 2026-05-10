import base64
from django.db.models import Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import generics, permissions, status
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.mixins import CreateModelMixin, ListModelMixin
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.viewsets import GenericViewSet, ModelViewSet
from shared_modules.enums import CourseType, AccountType
from pickle import loads as unpack, dumps as pack

from users.permissions import HasAppPermission
from groups.models import StudentGroupThrough
from .models import Course, CourseStoreCard, Semester, Subject, Topic, Material, MaterialFolder, MaterialFile, CourseEnrollment
from .serializers import (
    CourseListSerializer,
    CourseStoreCardSerializer,
    CourseWriteSerializer,
    SemesterSerializer,
    SemesterWriteSerializer,
    SubjectSerializer,
    SubjectWriteSerializer,
    TopicSerializer,
    TopicWriteSerializer,
    MaterialListSerializer,
    MaterialContentSerializer,
    MaterialWriteSerializer,
    MaterialFolderSerializer,
    MaterialFolderWriteSerializer,
    MaterialFileSerializer,
    MaterialFileWriteSerializer,
)

from shared_modules.mixins import PermissionMapMixin
from shared_modules.enums import FilterJSONFields, FilterJSONOps

# =========================================================
# HELPERS
# =========================================================


def get_available_courses_queryset(user, university=None):
    """
    Сейчас отдаем все активные курсы.
    Позже здесь можно добавить фильтрацию по покупкам пользователя.

    Если передан university, фильтруем курсы данного ВУЗа.
    """
    qs = Course.objects.filter(is_active=True)
    if university is not None:
        qs = qs.filter(university=university)
    else:
        qs = qs.filter(university__isnull=True)

    if user and getattr(user, "is_authenticated", False):
        if getattr(user, "account_type", None) == AccountType.STUDENT:
            rel = StudentGroupThrough.objects.select_related("group").filter(student=user).first()
            enroll_course_ids = CourseEnrollment.objects.filter(
                student=user,
                is_active=True,
            ).values_list("course_id", flat=True)

            q = Q(id__in=enroll_course_ids)
            if rel and rel.group_id:
                q |= Q(bind_groups__id=rel.group_id)

            return qs.filter(q).distinct()

    return qs


def _can_manage_courses(request, view):
    user = getattr(request, "user", None)
    if not user or not getattr(user, "is_authenticated", False):
        return False
    return HasAppPermission([
        "courses.create",
        "courses.semesters.create",
        "courses.subjects.create",
        "courses.topics.create",
        "courses.materials.create",
    ]).has_permission(request, view)


def get_published_semesters_queryset(qs):
    now = timezone.now()
    return qs.filter(Q(delay_published_at__isnull=True) | Q(delay_published_at__lte=now))


def get_manage_courses_queryset(university=None):
    qs = Course.objects.all()
    if university is not None:
        qs = qs.filter(university=university)
    else:
        qs = qs.filter(university__isnull=True)
    return qs


def get_published_materials_queryset(queryset):
    return queryset.filter(is_published=True)


def root_breadcrumb():
    return [{"type": "root", "id": None, "title": "Все курсы"}]


def resolve_topic_course(topic):
    return topic.course if topic.course_id else topic.subject.semester.course


def resolve_material_course(material):
    if material.course_id:
        return material.course
    if material.subject_id:
        return material.subject.semester.course
    if material.topic_id:
        return resolve_topic_course(material.topic)
    return None


def build_course_breadcrumbs(course):
    return root_breadcrumb() + [
        {"type": "course", "id": course.id, "title": course.title}
    ]


def build_semester_breadcrumbs(semester):
    return build_course_breadcrumbs(semester.course) + [
        {"type": "semester", "id": semester.id, "title": semester.title}
    ]


def build_subject_breadcrumbs(subject):
    return build_semester_breadcrumbs(subject.semester) + [
        {"type": "subject", "id": subject.id, "title": subject.title}
    ]


def build_topic_breadcrumbs(topic):
    if topic.course_id:
        return build_course_breadcrumbs(topic.course) + [
            {"type": "topic", "id": topic.id, "title": topic.title}
        ]

    return build_subject_breadcrumbs(topic.subject) + [
        {"type": "topic", "id": topic.id, "title": topic.title}
    ]


def build_material_breadcrumbs(material):
    if material.course_id:
        base = build_course_breadcrumbs(material.course)
    elif material.subject_id:
        base = build_subject_breadcrumbs(material.subject)
    else:
        base = build_topic_breadcrumbs(material.topic)

    return base + [{"type": "material", "id": material.id, "title": material.title}]


def build_folder_breadcrumbs(folder):
    breadcrumbs = build_material_breadcrumbs(folder.material)

    ancestors = []
    current = folder
    while current is not None:
        ancestors.append(current)
        current = current.parent

    for node in reversed(ancestors):
        breadcrumbs.append({"type": "folder", "id": node.id, "title": node.title})

    return breadcrumbs

def build_q_object(data, max_recursion_depth=100):
    """
    Рекурсивно превращает JSON-фильтр в объект Django Q.
    """
    # Если это конечный узел (условие фильтрации)
    if not isinstance(data, dict) or FilterJSONFields.LOGIC not in data:
        # data здесь это что-то вроде {"category": "python"}
        return Q(**data)

    if not max_recursion_depth:
        return Q()

    logic = data.get(FilterJSONFields.LOGIC).upper()  # AND, OR или NOT

    if logic == FilterJSONOps.NOT:
        return ~build_q_object(data.get(FilterJSONFields.ITEM))

    # Для AND и OR собираем всех детей
    children = [build_q_object(child, max_recursion_depth-1) for child in data.get(FilterJSONFields.CHILDREN, [])]

    if not children:
        return Q()

    # Соединяем детей через нужный оператор
    q_expression = children[0]
    for next_child in children[1:]:
        if logic == FilterJSONOps.AND:
            q_expression &= next_child
        elif logic == FilterJSONOps.OR:
            q_expression |= next_child

    return q_expression


# =========================================================
# COURSE API
# =========================================================

class CourseListCreateAPIView(generics.ListCreateAPIView):

    def get_permissions(self):
        if self.request.method == "GET":
            return [permissions.AllowAny()]
        return [HasAppPermission("courses.create")]

    def get_queryset(self):
        university = getattr(self.request, "university", None)
        return get_available_courses_queryset(self.request.user, university=university)

    def perform_create(self, serializer):
        university = getattr(self.request, "university", None)
        serializer.save(university=university)

    def get_serializer_class(self):
        if self.request.method == "POST":
            return CourseWriteSerializer
        return CourseListSerializer


class CourseRetrieveUpdateDestroyAPIView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = CourseWriteSerializer

    def get_permissions(self):
        if self.request.method == "GET":
            return [permissions.AllowAny()]
        return [HasAppPermission("courses.create")]

    def get_queryset(self):
        university = getattr(self.request, "university", None)
        return get_manage_courses_queryset(university=university)


class CourseContentsAPIView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request, pk):
        university = getattr(request, "university", None)
        course = get_object_or_404(get_available_courses_queryset(request.user, university=university), pk=pk)
        can_manage = _can_manage_courses(request, self)

        payload = {
            "node_type": "course",
            "current": CourseListSerializer(course, context={"request": request}).data,
            "breadcrumbs": build_course_breadcrumbs(course),
            "children": {},
        }

        if course.course_type == Course.CourseType.FULL:
            semesters = course.semesters.all()
            if not can_manage:
                semesters = get_published_semesters_queryset(semesters)
            payload["children"]["semesters"] = SemesterSerializer(
                semesters,
                many=True,
                context={"request": request},
            ).data
            payload["children"]["subjects"] = []
            payload["children"]["topics"] = []
            payload["children"]["materials"] = []
        else:
            topics = course.root_topics.all()
            materials = get_published_materials_queryset(course.materials.all())
            payload["children"]["semesters"] = []
            payload["children"]["subjects"] = []
            payload["children"]["topics"] = TopicSerializer(
                topics,
                many=True,
                context={"request": request},
            ).data
            payload["children"]["materials"] = MaterialListSerializer(
                materials,
                many=True,
                context={"request": request},
            ).data

        return Response(payload)


# =========================================================
# SEMESTER API
# =========================================================

class SemesterCreateAPIView(generics.CreateAPIView):
    queryset = Semester.objects.all()
    serializer_class = SemesterWriteSerializer

    def get_permissions(self):
        return [HasAppPermission("courses.semesters.create")]


class SemesterRetrieveUpdateDestroyAPIView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = SemesterWriteSerializer

    def get_permissions(self):
        if self.request.method == "GET":
            return [permissions.AllowAny()]
        return [HasAppPermission("courses.semesters.create")]

    def get_queryset(self):
        university = getattr(self.request, "university", None)
        return Semester.objects.select_related("course").filter(course__in=get_manage_courses_queryset(university=university))


class SemesterContentsAPIView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request, pk):
        available_courses = get_available_courses_queryset(request.user, university=getattr(request, "university", None))
        can_manage = _can_manage_courses(request, self)
        sem_qs = Semester.objects.select_related("course").filter(course__in=available_courses)
        if not can_manage:
            sem_qs = get_published_semesters_queryset(sem_qs)
        semester = get_object_or_404(sem_qs, pk=pk)
        subjects = semester.subjects.all()

        return Response({
            "node_type": "semester",
            "current": SemesterSerializer(semester, context={"request": request}).data,
            "breadcrumbs": build_semester_breadcrumbs(semester),
            "children": {
                "subjects": SubjectSerializer(subjects, many=True, context={"request": request}).data,
                "topics": [],
                "materials": [],
            },
        })


# =========================================================
# SUBJECT API
# =========================================================

class SubjectCreateAPIView(generics.CreateAPIView):
    queryset = Subject.objects.all()
    serializer_class = SubjectWriteSerializer

    def get_permissions(self):
        return [HasAppPermission("courses.subjects.create")]


class SubjectRetrieveUpdateDestroyAPIView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = SubjectWriteSerializer

    def get_permissions(self):
        if self.request.method == "GET":
            return [permissions.AllowAny()]
        return [HasAppPermission("courses.subjects.create")]

    def get_queryset(self):
        university = getattr(self.request, "university", None)
        return Subject.objects.select_related("semester", "semester__course").filter(
            semester__course__in=get_manage_courses_queryset(university=university)
        )


class SubjectContentsAPIView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request, pk):
        available_courses = get_available_courses_queryset(request.user, university=getattr(request, "university", None))
        subject = get_object_or_404(
            Subject.objects.select_related("semester", "semester__course").filter(
                semester__course__in=available_courses
            ),
            pk=pk,
        )
        topics = subject.topics.all()
        materials = []

        return Response({
            "node_type": "subject",
            "current": SubjectSerializer(subject, context={"request": request}).data,
            "breadcrumbs": build_subject_breadcrumbs(subject),
            "children": {
                "topics": TopicSerializer(topics, many=True, context={"request": request}).data,
                "materials": [],
                "folders": [],
                "files": [],
            },
        })


# =========================================================
# TOPIC API
# =========================================================

class TopicCreateAPIView(generics.CreateAPIView):
    queryset = Topic.objects.all()
    serializer_class = TopicWriteSerializer

    def get_permissions(self):
        return [HasAppPermission("courses.topics.create")]


class TopicRetrieveUpdateDestroyAPIView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = TopicWriteSerializer

    def get_permissions(self):
        if self.request.method == "GET":
            return [permissions.AllowAny()]
        return [HasAppPermission("courses.topics.create")]

    def get_queryset(self):
        university = getattr(self.request, "university", None)
        courses_qs = get_manage_courses_queryset(university=university)
        return Topic.objects.select_related(
            "course",
            "subject",
            "subject__semester",
            "subject__semester__course",
        ).filter(Q(course__in=courses_qs) | Q(subject__semester__course__in=courses_qs))


class TopicContentsAPIView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request, pk):
        available_courses = get_available_courses_queryset(request.user, university=getattr(request, "university", None))
        topic = get_object_or_404(
            Topic.objects.select_related(
                "course",
                "subject",
                "subject__semester",
                "subject__semester__course",
            ).filter(
                Q(course__in=available_courses) |
                Q(subject__semester__course__in=available_courses)
            ),
            pk=pk,
        )
        materials = get_published_materials_queryset(topic.materials.all())
        can_view_assignments = HasAppPermission("grades.assignments.view").has_permission(request, self)
        assignments_payload = []
        if can_view_assignments and topic.subject_id:
            from .grades_serializers import AssignmentSerializer
            from .models import Assignment
            assignments = Assignment.objects.select_related("subject", "topic").filter(
                topic_id=topic.id,
                test_source__isnull=True,
            ).order_by("position", "id")
            assignments_payload = AssignmentSerializer(assignments, many=True, context={"request": request}).data

        return Response({
            "node_type": "topic",
            "current": TopicSerializer(topic, context={"request": request}).data,
            "breadcrumbs": build_topic_breadcrumbs(topic),
            "children": {
                "materials": MaterialListSerializer(materials, many=True, context={"request": request}).data,
                "assignments": assignments_payload,
                "folders": [],
                "files": [],
            },
        })


# =========================================================
# MATERIAL API
# =========================================================

class MaterialCreateAPIView(generics.CreateAPIView):
    queryset = Material.objects.all()
    serializer_class = MaterialWriteSerializer

    def get_permissions(self):
        return [HasAppPermission("courses.materials.create")]


class MaterialRetrieveUpdateDestroyAPIView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = MaterialWriteSerializer

    def get_permissions(self):
        if self.request.method == "GET":
            return [permissions.AllowAny()]
        return [HasAppPermission("courses.materials.create")]

    def get_queryset(self):
        university = getattr(self.request, "university", None)
        courses_qs = get_manage_courses_queryset(university=university)
        return Material.objects.select_related(
            "course",
            "subject",
            "subject__semester",
            "subject__semester__course",
            "topic",
            "topic__course",
            "topic__subject",
            "topic__subject__semester",
            "topic__subject__semester__course",
            "lecture_data",
            "presentation_data",
            "document_data",
            "test_data",
        ).prefetch_related(
            "test_data__questions__options",
        ).filter(
            Q(course__in=courses_qs) |
            Q(subject__semester__course__in=courses_qs) |
            Q(topic__course__in=courses_qs) |
            Q(topic__subject__semester__course__in=courses_qs)
        )

class SubjectTestsAPIView(generics.ListAPIView):
    serializer_class = MaterialListSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        subject_id = self.kwargs["subject_id"]
        return Material.objects.select_related(
            "subject",
            "subject__semester",
            "subject__semester__course",
            "lecture_data",
            "presentation_data",
            "document_data",
            "test_data",
        ).prefetch_related(
            "test_data__questions__options",
        ).filter(
            Q(subject_id=subject_id) | Q(topic__subject_id=subject_id),
            material_type=Material.MaterialType.TEST,
        ).order_by("order", "id")


class MaterialContentsAPIView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request, pk):
        available_courses = get_available_courses_queryset(request.user, university=getattr(request, "university", None))
        material = get_object_or_404(
            Material.objects.select_related(
                "course",
                "subject",
                "subject__semester",
                "subject__semester__course",
                "topic",
                "topic__course",
                "topic__subject",
                "topic__subject__semester",
                "topic__subject__semester__course",
                "lecture_data",
                "presentation_data",
                "document_data",
                "test_data",
            ).prefetch_related(
                "test_data__questions__options",
            ).filter(
                Q(course__in=available_courses) |
                Q(subject__semester__course__in=available_courses) |
                Q(topic__course__in=available_courses) |
                Q(topic__subject__semester__course__in=available_courses)
            ).filter(is_published=True),
            pk=pk,
        )

        folders = material.folders.filter(parent__isnull=True)
        files = material.files.filter(folder__isnull=True)

        return Response({
            "node_type": "material",
            "current": MaterialContentSerializer(material, context={"request": request}).data,
            "breadcrumbs": build_material_breadcrumbs(material),
            "children": {
                "folders": MaterialFolderSerializer(folders, many=True, context={"request": request}).data,
                "files": MaterialFileSerializer(files, many=True, context={"request": request}).data,
            },
        })


# =========================================================
# FOLDER / FILE API
# =========================================================

class MaterialFolderCreateAPIView(generics.CreateAPIView):
    queryset = MaterialFolder.objects.all()
    serializer_class = MaterialFolderWriteSerializer

    def get_permissions(self):
        return [HasAppPermission("courses.folders.create")]


class MaterialFolderRetrieveUpdateDestroyAPIView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = MaterialFolderWriteSerializer

    def get_permissions(self):
        if self.request.method == "GET":
            return [permissions.AllowAny()]
        return [HasAppPermission("courses.folders.create")]

    def get_queryset(self):
        university = getattr(self.request, "university", None)
        courses_qs = get_manage_courses_queryset(university=university)
        return MaterialFolder.objects.select_related(
            "material",
            "material__course",
            "material__subject",
            "material__subject__semester",
            "material__subject__semester__course",
            "material__topic",
            "material__topic__course",
            "material__topic__subject",
            "material__topic__subject__semester",
            "material__topic__subject__semester__course",
            "parent",
        ).filter(
            Q(material__course__in=courses_qs) |
            Q(material__subject__semester__course__in=courses_qs) |
            Q(material__topic__course__in=courses_qs) |
            Q(material__topic__subject__semester__course__in=courses_qs)
        )


class MaterialFolderContentsAPIView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request, pk):
        available_courses = get_available_courses_queryset(request.user, university=getattr(request, "university", None))
        folder = get_object_or_404(
            MaterialFolder.objects.select_related(
                "material",
                "material__course",
                "material__subject",
                "material__subject__semester",
                "material__subject__semester__course",
                "material__topic",
                "material__topic__course",
                "material__topic__subject",
                "material__topic__subject__semester",
                "material__topic__subject__semester__course",
                "parent",
            ).filter(
                Q(material__course__in=available_courses) |
                Q(material__subject__semester__course__in=available_courses) |
                Q(material__topic__course__in=available_courses) |
                Q(material__topic__subject__semester__course__in=available_courses)
            ).filter(material__is_published=True),
            pk=pk,
        )

        subfolders = folder.children.all()
        files = folder.files.all()

        return Response({
            "node_type": "folder",
            "current": MaterialFolderSerializer(folder, context={"request": request}).data,
            "breadcrumbs": build_folder_breadcrumbs(folder),
            "children": {
                "folders": MaterialFolderSerializer(subfolders, many=True, context={"request": request}).data,
                "files": MaterialFileSerializer(files, many=True, context={"request": request}).data,
            },
        })


class MaterialFileCreateAPIView(generics.CreateAPIView):
    queryset = MaterialFile.objects.all()
    serializer_class = MaterialFileWriteSerializer
    parser_classes = (MultiPartParser, FormParser)

    def get_permissions(self):
        return [HasAppPermission("courses.files.create")]


class MaterialFileRetrieveUpdateDestroyAPIView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = MaterialFileWriteSerializer

    def get_permissions(self):
        if self.request.method == "GET":
            return [permissions.AllowAny()]
        return [HasAppPermission("courses.files.create")]

    def get_queryset(self):
        university = getattr(self.request, "university", None)
        courses_qs = get_manage_courses_queryset(university=university)
        return MaterialFile.objects.select_related(
            "material",
            "material__course",
            "material__subject",
            "material__subject__semester",
            "material__subject__semester__course",
            "material__topic",
            "material__topic__course",
            "material__topic__subject",
            "material__topic__subject__semester",
            "material__topic__subject__semester__course",
            "folder",
        ).filter(
            Q(material__course__in=courses_qs) |
            Q(material__subject__semester__course__in=courses_qs) |
            Q(material__topic__course__in=courses_qs) |
            Q(material__topic__subject__semester__course__in=courses_qs)
        )

class CourseSubjectsListViewSet(ListModelMixin, GenericViewSet):
    filter_backends = [DjangoFilterBackend]
    queryset = Subject.objects.select_related("semester").all()
    serializer_class = SubjectSerializer

    def get_queryset(self):
        return super().get_queryset().filter(
            semester__course_id=self.kwargs["course_id"]
        )

class CourseFilterViewSet(ModelViewSet):
    queryset = CourseStoreCard.objects.all()
    serializer_class = CourseStoreCardSerializer
    permission_classes = [permissions.AllowAny]
    @action(detail=False, methods=['post'],url_path="receive")
    def serialize_filter(self, request):
        """
        Принимает сложную структуру и возвращает base64-строку.
        На вход ожидается JSON, который мы превратим в Q-объект.
        """
        filter_data = request.data.get('filters')
        if not filter_data:
            return Response({"error": "Фильтр не предоставлен"}, status=400)

        try:
            q_obj = build_q_object(filter_data)

            pickled_data = pack(q_obj)
            token = base64.b64encode(pickled_data).decode('utf-8')

            return Response({"filter_token": token})
        except Exception as e:
            return Response({"error": "Неудалось создать фильтр"}, status=500)

    @action(detail=False, methods=['get'],url_path="apply")
    def apply_filter(self, request):
        """
        Принимает токен из URL и применяет его к базе.
        """
        
        token = request.query_params.get('token')
        if not token:
            return Response({"error": "Необходим фильтр"}, status=400)

        try:
            decoded_data = base64.b64decode(token)
            q_object = unpack(decoded_data)

            courses = CourseStoreCard.objects.filter(q_object)
            serializer = self.get_serializer(courses, many=True)
            return Response(serializer.data)
        except Exception as e:
            return Response({"error": "Неправильный объект фильтра"}, status=400)

class CourseStoreCardViewSet(ModelViewSet):
    serializer_class = CourseStoreCardSerializer
    queryset = CourseStoreCard.objects.select_related("university", "course")

    def get_permissions(self):
        if self.request.method == "GET":
            return [permissions.AllowAny()]
        if self.request.method == "POST":
            return [HasAppPermission("store.cards.create")]
        if self.request.method == "DELETE":
            return [HasAppPermission("store.cards.delete")]
        return [HasAppPermission("store.cards.edit")]

    def get_queryset(self):
        qs = super().get_queryset()
        university = getattr(self.request, "university", None)
        if university is not None:
            qs = qs.filter(university=university)
        else:
            qs = qs.filter(university__isnull=True)

        if self.request.method == "GET":
            user = getattr(self.request, "user", None)
            can_manage = False
            if user and user.is_authenticated:
                can_manage = HasAppPermission(["store.cards.create", "store.cards.edit"]).has_permission(self.request, self)
            if not can_manage:
                qs = qs.filter(is_active=True)

        return qs

    def perform_create(self, serializer):
        university = getattr(self.request, "university", None)
        if university is not None:
            serializer.save(university=university)
        else:
            serializer.save()
