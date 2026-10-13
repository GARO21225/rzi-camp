from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import MenuJourViewSet, QRTokenViewSet, RepasLogViewSet, AuditLogViewSet, ArticleBoutiqueViewSet, ConsommationBoutiqueViewSet, BonCaisseViewSet, AvisRestaurationViewSet, QuestionAvisViewSet
from .restaurants import RestaurantViewSet

router = DefaultRouter()
router.register(r'menu', MenuJourViewSet, basename='menu')
router.register('qr',                    QRTokenViewSet,             basename='qr')
router.register('restaurants', RestaurantViewSet, basename='restaurant')
router.register('repas',                 RepasLogViewSet)
router.register('audit',                 AuditLogViewSet)
router.register('avis',                  AvisRestaurationViewSet,    basename='avis-restauration')
router.register('questions-avis',        QuestionAvisViewSet,        basename='questions-avis')
router.register('boutique/articles',     ArticleBoutiqueViewSet,     basename='article-boutique')
router.register('boutique/consommations',ConsommationBoutiqueViewSet, basename='consommation-boutique')
router.register('boutique/bons',         BonCaisseViewSet,           basename='bon-caisse')

urlpatterns = [
    path('', include(router.urls)),
]
