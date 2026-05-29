from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import IncidentViewSet, declarer_incident

router = DefaultRouter()
router.register('incidents', IncidentViewSet, basename='incident')

urlpatterns = [
    path('incidents/declarer/', declarer_incident, name='declarer_incident'),
    path('', include(router.urls)),
]
