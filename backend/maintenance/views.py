from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils import timezone
from .models import Incident
from .serializers import IncidentSerializer

class IncidentViewSet(viewsets.ModelViewSet):
    queryset = Incident.objects.all()
    serializer_class = IncidentSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['titre', 'residence', 'bloc']

    def get_queryset(self):
        qs = super().get_queryset()
        statut = self.request.query_params.get('statut')
        priorite = self.request.query_params.get('priorite')
        if statut: qs = qs.filter(statut=statut)
        if priorite: qs = qs.filter(priorite=priorite)
        return qs

    @action(detail=True, methods=['post'])
    def resoudre(self, request, pk=None):
        incident = self.get_object()
        incident.statut = 'Résolu'
        incident.date_resolution = timezone.now()
        incident.save()
        return Response({'status': 'Résolu', 'date': incident.date_resolution})

    @action(detail=False, methods=['get'])
    def stats(self, request):
        from django.db.models import Count
        qs = Incident.objects.all()
        return Response({
            'total': qs.count(),
            'ouverts': qs.filter(statut='Ouvert').count(),
            'en_cours': qs.filter(statut='En cours').count(),
            'resolus': qs.filter(statut='Résolu').count(),
            'par_priorite': dict(qs.values_list('priorite').annotate(n=Count('id')).values_list('priorite','n')),
        })
