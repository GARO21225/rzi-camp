
from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from .models import Batiment, Personnel, OccupationHistory
from .serializers import BatimentSerializer, PersonnelSerializer, OccupationHistorySerializer
import csv, datetime
from django.http import HttpResponse
from natsort import natsorted

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

    def create(self, request, *args, **kwargs):
        if not request.user.is_staff and not request.user.is_superuser:
            return Response({"error":"Seul l'admin peut créer du personnel."}, status=403)
        response = super().create(request, *args, **kwargs)
        p = Personnel.objects.get(id=response.data["id"])
        username, password = p.creer_utilisateur()
        data = dict(response.data)
        data["login_genere"] = username
        data["password_genere"] = password
        return Response(data, status=201)

    @action(detail=True, methods=["post"])
    def regenerer_qr(self, request, pk=None):
        p = self.get_object()
        p.qr_code_data = ""; p.qr_code_string = ""
        p.save(update_fields=["qr_code_data","qr_code_string"])
        p.generer_qr(); p.refresh_from_db()
        return Response(PersonnelSerializer(p).data)

    @action(detail=True, methods=["post"])
    def regenerer_compte(self, request, pk=None):
        if not request.user.is_staff:
            return Response({"error":"Admin uniquement"}, status=403)
        p = self.get_object()
        username, password = p.creer_utilisateur()
        return Response({"login":username,"password":password})

    @action(detail=True, methods=["patch"])
    def assigner_role(self, request, pk=None):
        if not request.user.is_staff and not request.user.is_superuser:
            return Response({"error":"Admin uniquement"}, status=403)
        p = self.get_object()
        role = request.data.get("role")
        if not role:
            return Response({"error":"role requis"}, status=400)
        if p.user:
            from accounts.models import Profile
            Profile.objects.filter(user=p.user).update(role=role)
        return Response({"ok":True,"role":role})

    @action(detail=True, methods=["get"])
    def historique_voyages(self, request, pk=None):
        """Nombre de voyages et destinations pour un personnel"""
        p = self.get_object()
        from voyages.models import Voyage
        voys = Voyage.objects.filter(personnel=p).order_by("-date_depart")
        data = {
            "personnel": f"{p.nom} {p.prenom}",
            "total_voyages": voys.count(),
            "voyages": [
                {
                    "id": v.id,
                    "destination": v.destination or "Non spécifiée",
                    "motif": v.motif,
                    "date_depart": str(v.date_depart),
                    "date_retour_prevue": str(v.date_retour_prevue),
                    "date_retour_effective": str(v.date_retour_effective) if v.date_retour_effective else None,
                    "statut": v.statut,
                    "chambre": v.batiment.residence if v.batiment else None,
                }
                for v in voys
            ]
        }
        return Response(data)

    @action(detail=True, methods=["get"])
    def historique_chambres(self, request, pk=None):
        """Où a dormi ce personnel (avec filtres dates)"""
        p = self.get_object()
        date_debut = request.query_params.get("date_debut")
        date_fin = request.query_params.get("date_fin")
        qs = OccupationHistory.objects.filter(personnel=p).select_related("batiment")
        if date_debut: qs = qs.filter(date_arrivee__gte=date_debut)
        if date_fin: qs = qs.filter(date_arrivee__lte=date_fin)
        return Response(OccupationHistorySerializer(qs, many=True).data)


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
        futur_depart = self.request.query_params.get("futur_depart")
        if statut: qs = qs.filter(statut=statut)
        if bloc: qs = qs.filter(bloc=bloc)
        if residence: qs = qs.filter(residence__icontains=residence)
        if futur_depart == "s1":
            today = datetime.date.today()
            s1_end = today + datetime.timedelta(days=7)
            qs = qs.filter(date_depart__gte=today, date_depart__lte=s1_end)
        items = list(qs)
        return natsorted(items, key=lambda x: x.residence)

    def list(self, request, *args, **kwargs):
        items = self.get_queryset()
        search = request.query_params.get("search","")
        if search:
            items = [x for x in items if search.lower() in x.residence.lower()
                     or search.lower() in (x.occupant or "").lower()
                     or search.lower() in (x.societe or "").lower()]
        serializer = self.get_serializer(items, many=True)
        return Response({"count":len(items),"results":serializer.data})

    def partial_update(self, request, *args, **kwargs):
        """FIX: properly handle personnel assignment and room liberation"""
        instance = self.get_object()
        old_personnel = instance.personnel
        old_statut = instance.statut

        data = request.data.copy()

        # If personnel is provided as ID string, convert
        personnel_id = data.get("personnel")
        personnel_obj = None
        if personnel_id and str(personnel_id).strip() and str(personnel_id) != "null":
            try:
                personnel_obj = Personnel.objects.get(pk=int(personnel_id))
                if not data.get("occupant"):
                    data["occupant"] = f"{personnel_obj.nom} {personnel_obj.prenom}"
                if not data.get("societe"):
                    data["societe"] = personnel_obj.societe
            except (Personnel.DoesNotExist, ValueError):
                pass
        else:
            data["personnel"] = None

        serializer = self.get_serializer(instance, data=data, partial=True)
        serializer.is_valid(raise_exception=True)
        obj = serializer.save()

        # Libre → clear everything
        if obj.statut == "Libre":
            Batiment.objects.filter(pk=obj.pk).update(
                personnel=None, occupant=None, societe=None,
                date_arrivee=None, date_depart=None
            )
            obj.refresh_from_db()
            if old_personnel:
                OccupationHistory.objects.filter(
                    batiment=obj, personnel=old_personnel, date_depart__isnull=True
                ).update(date_depart=datetime.date.today(), motif_depart="Libération manuelle")

        # Occupé → create history
        elif obj.statut == "Occupé" and obj.date_arrivee:
            p = obj.personnel or old_personnel
            if p:
                OccupationHistory.objects.get_or_create(
                    batiment=obj, personnel=p, date_depart__isnull=True,
                    defaults={
                        "occupant_nom": obj.occupant or f"{p.nom} {p.prenom}",
                        "societe": obj.societe or p.societe,
                        "date_arrivee": obj.date_arrivee,
                        "enregistre_par": request.user,
                    }
                )

        return Response(self.get_serializer(obj).data)

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
        today = datetime.date.today()
        s1_end = today + datetime.timedelta(days=7)
        departs_s1 = qs.filter(date_depart__gte=today, date_depart__lte=s1_end).count()
        return Response({
            "total":total,"par_statut":par_statut,"par_bloc":par_bloc,
            "taux_occupation":round(par_statut.get("Occupé",0)/total*100,1) if total else 0,
            "departs_s1":departs_s1,
        })

    @action(detail=False, methods=["get"], permission_classes=[AllowAny])
    def export_csv(self, request):
        qs = natsorted(list(Batiment.objects.select_related("personnel").all()), key=lambda x: x.residence)
        statut = request.query_params.get("statut")
        if statut: qs = [b for b in qs if b.statut==statut]
        response = HttpResponse(content_type="text/csv; charset=utf-8")
        response["Content-Disposition"] = "attachment; filename=residences_rzi.csv"
        response.write("\ufeff")
        writer = csv.writer(response, delimiter=";")
        writer.writerow(["Residence","Bloc","Statut","Occupant","Societe","Type","Telephone","Date arrivee","Date depart"])
        for b in qs:
            p = b.personnel
            writer.writerow([b.residence,b.bloc,b.statut,
                f"{p.nom} {p.prenom}" if p else (b.occupant or ""),
                p.societe if p else (b.societe or ""),
                p.get_type_personnel_display() if p else "",
                p.numero if p else "",
                b.date_arrivee or "", b.date_depart or ""])
        return response

    @action(detail=False, methods=["get"], permission_classes=[AllowAny])
    def export_par_bloc(self, request):
        from django.db.models import Count, Q
        qs = Batiment.objects.values("bloc").annotate(
            total=Count("id"), libres=Count("id",filter=Q(statut="Libre")),
            occupes=Count("id",filter=Q(statut="Occupé")),
            reserves=Count("id",filter=Q(statut="Réservé")),
            maintenance=Count("id",filter=Q(statut="Maintenance")),
        ).order_by("bloc")
        response = HttpResponse(content_type="text/csv; charset=utf-8")
        response["Content-Disposition"] = "attachment; filename=rapport_blocs_rzi.csv"
        response.write("\ufeff")
        writer = csv.writer(response, delimiter=";")
        writer.writerow(["Bloc","Total","Libres","Occupes","Reserves","Maintenance","Taux %"])
        for r in qs:
            taux = round(r["occupes"]/r["total"]*100,1) if r["total"] else 0
            writer.writerow([r["bloc"],r["total"],r["libres"],r["occupes"],r["reserves"],r["maintenance"],taux])
        return response


class OccupationHistoryViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = OccupationHistory.objects.select_related("batiment","personnel").all()
    serializer_class = OccupationHistorySerializer

    def get_queryset(self):
        qs = super().get_queryset()
        batiment = self.request.query_params.get("batiment")
        personnel = self.request.query_params.get("personnel")
        date_debut = self.request.query_params.get("date_debut")
        date_fin = self.request.query_params.get("date_fin")
        if batiment: qs = qs.filter(batiment__residence=batiment)
        if personnel: qs = qs.filter(personnel_id=personnel)
        if date_debut: qs = qs.filter(date_arrivee__gte=date_debut)
        if date_fin: qs = qs.filter(date_arrivee__lte=date_fin)
        return qs

    @action(detail=False, methods=["get"])
    def recherche(self, request):
        """
        Recherche croisée :
        - Chambre X : qui a dormi là entre date1 et date2 ?
        - Personne X : où a-t-elle dormi entre date1 et date2 ?
        """
        batiment = request.query_params.get("batiment")
        personnel_id = request.query_params.get("personnel")
        date_debut = request.query_params.get("date_debut")
        date_fin = request.query_params.get("date_fin")
        nom_search = request.query_params.get("nom")

        qs = OccupationHistory.objects.select_related("batiment","personnel").all()
        if batiment: qs = qs.filter(batiment__residence__icontains=batiment)
        if personnel_id: qs = qs.filter(personnel_id=personnel_id)
        if nom_search: qs = qs.filter(occupant_nom__icontains=nom_search)
        # Date overlap: arrivee <= date_fin AND (depart >= date_debut OR depart is null)
        if date_debut:
            from django.db.models import Q
            qs = qs.filter(Q(date_depart__gte=date_debut)|Q(date_depart__isnull=True))
        if date_fin:
            qs = qs.filter(date_arrivee__lte=date_fin)

        results = []
        for h in qs[:100]:
            d1 = h.date_arrivee
            d2 = h.date_depart or datetime.date.today()
            days = (d2 - d1).days
            results.append({
                "id": h.id,
                "residence": h.batiment.residence,
                "bloc": h.batiment.bloc,
                "occupant": h.occupant_nom,
                "societe": h.societe,
                "personnel_id": h.personnel_id,
                "date_arrivee": str(h.date_arrivee),
                "date_depart": str(h.date_depart) if h.date_depart else None,
                "duree_jours": days,
                "en_cours": h.date_depart is None,
                "motif_depart": h.motif_depart,
            })
        return Response({"count":len(results),"results":results})
