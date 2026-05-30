from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import IncidentViewSet, declarer_incident, list_incidents, stats_incidents

router = DefaultRouter()
router.register('incidents', IncidentViewSet, basename='incident')

urlpatterns = [
    path('incidents/declarer/', declarer_incident, name='declarer_incident'),
    path('incidents/liste/',    list_incidents,    name='list_incidents'),
    path('incidents/stats-sql/',stats_incidents,   name='stats_incidents'),
    path('', include(router.urls)),
]
