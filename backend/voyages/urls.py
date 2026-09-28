
from rest_framework.routers import DefaultRouter
from .views import VoyageViewSet, EtapeVoyageViewSet, VehiculeFlotteViewSet, ItineraireModeleViewSet, EtapeItineraireModeleViewSet
router = DefaultRouter()
router.register("voyages", VoyageViewSet)
router.register("etapes-voyage", EtapeVoyageViewSet, basename="etapes-voyage")
router.register("vehicules-flotte", VehiculeFlotteViewSet, basename="vehicules-flotte")
router.register("itineraires-modeles", ItineraireModeleViewSet, basename="itineraires-modeles")
router.register("etapes-itineraires-modeles", EtapeItineraireModeleViewSet, basename="etapes-itineraires-modeles")
urlpatterns = router.urls
