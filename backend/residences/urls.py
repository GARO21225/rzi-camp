
from rest_framework.routers import DefaultRouter
from .views import BatimentViewSet, PersonnelViewSet, OccupationHistoryViewSet
router = DefaultRouter()
router.register("batiments", BatimentViewSet)
router.register("personnel", PersonnelViewSet)
router.register("occupation-history", OccupationHistoryViewSet)
urlpatterns = router.urls
