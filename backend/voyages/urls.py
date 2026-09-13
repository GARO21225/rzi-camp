
from rest_framework.routers import DefaultRouter
from .views import VoyageViewSet, EtapeVoyageViewSet, VehiculeFlotteViewSet
router = DefaultRouter()
router.register("voyages", VoyageViewSet)
router.register("etapes-voyage", EtapeVoyageViewSet, basename="etapes-voyage")
router.register("vehicules-flotte", VehiculeFlotteViewSet, basename="vehicules-flotte")
urlpatterns = router.urls
