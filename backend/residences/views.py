
from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from .models import Batiment, Personnel, OccupationHistory
from .serializers import BatimentSerializer, PersonnelSerializer, OccupationHistorySerializer
import csv
from django.http import HttpResponse

class PersonnelViewSet(viewsets.ModelViewSet):
    queryset = Personnel.objects.all()
    serializer_class = PersonnelSerializer
    filter_backends = [filters.SearchFilter]
    search_fields = ["nom","prenom","societe","numero"]

    def get_queryset(self):
        qs = super().get_queryset()
        t = self.request.query_params.get("type_personnel")
        if t: qs = qs.filter(type_personnel=t)
        return qs

    @action(detail=True, methods=["post"])
    def regenerer_qr(self, request, pk=None):
        p = self.get_object()
        p.qr_code_data = ""
        p.save()
        p.refresh_from_db()
        return Response(PersonnelSerializer(p).data)


class BatimentViewSet(viewsets.ModelViewSet):
    queryset = Batiment.objects.select_related("personnel").all()
    serializer_class = BatimentSerializer
    filter_backends = [filters.SearchFilter]
    search_fields = ["residence","bloc","occupant","societe"]

    def get_queryset(self):
        qs = super().get_queryset()
        statut = self.request.query_params.get("statut")
        bloc = self.request.query_params.get("bloc")
        residence = self.request.query_params.get("residence")
        if statut: qs = qs.filter(statut=statut)
        if bloc: qs = qs.filter(bloc=bloc)
        if residence: qs = qs.filter(residence__icontains=residence)
        return qs

    def partial_update(self, request, *args, **kwargs):
        instance = self.get_object()
        old_personnel = instance.personnel
        serializer = self.get_serializer(instance, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        obj = serializer.save()

        # Create occupation history if assigning
        if obj.statut == "Occupé" and obj.personnel and obj.date_arrivee:
            OccupationHistory.objects.get_or_create(
                batiment=obj, personnel=obj.personnel,
                date_depart__isnull=True,
                defaults={
                    "occupant_nom": f"{obj.personnel.nom} {obj.personnel.prenom}",
                    "societe": obj.personnel.societe,
                    "date_arrivee": obj.date_arrivee or __import__("datetime").date.today(),
                    "enregistre_par": request.user,
                }
            )
        # Close history if freeing room
        if obj.statut == "Libre" and old_personnel:
            import datetime
            OccupationHistory.objects.filter(batiment=obj, personnel=old_personnel, date_depart__isnull=True).update(
                date_depart=obj.date_depart or datetime.date.today()
            )
        return Response(serializer.data)

    @action(detail=False, methods=["get"])
    def geojson(self, request):
        statut = request.query_params.get("statut","")
        bloc = request.query_params.get("bloc","")
        residence = request.query_params.get("residence","")
        qs = Batiment.objects.select_related("personnel").all()
        if statut: qs = qs.filter(statut=statut)
        if bloc: qs = qs.filter(bloc=bloc)
        if residence: qs = qs.filter(residence__icontains=residence)
        features = []
        for b in qs:
            if b.geojson_geometry:
                p = b.personnel
                features.append({
                    "type":"Feature",
                    "properties":{
                        "id":b.id,"residence":b.residence,"bloc":b.bloc,"statut":b.statut,
                        "occupant":f"{p.nom} {p.prenom}" if p else b.occupant,
                        "societe":p.societe if p else b.societe,
                        "latitude":b.latitude,"longitude":b.longitude,
                    },
                    "geometry":b.geojson_geometry
                })
        return Response({"type":"FeatureCollection","features":features})

    @action(detail=False, methods=["get"])
    def stats(self, request):
        from django.db.models import Count
        qs = Batiment.objects.all()
        total = qs.count()
        par_statut = dict(qs.values_list("statut").annotate(n=Count("id")).values_list("statut","n"))
        par_bloc = list(qs.values("bloc").annotate(total=Count("id")).order_by("bloc"))
        return Response({
            "total":total,"par_statut":par_statut,"par_bloc":par_bloc,
            "taux_occupation":round(par_statut.get("Occupé",0)/total*100,1) if total else 0,
        })

    @action(detail=False, methods=["get"], permission_classes=[AllowAny])
    def export_csv(self, request):
        qs = self.get_queryset()
        response = HttpResponse(content_type="text/csv; charset=utf-8")
        response["Content-Disposition"] = "attachment; filename=residences_rzi.csv"
        response.write("\ufeff")
        writer = csv.writer(response, delimiter=";")
        writer.writerow(["Residence","Bloc","Statut","Occupant","Societe","Type","Telephone","Date arrivee","Date depart","Latitude","Longitude"])
        for b in qs:
            p = b.personnel
            writer.writerow([b.residence,b.bloc,b.statut,
                f"{p.nom} {p.prenom}" if p else (b.occupant or ""),
                p.societe if p else (b.societe or ""),
                p.get_type_personnel_display() if p else "",
                p.numero if p else "",
                b.date_arrivee or "", b.date_depart or "",
                b.latitude or "", b.longitude or ""])
        return response

    @action(detail=False, methods=["get"], permission_classes=[AllowAny])
    def export_par_bloc(self, request):
        from django.db.models import Count, Q
        qs = Batiment.objects.values("bloc").annotate(
            total=Count("id"),
            libres=Count("id",filter=Q(statut="Libre")),
            occupes=Count("id",filter=Q(statut="Occupé")),
            reserves=Count("id",filter=Q(statut="Réservé")),
            maintenance=Count("id",filter=Q(statut="Maintenance")),
        ).order_by("bloc")
        response = HttpResponse(content_type="text/csv; charset=utf-8")
        response["Content-Disposition"] = "attachment; filename=rapport_blocs_rzi.csv"
        response.write("\ufeff")
        writer = csv.writer(response, delimiter=";")
        writer.writerow(["Bloc","Total","Libres","Occupes","Reserves","Maintenance","Taux occupation %"])
        for r in qs:
            taux = round(r["occupes"]/r["total"]*100,1) if r["total"] else 0
            writer.writerow([r["bloc"],r["total"],r["libres"],r["occupes"],r["reserves"],r["maintenance"],taux])
        return response


class OccupationHistoryViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = OccupationHistory.objects.select_related("batiment","personnel").all()
    serializer_class = OccupationHistorySerializer
    filter_backends = [filters.SearchFilter]
    search_fields = ["batiment__residence","occupant_nom","societe"]

    def get_queryset(self):
        qs = super().get_queryset()
        batiment = self.request.query_params.get("batiment")
        personnel = self.request.query_params.get("personnel")
        if batiment: qs = qs.filter(batiment__residence=batiment)
        if personnel: qs = qs.filter(personnel_id=personnel)
        return qs
