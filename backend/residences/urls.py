
from rest_framework.routers import DefaultRouter
from .views import BatimentViewSet, PersonnelViewSet, OccupationHistoryViewSet, OccupationHistoryAdminViewSet
router = DefaultRouter()
router.register("batiments", BatimentViewSet)
router.register("personnel", PersonnelViewSet)
router.register("occupation-history", OccupationHistoryViewSet)
router.register("occupation-history-admin", OccupationHistoryAdminViewSet, basename="occupation-history-admin")
urlpatterns = router.urls
