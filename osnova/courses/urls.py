from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .grades_views import (
    AssignmentListCreateAPIView,
    AssignmentRetrieveUpdateDestroyAPIView,
    AssignmentGroupGradesAPIView,
    AssignmentStudentGradeAPIView,
    GradeSetAPIView,
    GradesExportAPIView,
    GroupSubjectGradesAPIView,
    StudentSubjectGradesAPIView,
    StudentCourseProgressAPIView,
)
from .tests_views import (
    TestMaterialDetailAPIView,
    TestQuestionListCreateAPIView,
    TestQuestionRetrieveUpdateDestroyAPIView,
    TestImportExcelAPIView,
    TestStartAPIView,
    TestSubmitAPIView,
    TestResultsAPIView,
    TestAttemptDetailAPIView,
)
from .student_views import (
    StudentAssignmentSubmissionAPIView,
    StudentAssignmentSubmissionFileDetailAPIView,
    StudentAssignmentSubmissionFilesAPIView,
    StudentMyCoursesAPIView,
    StudentMyScheduleAPIView,
    StudentSubjectAssignmentsAPIView,
    StudentTopicAssignmentsAPIView,
    StudentMyGradesAPIView,
)
from .views import (
    CourseListCreateAPIView,
    CourseRetrieveUpdateDestroyAPIView,
    CourseContentsAPIView,
    SemesterCreateAPIView,
    SemesterRetrieveUpdateDestroyAPIView,
    SemesterContentsAPIView,
    SubjectCreateAPIView,
    SubjectRetrieveUpdateDestroyAPIView,
    SubjectContentsAPIView,
    SubjectTestsAPIView,
    TopicCreateAPIView,
    TopicRetrieveUpdateDestroyAPIView,
    TopicContentsAPIView,
    MaterialCreateAPIView,
    MaterialRetrieveUpdateDestroyAPIView,
    MaterialContentsAPIView,
    MaterialFolderCreateAPIView,
    MaterialFolderRetrieveUpdateDestroyAPIView,
    MaterialFolderContentsAPIView,
    MaterialFileCreateAPIView,
    MaterialFileRetrieveUpdateDestroyAPIView,
    CourseFilterViewSet, 
    CourseSubjectsListViewSet, 
    CourseStoreCardViewSet,
)

app_name = "courses"

router = DefaultRouter()
router.register(r"(?P<course_id>\d+)/subjects", CourseSubjectsListViewSet, basename="course-subject")
router.register(r"store-cards", CourseStoreCardViewSet, basename="course-store-card")
router.register(r"filter", CourseFilterViewSet, basename="course-store-card-filter")

urlpatterns = [
    path("", CourseListCreateAPIView.as_view(), name="course-list-create"),
    path("my/", StudentMyCoursesAPIView.as_view(), name="student-my-courses"),
    path("<int:pk>/", CourseRetrieveUpdateDestroyAPIView.as_view(), name="course-detail"),
    path("<int:pk>/contents/", CourseContentsAPIView.as_view(), name="course-contents"),

    path("semesters/", SemesterCreateAPIView.as_view(), name="semester-create"),
    path("semesters/<int:pk>/", SemesterRetrieveUpdateDestroyAPIView.as_view(), name="semester-detail"),
    path("semesters/<int:pk>/contents/", SemesterContentsAPIView.as_view(), name="semester-contents"),

    path("subjects/", SubjectCreateAPIView.as_view(), name="subject-create"),
    path("subjects/<int:pk>/", SubjectRetrieveUpdateDestroyAPIView.as_view(), name="subject-detail"),
    path("subjects/<int:pk>/contents/", SubjectContentsAPIView.as_view(), name="subject-contents"),
    path("subjects/<int:subject_id>/tests/", SubjectTestsAPIView.as_view(), name="subject-tests"),
    path("subjects/<int:subject_id>/assignments/my/", StudentSubjectAssignmentsAPIView.as_view(), name="student-subject-assignments"),
    path("topics/<int:topic_id>/assignments/my/", StudentTopicAssignmentsAPIView.as_view(), name="student-topic-assignments"),
    path("grades/my/", StudentMyGradesAPIView.as_view(), name="student-my-grades"),
    path("schedule/my/", StudentMyScheduleAPIView.as_view(), name="student-my-schedule"),

    path("topics/", TopicCreateAPIView.as_view(), name="topic-create"),
    path("topics/<int:pk>/", TopicRetrieveUpdateDestroyAPIView.as_view(), name="topic-detail"),
    path("topics/<int:pk>/contents/", TopicContentsAPIView.as_view(), name="topic-contents"),

    path("materials/", MaterialCreateAPIView.as_view(), name="material-create"),
    path("materials/<int:pk>/", MaterialRetrieveUpdateDestroyAPIView.as_view(), name="material-detail"),
    path("materials/<int:pk>/contents/", MaterialContentsAPIView.as_view(), name="material-contents"),

    path("folders/", MaterialFolderCreateAPIView.as_view(), name="folder-create"),
    path("folders/<int:pk>/", MaterialFolderRetrieveUpdateDestroyAPIView.as_view(), name="folder-detail"),
    path("folders/<int:pk>/contents/", MaterialFolderContentsAPIView.as_view(), name="folder-contents"),

    path("files/", MaterialFileCreateAPIView.as_view(), name="file-create"),
    path("files/<int:pk>/", MaterialFileRetrieveUpdateDestroyAPIView.as_view(), name="file-detail"),

    # Задания
    path("assignments/", AssignmentListCreateAPIView.as_view(), name="assignment-list-create"),
    path("assignments/<int:pk>/", AssignmentRetrieveUpdateDestroyAPIView.as_view(), name="assignment-detail"),
    path("assignments/<int:assignment_id>/my-submission/", StudentAssignmentSubmissionAPIView.as_view(), name="student-assignment-submission"),
    path("assignments/<int:assignment_id>/my-submission/files/", StudentAssignmentSubmissionFilesAPIView.as_view(), name="student-assignment-submission-files"),
    path("assignments/<int:assignment_id>/my-submission/files/<int:file_id>/", StudentAssignmentSubmissionFileDetailAPIView.as_view(), name="student-assignment-submission-file-detail"),

    # Выставление оценок
    path("grades/", GradeSetAPIView.as_view(), name="grade-set"),

    # Просмотр оценок
    path("grades/group/<int:group_id>/subject/<int:subject_id>/", GroupSubjectGradesAPIView.as_view(), name="grades-group-subject"),
    path("grades/student/<int:student_id>/subject/<int:subject_id>/", StudentSubjectGradesAPIView.as_view(), name="grades-student-subject"),
    path("grades/assignment/<int:assignment_id>/group/<int:group_id>/", AssignmentGroupGradesAPIView.as_view(), name="grades-assignment-group"),
    path("grades/assignment/<int:assignment_id>/student/<int:student_id>/", AssignmentStudentGradeAPIView.as_view(), name="grades-assignment-student"),
    path("progress/group/<int:group_id>/course/<int:course_id>/student/<int:student_id>/", StudentCourseProgressAPIView.as_view(), name="student-course-progress"),

    # Выгрузка в Excel
    path("grades/export/group/<int:group_id>/subject/<int:subject_id>/", GradesExportAPIView.as_view(), name="grades-export"),

    # Тесты
    path("tests/<int:test_id>/", TestMaterialDetailAPIView.as_view(), name="test-detail"),
    path("tests/<int:test_id>/questions/", TestQuestionListCreateAPIView.as_view(), name="test-questions"),
    path("tests/<int:test_id>/import/", TestImportExcelAPIView.as_view(), name="test-import-excel"),
    path("tests/questions/<int:pk>/", TestQuestionRetrieveUpdateDestroyAPIView.as_view(), name="test-question-detail"),

    # Прохождение тестов (студент)
    path("tests/<int:test_id>/start/", TestStartAPIView.as_view(), name="test-start"),
    path("tests/<int:test_id>/submit/", TestSubmitAPIView.as_view(), name="test-submit"),
    path("tests/<int:test_id>/results/", TestResultsAPIView.as_view(), name="test-results"),
    path("tests/attempts/<int:attempt_id>/", TestAttemptDetailAPIView.as_view(), name="test-attempt-detail"),

    path(r"", include(router.urls)),
]
