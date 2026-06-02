
from rest_framework.routers import DefaultRouter
from .views import VoyageViewSet
router = DefaultRouter()
router.register("voyages", VoyageViewSet)
urlpatterns = router.urls
