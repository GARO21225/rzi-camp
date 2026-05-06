from rest_framework.routers import DefaultRouter
from .views import BatimentViewSet
router = DefaultRouter()
router.register('batiments', BatimentViewSet)
urlpatterns = router.urls
