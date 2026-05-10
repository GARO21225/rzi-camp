from rest_framework.routers import DefaultRouter
from .views import QRTokenViewSet, RepasLogViewSet, AuditLogViewSet
router = DefaultRouter()
router.register('qr', QRTokenViewSet)
router.register('repas', RepasLogViewSet)
router.register('audit', AuditLogViewSet)
urlpatterns = router.urls
