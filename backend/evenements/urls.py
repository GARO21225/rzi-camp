from rest_framework.routers import DefaultRouter
from .views import EvenementViewSet,NotificationViewSet,AlerteViewSet
router=DefaultRouter()
router.register("evenements",EvenementViewSet)
router.register("notifications",NotificationViewSet)
router.register("alertes",AlerteViewSet)
urlpatterns=router.urls
