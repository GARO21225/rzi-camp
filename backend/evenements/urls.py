from rest_framework.routers import DefaultRouter
from .views import EvenementViewSet,NotificationViewSet,AlerteViewSet,GroupeDiffusionViewSet
router=DefaultRouter()
router.register("evenements",EvenementViewSet,basename="evenement")
router.register("notifications",NotificationViewSet)
router.register("alertes",AlerteViewSet)
router.register("groupes-diffusion",GroupeDiffusionViewSet,basename="groupe-diffusion")
urlpatterns=router.urls
