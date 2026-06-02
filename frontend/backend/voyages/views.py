
from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
import datetime, csv
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

    def perform_create(self, serializer):
        """Créer le voyage et notifier les admins"""
        voyage = serializer.save(
            enregistre_par=self.request.user,
            statut='planifie'
        )
        # Notification admin (optionnel, ne bloque pas)
        try:
            from evenements.models import SimpleNotification
            from accounts.models import Profile
            from django.contrib.auth.models import User as DU
            user = self.request.user
            nom  = user.get_full_name() or user.username
            admins = set(DU.objects.filter(is_staff=True))
            for p in Profile.objects.filter(role="admin").select_related("user"):
                admins.add(p.user)
            for admin in admins:
                SimpleNotification.objects.create(
                    user=admin,
                    titre=f"✈️ Voyage planifié — {nom}",
                    message=f"{nom} → {voyage.destination} (départ: {voyage.date_depart})",
                    type_notif="demande"
                )
        except Exception:
            pass

        # SMS admin
        try:
            from rzi_camp.notifications import notifier_admins_sms
            notifier_admins_sms(f"✈️ Voyage: {str(voyage.personnel)[:20]} → {voyage.destination[:20]}")
        except Exception:
            pass


    def destroy(self, request, *args, **kwargs):
        u = request.user
        is_admin = u.is_staff or u.is_superuser or (hasattr(u,'profile') and getattr(u.profile,'role','')=='admin')
        if not is_admin:
            return Response({"error": "Admin requis"}, status=403)
        return super().destroy(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        u = request.user
        is_admin = u.is_staff or u.is_superuser or (hasattr(u,'profile') and getattr(u.profile,'role','')=='admin')
        if not is_admin:
            return Response({"error": "Admin requis"}, status=403)
        return super().partial_update(request, *args, **kwargs)

    def perform_create(self, serializer):
        voyage = serializer.save()
        try:
            from evenements.models import SimpleNotification
            from residences.models import Personnel
            # Notifier les admins/managers
            from django.contrib.auth.models import User
            admins = User.objects.filter(is_staff=True)
            for admin in admins[:5]:
                SimpleNotification.objects.create(
                    user=admin,
                    titre='✈️ Nouveau voyage déclaré',
                    message=f"Départ vers {voyage.destination} le {voyage.date_depart}",
                    type_notif='voyage', lu=False
                )
        except Exception:
            pass


    def get_queryset(self):
        qs = Voyage.objects.select_related("personnel","batiment").all()
        statut = self.request.query_params.get("statut")
        personnel = self.request.query_params.get("personnel")
        if statut: qs = qs.filter(statut=statut)
        if personnel: qs = qs.filter(personnel_id=personnel)
        return qs

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

    @action(detail=False, methods=["get"])
    def stats(self, request):
        qs = Voyage.objects.all()
        return Response({
            "total": qs.count(),
            "planifies": qs.filter(statut="planifie").count(),
            "en_voyage": qs.filter(statut="en_voyage").count(),
            "retours": qs.filter(statut="retour").count(),
            "annules": qs.filter(statut="annule").count(),
        })


    @action(detail=True, methods=["post"])
    def annuler(self, request, pk=None):
        """
        Annule un voyage planifié SANS toucher à la chambre ni à l'historique.
        Utilisé pour corriger une erreur de déclaration.
        """
        voyage = self.get_object()
        if voyage.statut == "en_voyage":
            return Response({"error":"Impossible d'annuler un voyage déjà commencé. Utilisez 'revenir' à la place."}, status=400)
        if voyage.statut == "retour":
            return Response({"error":"Voyage déjà terminé"}, status=400)
        voyage.statut = "annule"
        voyage.save()
        return Response({"ok":True,"message":"Voyage annulé. Aucune modification de chambre ni d'historique."})

    @action(detail=True, methods=["delete"])
    def supprimer_planifie(self, request, pk=None):
        """
        Supprime complètement un voyage planifié (erreur de déclaration).
        Ne crée aucune entrée dans l'historique.
        """
        voyage = self.get_object()
        if voyage.statut != "planifie":
            return Response({"error":"Seuls les voyages planifiés peuvent être supprimés. Pour annuler un voyage en cours, utilisez l'action 'annuler'."}, status=400)
        voyage_info = str(voyage)
        voyage.delete()
        return Response({"ok":True,"message":f"Voyage supprimé: {voyage_info}. Aucune trace dans l'historique."})

    @action(detail=False, methods=["get"])
    def vue_ensemble(self, request):
        """Vue globale de tous les voyages avec stats par personnel"""
        qs = Voyage.objects.select_related("personnel","batiment").order_by("-date_depart")
        from django.db.models import Count, Q
        # Stats globales
        total = qs.count()
        en_voyage = qs.filter(statut="en_voyage").count()
        destinations = list(Voyage.objects.exclude(destination="").exclude(destination__isnull=True)
                            .values_list("destination",flat=True).distinct())
        # Top voyageurs
        from residences.models import Personnel
        top = (Voyage.objects.values("personnel__nom","personnel__prenom","personnel__societe","personnel_id")
               .annotate(nb=Count("id")).order_by("-nb")[:10])
        voyages_data = [{
            "id":v.id,
            "personnel":f"{v.personnel.nom} {v.personnel.prenom}" if v.personnel else "—",
            "societe":v.personnel.societe if v.personnel else "—",
            "type":v.personnel.get_type_personnel_display() if v.personnel else "—",
            "chambre":v.batiment.residence if v.batiment else "—",
            "destination":v.destination or "—",
            "date_depart":str(v.date_depart),
            "date_retour_prevue":str(v.date_retour_prevue),
            "date_retour_effective":str(v.date_retour_effective) if v.date_retour_effective else None,
            "statut":v.statut,
            "statut_label":STATUT_MAP.get(v.statut,v.statut),
        } for v in qs[:200]]

        return Response({
            "total":total,
            "en_voyage":en_voyage,
            "destinations_uniques":destinations,
            "top_voyageurs":list(top),
            "voyages":voyages_data,
        })

    @action(detail=False, methods=["get"], permission_classes=[AllowAny])
    def export_csv(self, request):
        qs = Voyage.objects.select_related("personnel","batiment").order_by("-date_depart")
        personnel_id = request.query_params.get("personnel")
        if personnel_id: qs = qs.filter(personnel_id=personnel_id)
        response = HttpResponse(content_type="text/csv; charset=utf-8")
        response["Content-Disposition"] = "attachment; filename=voyages_rzi.csv"
        response.write("\ufeff")
        writer = csv.writer(response, delimiter=";")
        writer.writerow(["Personnel","Societe","Chambre","Destination","Motif","Depart","Retour prevu","Retour effectif","Statut"])
        for v in qs:
            p = v.personnel
            writer.writerow([
                f"{p.nom} {p.prenom}" if p else "",
                p.societe if p else "",
                v.batiment.residence if v.batiment else "",
                v.destination or "",v.motif or "",
                str(v.date_depart),str(v.date_retour_prevue),
                str(v.date_retour_effective) if v.date_retour_effective else "",
                STATUT_MAP.get(v.statut,v.statut),
            ])
        return response
