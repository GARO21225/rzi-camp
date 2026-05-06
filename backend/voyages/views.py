
from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.response import Response
import datetime
from .models import Voyage
from .serializers import VoyageSerializer

class VoyageViewSet(viewsets.ModelViewSet):
    queryset = Voyage.objects.select_related("personnel","batiment").all()
    serializer_class = VoyageSerializer
    filter_backends = [filters.SearchFilter]
    search_fields = ["personnel__nom","personnel__prenom","destination"]

    def get_queryset(self):
        qs = super().get_queryset()
        statut = self.request.query_params.get("statut")
        personnel = self.request.query_params.get("personnel")
        if statut: qs = qs.filter(statut=statut)
        if personnel: qs = qs.filter(personnel_id=personnel)
        return qs

    @action(detail=True, methods=["post"])
    def partir(self, request, pk=None):
        voyage = self.get_object()
        if voyage.statut != "planifie":
            return Response({"error":"Voyage non planifie"}, status=400)
        voyage.partir()
        return Response(VoyageSerializer(voyage).data)

    @action(detail=True, methods=["post"])
    def revenir(self, request, pk=None):
        voyage = self.get_object()
        if voyage.statut != "en_voyage":
            return Response({"error":"Personnel pas en voyage"}, status=400)
        date = request.data.get("date_retour")
        if date:
            date = datetime.date.fromisoformat(date)
        voyage.revenir(date)
        return Response(VoyageSerializer(voyage).data)

    @action(detail=False, methods=["get"])
    def stats(self, request):
        qs = Voyage.objects.all()
        return Response({
            "total": qs.count(),
            "planifies": qs.filter(statut="planifie").count(),
            "en_voyage": qs.filter(statut="en_voyage").count(),
            "retours": qs.filter(statut="retour").count(),
        })
