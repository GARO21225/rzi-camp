from rest_framework import viewsets, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from .models import Batiment
from .serializers import BatimentSerializer, BatimentGeoSerializer

class BatimentViewSet(viewsets.ModelViewSet):
    queryset = Batiment.objects.all()
    serializer_class = BatimentSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['residence', 'bloc', 'occupant', 'societe']
    filterset_fields = ['statut', 'bloc']

    def get_queryset(self):
        qs = super().get_queryset()
        statut = self.request.query_params.get('statut')
        bloc = self.request.query_params.get('bloc')
        if statut: qs = qs.filter(statut=statut)
        if bloc: qs = qs.filter(bloc=bloc)
        return qs

    @action(detail=False, methods=['get'])
    def geojson(self, request):
        batiments = self.get_queryset()
        features = []
        for b in batiments:
            if b.geojson_geometry:
                features.append({
                    'type': 'Feature',
                    'properties': {
                        'id': b.id,
                        'residence': b.residence,
                        'bloc': b.bloc,
                        'statut': b.statut,
                        'occupant': b.occupant,
                        'societe': b.societe,
                    },
                    'geometry': b.geojson_geometry
                })
        return Response({'type': 'FeatureCollection', 'features': features})

    @action(detail=False, methods=['get'])
    def stats(self, request):
        from django.db.models import Count
        qs = Batiment.objects.all()
        total = qs.count()
        par_statut = dict(qs.values_list('statut').annotate(n=Count('id')).values_list('statut','n'))
        par_bloc = list(qs.values('bloc').annotate(total=Count('id')).order_by('bloc'))
        return Response({
            'total': total,
            'par_statut': par_statut,
            'par_bloc': par_bloc,
            'taux_occupation': round(par_statut.get('Occupé',0)/total*100, 1) if total else 0,
        })
