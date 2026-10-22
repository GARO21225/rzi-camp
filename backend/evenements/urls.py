from rest_framework.routers import DefaultRouter
from .views import EvenementViewSet,NotificationViewSet,AlerteViewSet,GroupeDiffusionViewSet
from django.urls import path
from . import push_views
router=DefaultRouter()
router.register("evenements",EvenementViewSet,basename="evenement")
router.register("notifications",NotificationViewSet)
router.register("alertes",AlerteViewSet)
router.register("groupes-diffusion",GroupeDiffusionViewSet,basename="groupe-diffusion")
urlpatterns=router.urls + [
    path("push/cle/", push_views.push_cle),
    path("push/abonner/", push_views.push_abonner),
    path("push/desabonner/", push_views.push_desabonner),
    path("push/test/", push_views.push_test),
    path("push/token-natif/", push_views.push_token_natif_enregistrer),
    path("push/token-natif/retirer/", push_views.push_token_natif_retirer),
]
