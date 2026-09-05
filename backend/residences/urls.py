
from rest_framework.routers import DefaultRouter
from .views import (InductionRecordViewSet, declarer_soustraitants_masse, BatimentViewSet,
    PersonnelViewSet, OccupationHistoryViewSet, OccupationHistoryAdminViewSet, DemandeViewSet,
    InductionCampConfigViewSet, InductionInfraViewSet, InductionRegleViewSet, InductionQuizQuestionViewSet,
    PointInteretViewSet, CheminCirculationViewSet)
router = DefaultRouter()
router.register(r'induction-records', InductionRecordViewSet, basename='induction-record')
router.register("batiments", BatimentViewSet)
router.register("points-interet", PointInteretViewSet, basename="points-interet")
router.register("chemins-circulation", CheminCirculationViewSet, basename="chemins-circulation")
router.register("personnel", PersonnelViewSet)
router.register("occupation-history", OccupationHistoryViewSet)
router.register("occupation-history-admin", OccupationHistoryAdminViewSet, basename="occupation-history-admin")
router.register("demandes", DemandeViewSet, basename="demandes")
router.register("induction-config", InductionCampConfigViewSet, basename="induction-config")
router.register("induction-infras", InductionInfraViewSet, basename="induction-infra")
router.register("induction-regles", InductionRegleViewSet, basename="induction-regle")
router.register("induction-quiz", InductionQuizQuestionViewSet, basename="induction-quiz")
from django.urls import path
urlpatterns = list(router.urls) + [path("declarer-soustraitants/", declarer_soustraitants_masse)]
