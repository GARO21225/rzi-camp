"""
URLs — Induction Module
Toutes les routes API REST
"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    SiteViewSet, CampViewSet, ZoneViewSet, ContractorViewSet,
    EmployeeViewSet,
    DocumentTypeViewSet, EmployeeDocumentViewSet,
    TrainingViewSet, EmployeeTrainingViewSet,
    QuizQuestionViewSet, QuizAttemptViewSet,
    MedicalCheckViewSet,
    AccessBadgeViewSet, AccessLogViewSet, QRScanView,
    InductionWorkflowViewSet,
    DashboardView, ExportView,
)

router = DefaultRouter()

# Infrastructure
router.register(r'sites',        SiteViewSet,       basename='site')
router.register(r'camps',        CampViewSet,       basename='camp')
router.register(r'zones',        ZoneViewSet,       basename='zone')
router.register(r'contractors',  ContractorViewSet, basename='contractor')

# Employés
router.register(r'employees',    EmployeeViewSet,   basename='employee')

# Documents
router.register(r'document-types',     DocumentTypeViewSet,      basename='document-type')
router.register(r'employee-documents', EmployeeDocumentViewSet,  basename='employee-document')

# Formation
router.register(r'trainings',          TrainingViewSet,          basename='training')
router.register(r'employee-trainings', EmployeeTrainingViewSet,  basename='employee-training')

# Quiz
router.register(r'quiz-questions',     QuizQuestionViewSet,      basename='quiz-question')
router.register(r'quiz-attempts',      QuizAttemptViewSet,       basename='quiz-attempt')

# Médical
router.register(r'medical-checks',     MedicalCheckViewSet,      basename='medical-check')

# Accès
router.register(r'badges',       AccessBadgeViewSet,     basename='badge')
router.register(r'access-logs',  AccessLogViewSet,       basename='access-log')

# Workflow
router.register(r'workflows',    InductionWorkflowViewSet, basename='workflow')

urlpatterns = [
    # Router DRF
    path('', include(router.urls)),

    # Endpoints spéciaux
    path('scan/<uuid:site_id>/',             QRScanView.as_view(),     name='qr-scan'),
    path('dashboard/',                        DashboardView.as_view(),  name='dashboard'),
    path('export/<str:export_type>/',         ExportView.as_view(),     name='export'),
]
