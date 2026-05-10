from django.urls import path, include
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView, TokenVerifyView
from rest_framework.routers import DefaultRouter

from .views import (
    FilesProfileViewSet,
    MeAccessAPIView,
    MeProfileAPIView,
    PasswordResetConfirmView,
    PasswordResetRequestView,
    PermissionModuleListAPIView,
    RoleListCreateAPIView,
    RoleRetrieveUpdateDestroyAPIView,
    RoleStaffListAPIView,
    StaffListCreateAPIView,
    StaffRetrieveUpdateAPIView,
    StaffsViewSet,
    StudentsViewSet,
    LoginViewSet,
    user_logout
)

app_name = "users"

router = DefaultRouter()
router.register(prefix="students", viewset=StudentsViewSet, basename="students")
router.register(r'students/(?P<student_id>\d+)/files', FilesProfileViewSet, basename='student-files')
router.register(r'staffs', StaffsViewSet, basename='staffs')

urlpatterns = [
    path("me/", MeProfileAPIView.as_view(), name="me"),
    path("me/access/", MeAccessAPIView.as_view(), name="me-access"),

    path("permission-modules/", PermissionModuleListAPIView.as_view(), name="permission-modules"),

    path("roles/", RoleListCreateAPIView.as_view(), name="roles-list-create"),
    path("roles/<int:pk>/", RoleRetrieveUpdateDestroyAPIView.as_view(), name="roles-detail"),
    path("roles/<int:pk>/staffs/", RoleStaffListAPIView.as_view(), name="role-staffs"),

    path("staff/", StaffListCreateAPIView.as_view(), name="staff-list-create"),
    path("staff/<int:pk>/", StaffRetrieveUpdateAPIView.as_view(), name="staff-detail"),

    path('login/', LoginViewSet.as_view(), name='login'),
    path('logout/', user_logout, name='logout'),
    path('password-reset/', PasswordResetRequestView.as_view(), name='password-reset'),
    path('password-reset/confirm/', PasswordResetConfirmView.as_view(), name='password-reset-confirm'),

    path('token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('token/verify/', TokenVerifyView.as_view(), name='token_verify'),

    path('', include(router.urls)),

]
