from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import MenuJourViewSet, QRTokenViewSet, RepasLogViewSet, AuditLogViewSet, ArticleBoutiqueViewSet, ConsommationBoutiqueViewSet, BonCaisseViewSet, test_conso

router = DefaultRouter()
router.register(r'menu', MenuJourViewSet, basename='menu')
router.register('qr',                    QRTokenViewSet,             basename='qr')
router.register('repas',                 RepasLogViewSet)
router.register('audit',                 AuditLogViewSet)
router.register('boutique/articles',     ArticleBoutiqueViewSet,     basename='article-boutique')
router.register('boutique/consommations',ConsommationBoutiqueViewSet, basename='consommation-boutique')
router.register('boutique/bons',         BonCaisseViewSet,           basename='bon-caisse')

urlpatterns = [
    path('boutique/test-conso/', test_conso, name='test_conso'),
    path('', include(router.urls)),
]
