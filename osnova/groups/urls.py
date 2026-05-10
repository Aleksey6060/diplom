from django.urls import include, path
from rest_framework.routers import DefaultRouter

from groups.views import StudentGroupViewSet, TeacherAttachmentViewSet
from groups.teacher_views import (
    TeacherAssignmentDetailAPIView,
    TeacherAssignmentStudentFileDownloadAPIView,
    TeacherAssignmentStudentGradeAPIView,
    TeacherAssignmentStudentWorkAPIView,
    TeacherGroupAssignmentsAPIView,
    TeacherGroupSemesterScheduleAPIView,
    TeacherGroupSemestersAPIView,
    TeacherMyGroupsAPIView,
)

app_name = "groups"

router = DefaultRouter(trailing_slash='/?')
router.register(r'', StudentGroupViewSet, basename='student-groups')
router.register("(?P<group_id>\d+)/courses/(?P<course_id>\d+)/teachers", TeacherAttachmentViewSet, basename="teacher-attachment")

urlpatterns = [
    path("teacher/my-groups/", TeacherMyGroupsAPIView.as_view(), name="teacher-my-groups"),
    path("teacher/groups/<int:group_id>/semesters/", TeacherGroupSemestersAPIView.as_view(), name="teacher-group-semesters"),
    path("teacher/groups/<int:group_id>/courses/<int:course_id>/semesters/<int:semester_id>/schedule/", TeacherGroupSemesterScheduleAPIView.as_view(), name="teacher-group-semester-schedule"),
    path("teacher/groups/<int:group_id>/assignments/", TeacherGroupAssignmentsAPIView.as_view(), name="teacher-group-assignments"),
    path("teacher/groups/<int:group_id>/assignments/<int:assignment_id>/", TeacherAssignmentDetailAPIView.as_view(), name="teacher-assignment-detail"),
    path("teacher/groups/<int:group_id>/assignments/<int:assignment_id>/students/<int:student_id>/", TeacherAssignmentStudentWorkAPIView.as_view(), name="teacher-assignment-student-work"),
    path("teacher/groups/<int:group_id>/assignments/<int:assignment_id>/students/<int:student_id>/files/<int:file_id>/", TeacherAssignmentStudentFileDownloadAPIView.as_view(), name="teacher-assignment-student-file"),
    path("teacher/groups/<int:group_id>/assignments/<int:assignment_id>/students/<int:student_id>/grade/", TeacherAssignmentStudentGradeAPIView.as_view(), name="teacher-assignment-student-grade"),
    path("", include(router.urls))
]
