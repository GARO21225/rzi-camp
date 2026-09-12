
from rest_framework.routers import DefaultRouter
from .views import VoyageViewSet, EtapeVoyageViewSet
router = DefaultRouter()
router.register("voyages", VoyageViewSet)
router.register("etapes-voyage", EtapeVoyageViewSet, basename="etapes-voyage")
urlpatterns = router.urls
