import os
import mimetypes

from groups.models import StudentGroups, StudentGroupThrough
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from django.conf import settings as django_settings
from django.contrib.auth.tokens import default_token_generator
from django.core.mail import send_mail
from django.db import transaction, IntegrityError
from django.db.models import Count, Prefetch, Q
from django.http import FileResponse
from django.utils.decorators import method_decorator
from django.utils import timezone
from django.utils.encoding import force_bytes, force_str
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode
from django.views.decorators.csrf import csrf_exempt
from rest_framework import generics, permissions, status
from rest_framework.exceptions import ValidationError
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.viewsets import ModelViewSet
from rest_framework.decorators import api_view, permission_classes, action
from rest_framework_simplejwt.serializers import TokenBlacklistSerializer
from django_filters.rest_framework import DjangoFilterBackend

from rest_framework_simplejwt.tokens import RefreshToken

from osnova import settings
from shared_modules.mixins import PermissionMapMixin
from shared_modules.enums import AccountType,CourseType
from .file_encrypted_storage import EncryptedMemoryFileUploadHandler, EncryptedTemporaryFileUploadHandler
from .models import FilesProfile, PermissionAction, PermissionModule, Role, User
from .permissions import HasAppPermission
from .serializers import (
    FilesProfileSerializer,
    PermissionModuleReadSerializer,
    RoleListSerializer,
    RoleReadSerializer,
    RoleWriteSerializer,
    StaffProfileSerializer,
    StaffUserCreateSerializer,
    StaffUserListSerializer,
    StaffUserReadSerializer,
    StaffUserUpdateSerializer,
    UserAccessSerializer,
    UserProfileSerializer, LoginSerializer, ChangePasswordSerializer, StudentSerializer,
)
from courses.models import Course
from courses.serializers import CourseListSerializer


def get_refresh_token(request, name='refresh_token'):
    return request.COOKIES.get(name) or request.data.get(name)


class MeProfileAPIView(generics.RetrieveUpdateAPIView):
    serializer_class = UserProfileSerializer
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = (MultiPartParser, FormParser, JSONParser)

    def get_object(self):
        return self.request.user


class MeAccessAPIView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        serializer = UserAccessSerializer(request.user, context={"request": request})
        return Response(serializer.data)


class PermissionModuleListAPIView(generics.ListAPIView):
    serializer_class = PermissionModuleReadSerializer
    parser_classes = (JSONParser,)

    def get_permissions(self):
        return [HasAppPermission(["employees.roles.create", "employees.roles.configure"])]

    def get_queryset(self):
        return PermissionModule.objects.filter(is_active=True).prefetch_related(
            Prefetch(
                "actions",
                queryset=PermissionAction.objects.filter(is_active=True).order_by("position", "id"),
            )
        ).order_by("position", "id")


class RoleListCreateAPIView(generics.ListCreateAPIView):
    parser_classes = (JSONParser,)

    def get_permissions(self):
        if self.request.method == "GET":
            return [HasAppPermission(["employees.roles.view", "employees.staff.create", "employees.staff.edit"])]
        return [HasAppPermission("employees.roles.create")]

    def get_queryset(self):
        qs = Role.objects.filter(is_active=True)
        university = getattr(self.request, "university", None)
        if university is not None:
            qs = qs.filter(university=university)
        else:
            qs = qs.filter(university__isnull=True)
        return qs.annotate(user_count=Count("users")).order_by("name", "id")

    def perform_create(self, serializer):
        university = getattr(self.request, "university", None)
        serializer.save(university=university)

    def get_serializer_class(self):
        if self.request.method == "POST":
            return RoleWriteSerializer
        return RoleListSerializer


class RoleRetrieveUpdateDestroyAPIView(generics.RetrieveUpdateDestroyAPIView):
    parser_classes = (JSONParser,)

    def get_permissions(self):
        if self.request.method == "GET":
            return [HasAppPermission("employees.roles.view")]
        if self.request.method in ("PUT", "PATCH"):
            return [HasAppPermission("employees.roles.configure")]
        return [HasAppPermission("employees.roles.delete")]

    def get_queryset(self):
        qs = Role.objects.filter(is_active=True).prefetch_related(
            "permissions__module",
        )
        university = getattr(self.request, "university", None)
        if university is not None:
            qs = qs.filter(university=university)
        else:
            qs = qs.filter(university__isnull=True)
        return qs

    def get_serializer_class(self):
        if self.request.method in ("PUT", "PATCH"):
            return RoleWriteSerializer
        return RoleReadSerializer

    def perform_destroy(self, instance):
        if instance.is_system:
            raise ValidationError("Системную роль удалять нельзя.")

        if instance.users.exists():
            raise ValidationError("Нельзя удалить роль, пока она назначена сотрудникам.")

        instance.is_active = False
        instance.save()


class RoleStaffListAPIView(generics.ListAPIView):
    serializer_class = StaffUserListSerializer
    parser_classes = (JSONParser,)

    def get_permissions(self):
        return [HasAppPermission("employees.staff.view")]

    def get_queryset(self):
        role_id = self.kwargs.get("pk")
        qs = User.objects.filter(
            account_type=AccountType.EMPLOYEE,
            role_id=role_id,
            role__is_active=True,
        ).select_related("role")
        university = getattr(self.request, "university", None)
        if university is not None:
            qs = qs.filter(university=university)
        else:
            qs = qs.filter(university__isnull=True)
        return qs.order_by("id")


class StaffListCreateAPIView(generics.ListCreateAPIView):
    parser_classes = (MultiPartParser, FormParser, JSONParser)

    def get_permissions(self):
        if self.request.method == "GET":
            return [HasAppPermission("employees.staff.view")]
        return [HasAppPermission("employees.staff.create")]

    def get_queryset(self):
        qs = User.objects.filter(
            account_type=AccountType.EMPLOYEE
        ).select_related("role")
        university = getattr(self.request, "university", None)
        if university is not None:
            qs = qs.filter(university=university)
        else:
            qs = qs.filter(university__isnull=True)
        return qs.order_by("id")

    def get_serializer_class(self):
        if self.request.method == "POST":
            return StaffUserCreateSerializer
        return StaffUserListSerializer


class StaffRetrieveUpdateAPIView(generics.RetrieveUpdateAPIView):
    parser_classes = (MultiPartParser, FormParser, JSONParser)

    def get_permissions(self):
        if self.request.method == "GET":
            return [HasAppPermission("employees.staff.view")]
        return [HasAppPermission("employees.staff.edit")]

    def get_queryset(self):
        qs = User.objects.filter(
            account_type=AccountType.EMPLOYEE
        ).select_related("role")
        university = getattr(self.request, "university", None)
        if university is not None:
            qs = qs.filter(university=university)
        else:
            qs = qs.filter(university__isnull=True)
        return qs

    def get_serializer_class(self):
        if self.request.method in ("PUT", "PATCH"):
            return StaffUserUpdateSerializer
        return StaffUserReadSerializer

class StudentsViewSet(PermissionMapMixin, ModelViewSet):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = StudentSerializer
    parser_classes = (MultiPartParser, FormParser, JSONParser)

    method_map = {
        PermissionMapMixin.Methods.GET: [HasAppPermission("distribution.students.sensitive_data.view")],
        PermissionMapMixin.Methods.POST: [HasAppPermission("distribution.students.create")],
        PermissionMapMixin.Methods.UPDATE: [HasAppPermission("distribution.students.edit")],
        PermissionMapMixin.Methods.DELETE: [HasAppPermission("distribution.students.remove")]
    }

    def get_queryset(self):
        qs = User.objects\
            .select_related("membership", "membership__group")\
            .filter(account_type=AccountType.STUDENT)
        university = getattr(self.request, "university", None)
        if university is not None:
            qs = qs.filter(university=university)
        else:
            qs = qs.filter(university__isnull=True)
        return qs

    def get_permissions(self):
        if self.action == "simple_courses" and self.request.method == "GET":
            try:
                pk = int(self.kwargs.get("pk") or 0)
            except (TypeError, ValueError):
                pk = 0
            user = self.request.user
            if (
                pk
                and getattr(user, "is_authenticated", False)
                and getattr(user, "account_type", None) == AccountType.STUDENT
                and user.id == pk
            ):
                return [permissions.IsAuthenticated()]
        return super().get_permissions()

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        group = serializer.validated_data.pop("group", None)
        password = serializer.validated_data.pop("password", None)
        university = getattr(request, "university", None)
        with transaction.atomic():
            student = User(**serializer.validated_data)
            if university is not None:
                student.university = university
            student.set_password(password)

            try:
                student.save()
            except IntegrityError as e:
                msg = str(e)
                if "users_user_email_key" in msg or "email" in msg:
                    raise ValidationError({"email": "Пользователь с таким email уже существует."})
                raise ValidationError({"detail": "Ошибка целостности данных."})

            enrolled_at = timezone.now()

            if group is not None:
                get_or_create_kwargs = {"name": group}
                if university is not None:
                    get_or_create_kwargs["university"] = university
                group, _ = StudentGroups.objects.get_or_create(**get_or_create_kwargs)
                group.students.add(student, through_defaults={"enrolled_at": enrolled_at})

            student.membership = StudentGroupThrough(
                group=group, student=student, enrolled_at=enrolled_at
            )

        return Response(serializer.data, status=status.HTTP_201_CREATED)

    def perform_update(self, serializer):
        group_was_provided = isinstance(getattr(serializer, "initial_data", None), dict) and ("group" in serializer.initial_data)
        group_name = None
        if group_was_provided:
            group_name = serializer.validated_data.pop("group", None)

        try:
            with transaction.atomic():
                student = serializer.save()

                if group_was_provided:
                    university = getattr(self.request, "university", None)
                    if group_name:
                        group_obj, _ = StudentGroups.objects.get_or_create(
                            name=group_name,
                            university=university,
                        )
                        if (
                            StudentGroupThrough.objects.filter(group=group_obj).count() >= settings.MAX_STUDENTS_IN_GROUP
                            and not StudentGroupThrough.objects.filter(student=student, group=group_obj).exists()
                        ):
                            raise ValidationError({"group": "Группа переполнена"})
                        StudentGroupThrough.objects.update_or_create(
                            student=student,
                            defaults={"group": group_obj},
                        )
                    else:
                        StudentGroupThrough.objects.filter(student=student).delete()
        except IntegrityError as e:
            msg = str(e)
            if "users_user_email_key" in msg or "email" in msg:
                raise ValidationError({"email": "Пользователь с таким email уже существует."})
            raise ValidationError({"detail": "Ошибка целостности данных."})

    @action(methods=["GET"], detail=True)
    def courses(self, request, pk=None):
        student = self.get_object()
        rel = StudentGroupThrough.objects.select_related("group").filter(student=student).first()
        if not rel or not rel.group_id:
            return Response([])
        qs = Course.objects.filter(bind_groups__id=rel.group_id).distinct().order_by("order", "id")
        return Response(CourseListSerializer(qs, many=True, context={"request": request}).data)
        
    @action(methods=["GET"], detail=True)
    def simple_courses(self, request, pk=None):
        student = self.get_object()
        from courses.models import CourseEnrollment
        enrollments = CourseEnrollment.objects.filter(student=student, course__course_type=CourseType.SIMPLE)
        qs = Course.objects.filter(id__in=enrollments.values('course_id')).distinct().order_by("order", "id")
        return Response(CourseListSerializer(qs, many=True, context={"request": request}).data)

    @action(methods=["POST"], detail=True)
    def bind_to_simple_courses(self, request, pk=None):
        student = self.get_object()
        courses = request.data.get("courses", [])
        
        from courses.models import CourseEnrollment
        
        if courses:
            courses_obj = list(Course.objects.filter(id__in=courses, course_type=CourseType.SIMPLE))
            if len(courses_obj) != len(courses):
                raise ValidationError({
                    "courses": "Были переданы невалидные идентификаторы курсов или курсы не являются дополнительным образованием."
                })
        else: 
            courses_obj = []

        with transaction.atomic():
            CourseEnrollment.objects.filter(student=student, course__course_type=CourseType.SIMPLE).delete()
            
            new_enrollments = [
                CourseEnrollment(student=student, course=c)
                for c in courses_obj
            ]
            CourseEnrollment.objects.bulk_create(new_enrollments)

        return Response(status=status.HTTP_201_CREATED)

    @action(methods=["POST"], detail=False)
    def many_create(self, request, *args, **kwargs):

        if not request.data:
            raise ValidationError("Нельзя передать пустой список.")

        if len(request.data) > settings.MAX_STUDENTS_PER_TIME:
            raise ValidationError("Превышено максимальное количество студентов, которых можно создать за один раз.")

        serializer = self.get_serializer(data=request.data, many=True)
        serializer.is_valid(raise_exception=True)

        students = []
        groups_map = {}

        for data in serializer.validated_data:
            group_name = data.pop("group", None)
            password = data.pop("password", None)

            university = getattr(request, "university", None)
            extra = dict(
                created_by=request.user,
                account_type=AccountType.STUDENT,
                must_change_password=True
            )
            if university is not None:
                extra["university"] = university
            student = User(**data, **extra)
            student.set_password(password)

            if group_name is not None:
                # bulk_create РІРѕР·РІСЂР°С‰Р°РµС‚ РїСЂРё update_conflicts=True С‚Рµ Р¶Рµ РѕР±СЉРµРєС‚С‹, С‡С‚Рѕ Р±С‹Р»Рё РµРјСѓ РїРµСЂРµРґР°РЅС‹ РЅР° СЃРѕР·РґР°РЅРёРµ.
                # Р’РЅСѓС‚СЂРё СЃРµР±СЏ РѕРЅ РёС… РјРµРЅСЏРµС‚, РїРѕСЌС‚РѕРјСѓ РІРµР·РґРµ РіРґРµ С…СЂР°РЅРёС‚СЃСЏ РґР°РЅРЅС‹Р№ РѕР±СЉРµРєС‚, РѕРЅ РёР·РјРµРЅРёС‚СЃСЏ (СЃСЃС‹Р»РѕС‡РЅС‹Р№ С‚РёРї)
                groups_map[group_name] = groups_map.get(group_name, []) + [student]

            students.append(student)

        university = getattr(request, "university", None)
        with transaction.atomic():
            groups_obj = StudentGroups.objects.bulk_create(
                [StudentGroups(name=name, university=university) for name in groups_map.keys()],
                update_conflicts=True,
                update_fields=["university","name"],
                unique_fields=["university", "name"]
            )
            students_obj = User.objects.bulk_create(
                students,
                update_conflicts=True,
                unique_fields=["email"],
                update_fields=[
                    "first_name", "last_name", "middle_name", "phone", "password"
                ]
            )

            enrolled_at = timezone.now()
            through_relations = []

            for group in groups_obj:
                for student in groups_map.get(group.name, []):
                    student.membership = StudentGroupThrough(
                        student=student,
                        group=group,
                        enrolled_at=enrolled_at
                    )
                    through_relations.append(student.membership)


            if through_relations:
                StudentGroupThrough.objects.bulk_create(
                    through_relations,
                    update_conflicts=True,
                    unique_fields=["student"],
                    update_fields=["group", "enrolled_at"]
                )

            from chats.services import run_on_commit, sync_chats_for_group_student
            for rel in through_relations:
                run_on_commit(sync_chats_for_group_student, rel.group, rel.student_id)

        return Response(
            data=UserProfileSerializer(students_obj, many=True).data,
            status=status.HTTP_201_CREATED
        )


@method_decorator(csrf_exempt, name="dispatch")
class LoginViewSet(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request, *args, **kwargs):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data["user"]

        # login(request, user) только для админки, в проде оставить закомментированной

        refresh_token = RefreshToken.for_user(user)

        return Response({
            "user": UserProfileSerializer(user).data,
            "refresh": str(refresh_token),
            "access": str(refresh_token.access_token)
        })


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def change_password(request):
    """Смена пароля с проверкой старого пароля"""
    serializer = ChangePasswordSerializer(data=request.data, context={'request': request})
    serializer.is_valid(raise_exception=True)

    user = request.user
    user.set_password(
        serializer.validated_data['new_password']
    )
    user.save()

    refresh_token = get_refresh_token(request)

    if not refresh_token:
        return Response({"detail": "Токен обновления не найден в cookie."}, status=status.HTTP_400_BAD_REQUEST)

    try:
        serializer = TokenBlacklistSerializer({"refresh": refresh_token})
        serializer.is_valid(raise_exception=True)
    except Exception as ex:
        return Response(status=status.HTTP_400_BAD_REQUEST)

    refresh_token = RefreshToken.for_user(request.user)

    return Response({
        'message': 'Пароль успешно изменен',
        "refresh": str(refresh_token),
        "access": str(refresh_token.access_token)
    }, status=status.HTTP_200_OK)


class PasswordResetRequestView(APIView):
    """Запрос ссылки для восстановления пароля. Доступно только для аккаунта OWNER."""
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        email = (request.data.get("email") or "").strip().lower()
        if not email:
            return Response({"detail": "Электронная почта обязательна."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            user = User.objects.get(email__iexact=email)
        except User.DoesNotExist:
            # Не раскрываем существование пользователя
            return Response({"detail": "Если аккаунт найден, письмо отправлено."}, status=status.HTTP_200_OK)

        if getattr(user, "account_type", None) != AccountType.OWNER:
            return Response({"detail": "Если аккаунт найден, письмо отправлено."}, status=status.HTTP_200_OK)

        uid = urlsafe_base64_encode(force_bytes(user.pk))
        token = default_token_generator.make_token(user)
        frontend_url = getattr(django_settings, "FRONTEND_URL", "http://localhost:5173")
        reset_link = f"{frontend_url}/reset-password?uid={uid}&token={token}"

        send_mail(
            subject="Восстановление пароля",
            message=(
                f"Здравствуйте!\n\n"
                f"Для восстановления пароля перейдите по ссылке:\n{reset_link}\n\n"
                f"Ссылка действительна 24 часа.\n\n"
                f"Если вы не запрашивали сброс пароля — проигнорируйте это письмо."
            ),
            from_email=django_settings.DEFAULT_FROM_EMAIL,
            recipient_list=[user.email],
            fail_silently=False,
        )
        return Response({"detail": "Если аккаунт найден, письмо отправлено."}, status=status.HTTP_200_OK)


class PasswordResetConfirmView(APIView):
    """Подтверждение и установка нового пароля по ссылке из письма."""
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        uid = request.data.get("uid", "")
        token = request.data.get("token", "")
        new_password = request.data.get("new_password", "")

        if not uid or not token or not new_password:
            return Response({"detail": "Необходимо передать параметры uid, token и new_password."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            pk = force_str(urlsafe_base64_decode(uid))
            user = User.objects.get(pk=pk)
        except Exception:
            return Response({"detail": "Ссылка недействительна."}, status=status.HTTP_400_BAD_REQUEST)

        if getattr(user, "account_type", None) != AccountType.OWNER:
            return Response({"detail": "Ссылка недействительна."}, status=status.HTTP_400_BAD_REQUEST)

        if not default_token_generator.check_token(user, token):
            return Response({"detail": "Ссылка недействительна или устарела."}, status=status.HTTP_400_BAD_REQUEST)

        user.set_password(new_password)
        user.save()
        return Response({"detail": "Пароль успешно изменён."}, status=status.HTTP_200_OK)


@csrf_exempt
@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated])
def user_logout(request):
    refresh_token = get_refresh_token(request)

    if not refresh_token:
        return Response({"detail": "Токен обновления не найден в cookie."}, status=status.HTTP_400_BAD_REQUEST)

    try:
        serializer = TokenBlacklistSerializer({"refresh": refresh_token})
        serializer.is_valid(raise_exception=True)
        return Response(status=status.HTTP_200_OK)
    except Exception as ex:
        return Response(status=status.HTTP_400_BAD_REQUEST)


class FilesProfileViewSet(PermissionMapMixin, ModelViewSet):
    serializer_class = FilesProfileSerializer
    queryset = FilesProfile.objects.select_related("user")
    permission_classes = [permissions.IsAuthenticated]

    method_map = {
        PermissionMapMixin.Methods.GET: [HasAppPermission("distribution.students.sensitive_data.view")],
        PermissionMapMixin.Methods.POST: [HasAppPermission("distribution.students.credentials.edit")],
        PermissionMapMixin.Methods.UPDATE: [HasAppPermission("distribution.students.credentials.edit")],
        PermissionMapMixin.Methods.DELETE: [HasAppPermission("distribution.students.credentials.edit")]
    }

    def get_permissions(self):
        if self.request.method == "GET":
            student_id = self.kwargs.get("student_id")
            try:
                student_id = int(student_id)
            except (TypeError, ValueError):
                student_id = None
            if (
                student_id is not None
                and getattr(self.request.user, "account_type", None) == AccountType.STUDENT
                and self.request.user.id == student_id
            ):
                return [permissions.IsAuthenticated()]
        return super().get_permissions()

    def get_queryset(self):
        return super().get_queryset().filter(
            user_id=self.kwargs.get("student_id")
        )

    def initialize_request(self, request, *args, **kwargs):
        # Вызываем оригинальный метод, чтобы получить DRF-request
        req = super().initialize_request(request, *args, **kwargs)

        # Устанавливаем хендлеры ДО парсинга данных
        if req.method in ["POST", "PUT", "PATCH"]:
            req.upload_handlers = [
                EncryptedMemoryFileUploadHandler(req),
                EncryptedTemporaryFileUploadHandler(req)
            ]
        return req

    def perform_create(self, serializer):
        user = User.objects.filter(
            pk=self.kwargs.get("student_id"),
            account_type=AccountType.STUDENT
        ).first()

        if user is None:
            raise ValidationError({
                "user": "Студент с таким id не найден"
            })

        serializer.save(user=user)

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        as_attachment = request.query_params.get("download", False)

        content_type, _ = mimetypes.guess_type(instance.file.name)
        content_type = content_type or 'application/octet-stream'

        # Если это текстовый файл, принудительно добавляем кодировку
        # Это заставит браузер интерпретировать кириллицу как UTF-8
        if content_type.startswith('text/') or content_type == 'application/json':
            content_type = f"{content_type}; charset=utf-8"

        f = instance.file.open('rb')
        iv = f.read(16)  # берем IV
        decryptor = Cipher(algorithms.AES(settings.AES_KEY), modes.CTR(iv)).decryptor()

        def file_iterator():
            try:
                while chunk := f.read(128 * 1024):
                    yield decryptor.update(chunk)
                yield decryptor.finalize()
            finally:
                f.close()

        filename = os.path.basename(instance.file.name)

        response = FileResponse(
            file_iterator(),
            as_attachment=as_attachment,
            content_type=content_type,
            filename=filename
        )
        response['Content-Disposition'] = f'inline; filename="{filename}"'
        response['X-File-Id'] = instance.id
        response['X-File-Type'] = instance.name
        response['X-User-Id'] = instance.user.id

        return response


class StaffsViewSet(PermissionMapMixin, ModelViewSet):
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ["account_type"]
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = StaffProfileSerializer
    queryset = User.objects.select_related("role").filter(
        ~Q(account_type=AccountType.STUDENT)
    )

    method_map = {
        PermissionMapMixin.Methods.GET: [HasAppPermission("employees.staff.view")],
        PermissionMapMixin.Methods.POST: [HasAppPermission("employees.staff.create")],
        PermissionMapMixin.Methods.UPDATE: [HasAppPermission("employees.staff.edit")],
        PermissionMapMixin.Methods.DELETE: [HasAppPermission("employees.staff.remove")]
    }

    def get_queryset(self):
        qs = super().get_queryset()
        university = getattr(self.request, "university", None)
        if university is not None:
            qs = qs.filter(university=university)
        else:
            qs = qs.filter(university__isnull=True)
        return qs

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        if request.user == instance:
            raise ValidationError("Нельзя удалить самого себя")
        self.perform_destroy(instance)
        return Response(status=status.HTTP_204_NO_CONTENT)

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        password = serializer.validated_data.pop("password")
        user = User(**serializer.validated_data)
        user.created_by = request.user
        university = getattr(request, "university", None)
        if university is not None:
            user.university = university
        user.set_password(password)
        user.save()

        if getattr(user, "account_type", None) == AccountType.TEACHER:
            from chats.services import run_on_commit, ensure_admin_teacher_chat
            run_on_commit(ensure_admin_teacher_chat, user, admin=request.user)

        return Response(
            self.get_serializer(user).data,
            status=status.HTTP_201_CREATED
        )
