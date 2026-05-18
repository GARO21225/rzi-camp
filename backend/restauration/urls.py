from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import QRTokenViewSet, RepasLogViewSet, AuditLogViewSet, ArticleBoutiqueViewSet, ConsommationBoutiqueViewSet

router = DefaultRouter()
router.register('qr',                    QRTokenViewSet,             basename='qr')
router.register('repas',                 RepasLogViewSet)
router.register('audit',                 AuditLogViewSet)
router.register('boutique/articles',     ArticleBoutiqueViewSet,     basename='article-boutique')
router.register('boutique/consommations',ConsommationBoutiqueViewSet, basename='consommation-boutique')

urlpatterns = [path('', include(router.urls))]
