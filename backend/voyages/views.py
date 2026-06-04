from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
import datetime, csv, uuid
from django.http import HttpResponse
from .models import Voyage
from .serializers import VoyageSerializer

STATUT_MAP = {
    "planifie":"Planifié",
    "en_voyage":"En voyage",
    "retour":"Retour au camp",
    "annule":"Annulé",
}

class VoyageViewSet(viewsets.ModelViewSet):
    queryset = Voyage.objects.select_related("personnel","batiment","enregistre_par").all()
    serializer_class = VoyageSerializer
    filter_backends = [filters.SearchFilter]
    search_fields = ["personnel__nom","personnel__prenom","destination"]

    def get_queryset(self):
        qs = Voyage.objects.select_related("personnel","batiment").all()
        statut = self.request.query_params.get("statut")
        personnel = self.request.query_params.get("personnel")
        rotation = self.request.query_params.get("rotation_id")
        if statut: qs = qs.filter(statut=statut)
        if personnel: qs = qs.filter(personnel_id=personnel)
        if rotation: qs = qs.filter(rotation_id=rotation)
        return qs

    def perform_create(self, serializer):
        voyage = serializer.save(enregistre_par=self.request.user)
        try:
            from evenements.models import SimpleNotification
            from django.contrib.auth.models import User
            for admin in User.objects.filter(is_staff=True)[:5]:
                SimpleNotification.objects.create(
                    user=admin,
                    titre="✈️ Nouveau voyage déclaré",
                    message=f"Départ vers {voyage.destination} le {voyage.date_depart}",
                    type_notif="voyage", lu=False
                )
        except Exception:
            pass

    def destroy(self, request, *args, **kwargs):
        u = request.user
        is_admin = u.is_staff or u.is_superuser or (hasattr(u,"profile") and getattr(u.profile,"role","")=="admin")
        if not is_admin:
            return Response({"error":"Admin requis"}, status=403)
        return super().destroy(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        u = request.user
        is_admin = u.is_staff or u.is_superuser or (hasattr(u,"profile") and getattr(u.profile,"role","")=="admin")
        if not is_admin:
            return Response({"error":"Admin requis"}, status=403)
        return super().partial_update(request, *args, **kwargs)

    # ── Actions individuelles ──────────────────────────────────────
    @action(detail=True, methods=["post"])
    def partir(self, request, pk=None):
        voyage = self.get_object()
        if voyage.statut != "planifie":
            return Response({"error":"Voyage non planifié"}, status=400)
        voyage.partir()
        return Response(VoyageSerializer(voyage).data)

    @action(detail=True, methods=["post"])
    def revenir(self, request, pk=None):
        voyage = self.get_object()
        if voyage.statut != "en_voyage":
            return Response({"error":"Personnel pas en voyage"}, status=400)
        date_str = request.data.get("date_retour")
        date = datetime.date.fromisoformat(date_str) if date_str else None
        voyage.revenir(date)
        return Response(VoyageSerializer(voyage).data)

    @action(detail=True, methods=["post"])
    def annuler(self, request, pk=None):
        voyage = self.get_object()
        if voyage.statut == "en_voyage":
            return Response({"error":"Impossible d annuler un voyage déjà commencé"}, status=400)
        if voyage.statut == "retour":
            return Response({"error":"Voyage déjà terminé"}, status=400)
        voyage.statut = "annule"
        voyage.save()
        return Response({"ok": True})

    @action(detail=True, methods=["delete"])
    def supprimer_planifie(self, request, pk=None):
        voyage = self.get_object()
        if voyage.statut != "planifie":
            return Response({"error":"Seuls les voyages planifiés peuvent être supprimés"}, status=400)
        voyage.delete()
        return Response({"ok": True})

    # ── Stats ──────────────────────────────────────────────────────
    @action(detail=False, methods=["get"])
    def stats(self, request):
        qs = Voyage.objects.all()
        return Response({
            "total":    qs.count(),
            "planifies":qs.filter(statut="planifie").count(),
            "en_voyage":qs.filter(statut="en_voyage").count(),
            "retours":  qs.filter(statut="retour").count(),
            "annules":  qs.filter(statut="annule").count(),
        })

    # ── Rotations groupe ───────────────────────────────────────────
    @action(detail=False, methods=["get"])
    def rotations(self, request):
        from django.db.models import Count
        groupes = (Voyage.objects
            .exclude(rotation_id__isnull=True).exclude(rotation_id="")
            .values("rotation_id","destination","date_depart","date_retour_prevue",
                    "vehicule","nb_places_total","heure_depart","point_rdv",
                    "type_voyage","statut","motif")
            .annotate(nb_passagers=Count("id"))
            .order_by("-date_depart"))
        result = []
        for g in groupes:
            passagers = list(Voyage.objects.filter(rotation_id=g["rotation_id"])
                .select_related("personnel")
                .values("id","personnel__nom","personnel__prenom",
                        "personnel__societe","statut"))
            g["passagers"] = passagers
            g["places_libres"] = max(0,(g["nb_places_total"] or 15)-g["nb_passagers"])
            result.append(g)
        indiv = list(Voyage.objects
            .filter(rotation_id__isnull=True)
            .select_related("personnel")
            .values("id","personnel__nom","personnel__prenom","destination","date_depart","statut")
            .order_by("-date_depart")[:50])
        return Response({"rotations":result,"individuels":indiv,"total_rotations":len(result)})

    @action(detail=False, methods=["post"])
    def creer_rotation(self, request):
        data = request.data
        rotation_id     = str(uuid.uuid4())[:8].upper()
        destination     = data.get("destination","")
        date_depart     = data.get("date_depart")
        date_retour     = data.get("date_retour_prevue")
        vehicule        = data.get("vehicule","")
        nb_places       = int(data.get("nb_places_total",15))
        heure_depart    = data.get("heure_depart") or None
        point_rdv       = data.get("point_rdv","")
        motif           = data.get("motif","")
        type_voyage     = data.get("type_voyage","rotation")
        passagers_ids   = data.get("passagers",[])
        if not date_depart or not date_retour:
            return Response({"error":"date_depart et date_retour_prevue requis"},status=400)
        created = []
        for pid in passagers_ids:
            try:
                v = Voyage.objects.create(
                    personnel_id=pid, destination=destination,
                    date_depart=date_depart, date_retour_prevue=date_retour,
                    vehicule=vehicule, nb_places_total=nb_places,
                    heure_depart=heure_depart, point_rdv=point_rdv,
                    motif=motif, type_voyage=type_voyage,
                    rotation_id=rotation_id, statut="planifie",
                    enregistre_par=request.user,
                )
                created.append(v.id)
            except Exception:
                pass
        return Response({"rotation_id":rotation_id,"voyages_crees":len(created),"ids":created},status=201)

    @action(detail=False, methods=["post"])
    def rejoindre_rotation(self, request):
        rotation_id  = request.data.get("rotation_id")
        personnel_id = request.data.get("personnel_id")
        if not rotation_id or not personnel_id:
            return Response({"error":"rotation_id et personnel_id requis"},status=400)
        existing = Voyage.objects.filter(rotation_id=rotation_id).first()
        if not existing:
            return Response({"error":"Rotation introuvable"},status=404)
        prises = Voyage.objects.filter(rotation_id=rotation_id).count()
        if prises >= (existing.nb_places_total or 15):
            return Response({"error":"Rotation complète"},status=400)
        if Voyage.objects.filter(rotation_id=rotation_id,personnel_id=personnel_id).exists():
            return Response({"error":"Déjà inscrit sur cette rotation"},status=400)
        v = Voyage.objects.create(
            personnel_id=personnel_id, destination=existing.destination,
            date_depart=existing.date_depart, date_retour_prevue=existing.date_retour_prevue,
            vehicule=existing.vehicule, nb_places_total=existing.nb_places_total,
            heure_depart=existing.heure_depart, point_rdv=existing.point_rdv,
            motif=existing.motif, type_voyage=existing.type_voyage,
            rotation_id=rotation_id, statut="planifie",
            enregistre_par=request.user,
        )
        return Response(VoyageSerializer(v).data,status=201)

    @action(detail=False, methods=["post"])
    def partir_rotation(self, request):
        rotation_id = request.data.get("rotation_id")
        if not rotation_id:
            return Response({"error":"rotation_id requis"},status=400)
        count = 0
        for v in Voyage.objects.filter(rotation_id=rotation_id,statut="planifie"):
            try: v.partir(); count+=1
            except Exception: pass
        return Response({"ok":True,"partis":count})

    @action(detail=False, methods=["post"])
    def retour_rotation(self, request):
        rotation_id = request.data.get("rotation_id")
        if not rotation_id:
            return Response({"error":"rotation_id requis"},status=400)
        date_str = request.data.get("date_retour")
        date = datetime.date.fromisoformat(date_str) if date_str else None
        count = 0
        for v in Voyage.objects.filter(rotation_id=rotation_id,statut="en_voyage"):
            try: v.revenir(date); count+=1
            except Exception: pass
        return Response({"ok":True,"rentres":count})

    # ── Vue ensemble ───────────────────────────────────────────────
    @action(detail=False, methods=["get"])
    def vue_ensemble(self, request):
        qs = Voyage.objects.select_related("personnel","batiment").order_by("-date_depart")
        from django.db.models import Count
        top = (Voyage.objects.values("personnel__nom","personnel__prenom","personnel_id")
               .annotate(nb=Count("id")).order_by("-nb")[:10])
        voyages_data = [{
            "id":v.id,
            "personnel":f"{v.personnel.nom} {v.personnel.prenom}" if v.personnel else "—",
            "societe":v.personnel.societe if v.personnel else "—",
            "chambre":v.batiment.residence if v.batiment else "—",
            "destination":v.destination or "—",
            "date_depart":str(v.date_depart),
            "date_retour_prevue":str(v.date_retour_prevue),
            "date_retour_effective":str(v.date_retour_effective) if v.date_retour_effective else None,
            "statut":v.statut,"statut_label":STATUT_MAP.get(v.statut,v.statut),
            "rotation_id":v.rotation_id or "",
            "vehicule":v.vehicule or "",
        } for v in qs[:200]]
        return Response({"total":qs.count(),"en_voyage":qs.filter(statut="en_voyage").count(),
                         "top_voyageurs":list(top),"voyages":voyages_data})

    # ── Export CSV ─────────────────────────────────────────────────
    @action(detail=False, methods=["get"], permission_classes=[AllowAny])
    def export_csv(self, request):
        qs = Voyage.objects.select_related("personnel","batiment").order_by("-date_depart")
        response = HttpResponse(content_type="text/csv; charset=utf-8")
        response["Content-Disposition"] = "attachment; filename=voyages_rzi.csv"
        response.write("\ufeff")
        writer = csv.writer(response,delimiter=";")
        writer.writerow(["Personnel","Societe","Chambre","Rotation","Vehicule",
                         "Destination","Motif","Depart","Retour prevu","Statut"])
        for v in qs:
            p = v.personnel
            writer.writerow([
                f"{p.nom} {p.prenom}" if p else "",
                p.societe if p else "",
                v.batiment.residence if v.batiment else "",
                v.rotation_id or "",v.vehicule or "",
                v.destination or "",v.motif or "",
                str(v.date_depart),str(v.date_retour_prevue),
                STATUT_MAP.get(v.statut,v.statut),
            ])
        return response
