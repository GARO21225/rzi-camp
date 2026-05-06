from rest_framework.routers import DefaultRouter
from .views import BatimentViewSet, PersonnelViewSet
router = DefaultRouter()
router.register('batiments', BatimentViewSet)
router.register('personnel', PersonnelViewSet)
urlpatterns = router.urls
