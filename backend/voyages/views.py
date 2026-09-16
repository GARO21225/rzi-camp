from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from accounts.permissions import TokenInQueryOrHeader
import datetime, csv, uuid
from django.http import HttpResponse
from django.db import transaction
from .models import Voyage
from .serializers import VoyageSerializer

STATUT_MAP = {
    "planifie":"Planifié",
    "en_voyage":"En voyage",
    "retour":"Retour au camp",
    "annule":"Annulé",
}


def _check_voyage_conflit(personnel_id, date_depart, date_retour, exclude_pk=None):
    """Retourne True si la personne est déjà sur un voyage actif
    qui chevauche la période [date_depart, date_retour]."""
    qs = Voyage.objects.filter(
        personnel_id=personnel_id,
        statut__in=("planifie", "en_voyage"),
        date_depart__lte=date_retour or date_depart,
        date_retour_prevue__gte=date_depart,
    )
    if exclude_pk:
        qs = qs.exclude(pk=exclude_pk)
    return qs.first()

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

    def create(self, request, *args, **kwargs):
        # Règle d'or : un agent ne peut pas être sur 2 voyages actifs qui se
        # chevauchent dans le temps - deja applique pour les rotations
        # groupees (creer_rotation/rejoindre_rotation), mais manquait ici
        # pour la creation directe (voyage individuel).
        personnel_id = request.data.get("personnel")
        date_depart = request.data.get("date_depart")
        date_retour = request.data.get("date_retour_prevue")
        if personnel_id and date_depart and date_retour:
            conflict = _check_voyage_conflit(personnel_id, date_depart, date_retour)
            if conflict:
                return Response({
                    "error": f"Cette personne est déjà sur un autre voyage actif du {conflict.date_depart} au {conflict.date_retour_prevue} (règle : pas de voyages qui se chevauchent)."
                }, status=400)
        return super().create(request, *args, **kwargs)

    def perform_create(self, serializer):
        u = self.request.user
        is_admin = u.is_staff or u.is_superuser or (hasattr(u,"profile") and getattr(u.profile,"role","")=="admin")
        # Un admin qui cree directement un voyage EST la validation (il n'y
        # a personne d'autre a attendre) - seul un agent qui declare son
        # propre voyage passe par le workflow "en attente".
        extra = {"enregistre_par": u}
        if is_admin:
            from django.utils import timezone
            extra.update(statut_validation="valide", valide_par=u, date_validation=timezone.now())
        voyage = serializer.save(**extra)
        try:
            from evenements.models import SimpleNotification
            from django.contrib.auth.models import User
            if is_admin:
                return  # pas besoin de notifier "a valider", deja valide
            for admin in User.objects.filter(is_staff=True)[:5]:
                SimpleNotification.objects.create(
                    user=admin,
                    titre="✈️ Voyage en attente de validation",
                    message=f"{voyage.personnel.nom} {voyage.personnel.prenom} demande un voyage vers {voyage.destination} le {voyage.date_depart}",
                    type_notif="voyage", lu=False
                )
        except Exception:
            pass

    @action(detail=True, methods=['post'])
    def valider(self, request, pk=None):
        """Valide une demande de voyage (workflow agence : demande -> validation)."""
        u = request.user
        is_admin = u.is_staff or u.is_superuser or (hasattr(u,"profile") and getattr(u.profile,"role","")=="admin")
        if not is_admin:
            return Response({"error":"Admin requis"}, status=403)
        voyage = self.get_object()
        voyage.statut_validation = "valide"
        voyage.valide_par = u
        from django.utils import timezone
        voyage.date_validation = timezone.now()
        voyage.save(update_fields=["statut_validation","valide_par","date_validation"])
        try:
            from evenements.models import SimpleNotification
            demandeur = voyage.enregistre_par
            if demandeur:
                SimpleNotification.objects.create(
                    user=demandeur, titre="✅ Voyage validé",
                    message=f"Le voyage de {voyage.personnel.nom} {voyage.personnel.prenom} vers {voyage.destination} a été validé.",
                    type_notif="voyage",
                )
        except Exception:
            pass
        return Response(VoyageSerializer(voyage).data)

    @action(detail=True, methods=['post'])
    def refuser(self, request, pk=None):
        """Refuse une demande de voyage, avec motif."""
        u = request.user
        is_admin = u.is_staff or u.is_superuser or (hasattr(u,"profile") and getattr(u.profile,"role","")=="admin")
        if not is_admin:
            return Response({"error":"Admin requis"}, status=403)
        voyage = self.get_object()
        voyage.statut_validation = "refuse"
        voyage.valide_par = u
        from django.utils import timezone
        voyage.date_validation = timezone.now()
        voyage.motif_refus = request.data.get("motif", "")
        # Un voyage refuse doit liberer sa place dans le convoi et disparaitre
        # du manifeste - sinon il reste compte comme "en transit" alors
        # qu'il ne partira jamais. Detache aussi du rotation_id : une demande
        # refusee n'a jamais reellement rejoint le convoi, elle ne doit plus
        # y apparaitre du tout (le vehicule/matricule/conducteur restent
        # visibles sur SA fiche a titre historique, seul le lien au groupe
        # actif est retire).
        voyage.statut = "annule"
        voyage.rotation_id = None
        voyage.save(update_fields=["statut_validation","valide_par","date_validation","motif_refus","statut","rotation_id"])
        try:
            from evenements.models import SimpleNotification
            demandeur = voyage.enregistre_par
            if demandeur:
                SimpleNotification.objects.create(
                    user=demandeur, titre="❌ Voyage refusé",
                    message=f"Le voyage de {voyage.personnel.nom} {voyage.personnel.prenom} vers {voyage.destination} a été refusé."
                        + (f" Motif : {voyage.motif_refus}" if voyage.motif_refus else ""),
                    type_notif="voyage",
                )
        except Exception:
            pass
        return Response(VoyageSerializer(voyage).data)

    @action(detail=True, methods=['get'], permission_classes=[TokenInQueryOrHeader])
    def billet(self, request, pk=None):
        """Document imprimable de l'itinéraire complet — comme un billet
        d'agence de voyage. Ouvrable directement dans un nouvel onglet."""
        from django.http import HttpResponse
        voyage = self.get_object()
        html = _generer_billet_html(voyage)
        return HttpResponse(html, content_type="text/html; charset=utf-8")

    @action(detail=True, methods=['post'])
    def changer_vehicule(self, request, pk=None):
        """Change le véhicule/conducteur d'un voyage SANS changer de convoi
        (ex: le véhicule initialement prévu tombe en panne, ou le véhicule
        du retour doit différer de celui de l'aller)."""
        u = request.user
        is_admin = u.is_staff or u.is_superuser or (hasattr(u,"profile") and getattr(u.profile,"role","")=="admin")
        if not is_admin:
            return Response({"error":"Admin requis"}, status=403)
        voyage = self.get_object()
        if voyage.statut == "retour":
            return Response({"error":"Ce voyage est terminé (retour effectué) — plus rien à modifier."}, status=400)
        vehicule = request.data.get("vehicule", "")
        if not vehicule:
            return Response({"error":"Véhicule requis"}, status=400)
        nouveau_conducteur = request.data.get("conducteur", "")
        if nouveau_conducteur:
            # Meme exception que pour creer_rotation : voyage solo (aucun
            # autre passager dans le meme convoi) -> la personne peut
            # legitimement etre son propre conducteur.
            autres_passagers = Voyage.objects.filter(rotation_id=voyage.rotation_id).exclude(statut="annule").exclude(pk=voyage.pk).exists() if voyage.rotation_id else False
            if autres_passagers and voyage.personnel and f"{voyage.personnel.nom} {voyage.personnel.prenom}".strip().lower() == nouveau_conducteur.strip().lower():
                return Response({"error": f"{nouveau_conducteur} est le voyageur lui-même : il ne peut pas être son propre conducteur quand d'autres passagers l'accompagnent."}, status=400)
            chevauche = Voyage.objects.filter(
                conducteur__iexact=nouveau_conducteur,
                statut__in=("planifie","en_voyage"),
                date_depart__lte=voyage.date_retour_prevue, date_retour_prevue__gte=voyage.date_depart,
            ).exclude(pk=voyage.pk).first()
            if chevauche:
                return Response({"error": f"{nouveau_conducteur} est déjà conducteur sur un autre convoi actif du {chevauche.date_depart} au {chevauche.date_retour_prevue}."}, status=400)
        voyage.vehicule = vehicule
        voyage.vehicule_matricule = request.data.get("vehicule_matricule", "")
        voyage.vehicule_photo = request.data.get("vehicule_photo", "")
        voyage.conducteur = nouveau_conducteur
        voyage.save(update_fields=["vehicule","vehicule_matricule","vehicule_photo","conducteur"])
        return Response(VoyageSerializer(voyage).data)

    @action(detail=True, methods=['post'])
    def changer_convoi(self, request, pk=None):
        """
        Deplace un voyage EXISTANT vers un AUTRE convoi (rotation_id
        different) - herite des champs partages du convoi cible (vehicule,
        dates, destination...). Verifie les places disponibles et les
        conflits de dates, comme rejoindre_rotation.
        """
        u = request.user
        is_admin = u.is_staff or u.is_superuser or (hasattr(u,"profile") and getattr(u.profile,"role","")=="admin")
        if not is_admin:
            return Response({"error":"Admin requis"}, status=403)
        voyage = self.get_object()
        if voyage.statut == "retour":
            return Response({"error":"Ce voyage est terminé (retour effectué) — plus rien à modifier."}, status=400)
        nouveau_rotation_id = request.data.get("rotation_id")
        if not nouveau_rotation_id:
            return Response({"error":"rotation_id requis"}, status=400)
        cible = Voyage.objects.filter(rotation_id=nouveau_rotation_id).exclude(statut="annule").first()
        if not cible:
            return Response({"error":"Convoi cible introuvable ou vide"}, status=404)
        if cible.statut == "retour":
            return Response({"error": "Ce convoi est déjà terminé (retour effectué) — impossible d'y ajouter quelqu'un. Créez un nouveau convoi à la place."}, status=400)
        prises = Voyage.objects.filter(rotation_id=nouveau_rotation_id).exclude(statut="annule").count()
        if prises >= (cible.nb_places_total or 15):
            return Response({"error":"Convoi cible complet"}, status=400)
        conflict = _check_voyage_conflit(
            voyage.personnel_id, cible.date_depart, cible.date_retour_prevue, exclude_pk=voyage.pk
        )
        if conflict:
            return Response({"error": f"Conflit avec un autre voyage actif du {conflict.date_depart} au {conflict.date_retour_prevue}"}, status=400)
        ancien_rotation_id = voyage.rotation_id
        voyage.rotation_id = nouveau_rotation_id
        voyage.destination = cible.destination
        voyage.origine = cible.origine
        voyage.date_depart = cible.date_depart
        voyage.date_retour_prevue = cible.date_retour_prevue
        voyage.vehicule = cible.vehicule
        voyage.vehicule_matricule = cible.vehicule_matricule
        voyage.vehicule_photo = cible.vehicule_photo
        voyage.conducteur = cible.conducteur
        voyage.nb_places_total = cible.nb_places_total
        voyage.heure_depart = cible.heure_depart
        voyage.point_rdv = cible.point_rdv
        voyage.statut = "planifie"
        voyage.save()
        try:
            from evenements.models import SimpleNotification
            if voyage.enregistre_par:
                SimpleNotification.objects.create(
                    user=voyage.enregistre_par,
                    titre="🔀 Convoi changé",
                    message=f"{voyage.personnel.nom} {voyage.personnel.prenom} a été déplacé du convoi {ancien_rotation_id or '—'} vers {nouveau_rotation_id}.",
                    type_notif="voyage",
                )
        except Exception:
            pass
        return Response(VoyageSerializer(voyage).data)

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
        u = request.user
        is_admin = u.is_staff or u.is_superuser or (hasattr(u,"profile") and getattr(u.profile,"role","")=="admin")
        if not is_admin:
            return Response({"error":"Admin requis"}, status=403)
        voyage = self.get_object()
        if voyage.statut != "planifie":
            return Response({"error":"Voyage non planifié"}, status=400)
        voyage.partir()
        return Response(VoyageSerializer(voyage).data)

    @action(detail=True, methods=["post"])
    def revenir(self, request, pk=None):
        u = request.user
        is_admin = u.is_staff or u.is_superuser or (hasattr(u,"profile") and getattr(u.profile,"role","")=="admin")
        if not is_admin:
            return Response({"error":"Admin requis"}, status=403)
        voyage = self.get_object()
        if voyage.statut != "en_voyage":
            return Response({"error":"Personnel pas en voyage"}, status=400)
        date_str = request.data.get("date_retour")
        date = datetime.date.fromisoformat(date_str) if date_str else None
        voyage.revenir(date)
        # Vehicule/conducteur du retour, si different de l'aller (ex: agent
        # regroupe dans un autre vehicule suite a un retour anticipe)
        champs_retour = {}
        if request.data.get("vehicule_retour"): champs_retour["vehicule_retour"] = request.data["vehicule_retour"]
        if request.data.get("vehicule_matricule_retour"): champs_retour["vehicule_matricule_retour"] = request.data["vehicule_matricule_retour"]
        if request.data.get("conducteur_retour"): champs_retour["conducteur_retour"] = request.data["conducteur_retour"]
        if champs_retour:
            for k,v in champs_retour.items(): setattr(voyage, k, v)
            voyage.save(update_fields=list(champs_retour.keys()))
        return Response(VoyageSerializer(voyage).data)

    @action(detail=True, methods=["post"])
    def annuler(self, request, pk=None):
        u = request.user
        is_admin = u.is_staff or u.is_superuser or (hasattr(u,"profile") and getattr(u.profile,"role","")=="admin")
        if not is_admin:
            return Response({"error":"Admin requis"}, status=403)
        voyage = self.get_object()
        if voyage.statut == "en_voyage":
            return Response({"error":"Impossible d annuler un voyage déjà commencé"}, status=400)
        if voyage.statut == "retour":
            return Response({"error":"Voyage déjà terminé"}, status=400)
        voyage.statut = "annule"
        voyage.rotation_id = None
        voyage.save()
        return Response({"ok": True})

    @action(detail=True, methods=["delete"])
    def supprimer_planifie(self, request, pk=None):
        u = request.user
        is_admin = u.is_staff or u.is_superuser or (hasattr(u,"profile") and getattr(u.profile,"role","")=="admin")
        if not is_admin:
            return Response({"error":"Admin requis"}, status=403)
        voyage = self.get_object()
        voyage.delete()
        return Response({"ok": True})

    @action(detail=False, methods=["post"])
    def supprimer_masse(self, request):
        """Supprime plusieurs voyages d'un coup — pour les actions en masse
        depuis 'Tous les voyages'. Autorise quel que soit le statut."""
        u = request.user
        is_admin = u.is_staff or u.is_superuser or (hasattr(u,"profile") and getattr(u.profile,"role","")=="admin")
        if not is_admin:
            return Response({"error":"Admin requis"}, status=403)
        ids = request.data.get("ids", [])
        if not ids:
            return Response({"error":"ids requis"}, status=400)
        qs = Voyage.objects.filter(pk__in=ids)
        nb = qs.count()
        qs.delete()
        return Response({"ok": True, "supprimes": nb})

    @action(detail=False, methods=["post"])
    def supprimer_rotation(self, request):
        """Supprime un convoi ENTIER (tous ses passagers d'un coup) -
        autorise meme si le convoi a deja ete effectue (en transit/revenu),
        pour permettre le nettoyage/correction de donnees par un admin."""
        u = request.user
        is_admin = u.is_staff or u.is_superuser or (hasattr(u,"profile") and getattr(u.profile,"role","")=="admin")
        if not is_admin:
            return Response({"error":"Admin requis"}, status=403)
        rotation_id = request.data.get("rotation_id")
        if not rotation_id:
            return Response({"error":"rotation_id requis"}, status=400)
        membres = Voyage.objects.filter(rotation_id=rotation_id).exclude(statut="annule")
        if not membres.exists():
            return Response({"error":"Convoi introuvable ou déjà vide"}, status=404)
        nb = membres.count()
        membres.delete()
        return Response({"ok": True, "supprimes": nb})

    # ── Stats ──────────────────────────────────────────────────────
    @action(detail=False, methods=["get"])
    def stats(self, request):
        from django.utils import timezone
        from datetime import timedelta
        qs = Voyage.objects.all()
        today = timezone.now().date()
        # Rappels de fin de rotation : personnes en voyage dont le retour
        # prévu approche (3 jours) ou est déjà dépassé sans avoir été
        # enregistré comme "retour" — anticipe les oublis de relève.
        en_cours = qs.filter(statut="en_voyage")
        retours_proches   = en_cours.filter(date_retour_prevue__gte=today, date_retour_prevue__lte=today+timedelta(days=3)).count()
        retours_en_retard = en_cours.filter(date_retour_prevue__lt=today).count()
        return Response({
            "total":    qs.count(),
            "planifies":qs.filter(statut="planifie").count(),
            "en_voyage":qs.filter(statut="en_voyage").count(),
            "retours":  qs.filter(statut="retour").count(),
            "annules":  qs.filter(statut="annule").count(),
            "retours_proches":   retours_proches,
            "retours_en_retard": retours_en_retard,
        })

    @action(detail=False, methods=['get'])
    def retours_anticipes(self, request):
        """
        Personnes rentrées AVANT la date prévue — met en évidence des places
        potentiellement libérées plus tot que prevu (ex: quelqu'un revenu par
        un autre moyen), pour qu'un responsable voyage ou un agent qui
        consulte les rotations disponibles en ait connaissance.
        """
        from django.utils import timezone
        from datetime import timedelta
        from django.db.models import F
        depuis = timezone.now().date() - timedelta(days=14)
        qs = (Voyage.objects
            .filter(statut="retour", date_retour_effective__isnull=False,
                    date_retour_effective__gte=depuis,
                    date_retour_effective__lt=F("date_retour_prevue"))
            .select_related("personnel")
            .order_by("-date_retour_effective"))
        data = [{
            "id": v.id,
            "personnel_nom": f"{v.personnel.nom} {v.personnel.prenom}" if v.personnel else "—",
            "destination": v.destination,
            "date_retour_prevue": v.date_retour_prevue,
            "date_retour_effective": v.date_retour_effective,
            "jours_avance": (v.date_retour_prevue - v.date_retour_effective).days,
            "rotation_id": v.rotation_id,
        } for v in qs]
        return Response(data)

    @action(detail=False, methods=["get"])
    def rappels_rotation(self, request):
        """Liste détaillée des retours de rotation proches ou en retard —
        pour affichage direct (nom, société, date de retour prévue)."""
        from django.utils import timezone
        from datetime import timedelta
        today = timezone.now().date()
        en_cours = (Voyage.objects.filter(statut="en_voyage")
            .select_related("personnel")
            .filter(date_retour_prevue__lte=today+timedelta(days=3))
            .order_by("date_retour_prevue"))
        return Response([{
            "id": v.id,
            "personnel_nom": f"{v.personnel.nom} {v.personnel.prenom}",
            "societe": v.personnel.societe,
            "destination": v.destination,
            "date_retour_prevue": v.date_retour_prevue,
            "en_retard": v.date_retour_prevue < today,
            "jours_restants": (v.date_retour_prevue - today).days,
        } for v in en_cours])

    # ── Rotations groupe ───────────────────────────────────────────
    @action(detail=False, methods=["get"])
    def rotations(self, request):
        from django.db.models import Count
        # IMPORTANT : ne PAS inclure "statut" dans le regroupement — sinon
        # des que UN SEUL passager change de statut (ex: rentre alors que
        # les autres sont encore en transit), Django scinde la meme rotation
        # en plusieurs groupes distincts au lieu d'une seule rotation avec
        # des statuts individuels mixtes. Le statut agrege de la rotation se
        # calcule a part, a partir des statuts individuels des passagers.
        groupes = (Voyage.objects
            .exclude(rotation_id__isnull=True).exclude(rotation_id="")
            .values("rotation_id","destination","date_depart","date_retour_prevue",
                    "vehicule","vehicule_matricule","vehicule_photo","conducteur","nb_places_total","heure_depart","point_rdv",
                    "type_voyage","motif")
            .annotate(nb_passagers=Count("id"))
            .order_by("-date_depart"))
        result = []
        for g in groupes:
            passagers = list(Voyage.objects.filter(rotation_id=g["rotation_id"])
                .exclude(statut="annule")
                .select_related("personnel")
                .values("id","personnel__nom","personnel__prenom",
                        "personnel__societe","statut","statut_validation"))
            if not passagers:
                continue  # tout le monde annule/refuse -> rotation vide, ne pas afficher
            statuts_presents = {p["statut"] for p in passagers}
            if statuts_presents == {"retour"}:
                statut_rotation = "retour"
            elif "en_voyage" in statuts_presents:
                statut_rotation = "en_voyage"
            elif "planifie" in statuts_presents:
                statut_rotation = "planifie"
            else:
                statut_rotation = next(iter(statuts_presents), "planifie")
            g["statut"] = statut_rotation
            g["passagers"] = passagers
            g["nb_passagers"] = len(passagers)
            # Occupees/reservees EXCLUENT le statut "retour" - une personne
            # deja rentree a termine son aller-retour, elle ne doit plus
            # bloquer une place pour de nouvelles demandes (sinon le convoi
            # reste "COMPLET" indefiniment meme quand tout le monde est revenu).
            actifs = [p for p in passagers if p["statut"] != "retour"]
            occupees = sum(1 for p in actifs if p["statut_validation"]=="valide")
            reservees = sum(1 for p in actifs if p["statut_validation"]=="en_attente")
            g["places_occupees"] = occupees
            g["places_reservees"] = reservees
            g["places_libres"] = max(0,(g["nb_places_total"] or 15)-len(actifs))
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
        origine         = data.get("origine","Camp Roxgold Sango")
        date_depart     = data.get("date_depart")
        date_retour     = data.get("date_retour_prevue")
        vehicule        = data.get("vehicule","")
        vehicule_matricule = data.get("vehicule_matricule","")
        vehicule_photo  = data.get("vehicule_photo","")
        conducteur      = data.get("conducteur","")
        nb_places       = int(data.get("nb_places_total",15))
        heure_depart    = data.get("heure_depart") or None
        point_rdv       = data.get("point_rdv","")
        motif           = data.get("motif","")
        type_voyage     = data.get("type_voyage","rotation")
        passagers_ids   = data.get("passagers",[])
        u = request.user
        is_admin = u.is_staff or u.is_superuser or (hasattr(u,"profile") and getattr(u.profile,"role","")=="admin")
        if type_voyage != "individuel" and not is_admin:
            # Le voyage individuel reste en libre-service (un agent declare
            # son propre deplacement), mais organiser une rotation GROUPEE
            # (plusieurs passagers, choix du vehicule/conducteur pour
            # d'autres personnes) est une action de dispatch admin - meme
            # regle que partout ailleurs dans Centre de Mobilite.
            return Response({"error":"Seul un admin peut créer une rotation groupée. Utilisez le voyage individuel pour votre propre déplacement."}, status=403)
        if not date_depart or not date_retour:
            return Response({"error":"date_depart et date_retour_prevue requis"},status=400)

        # Regle : le conducteur ne peut pas etre aussi passager de la meme
        # rotation - SAUF si c'est un voyage SOLO (une seule personne) : la
        # personne peut legitimement conduire elle-meme son propre vehicule.
        if conducteur and len(passagers_ids) > 1:
            from residences.models import Personnel
            for pid in passagers_ids:
                try:
                    p = Personnel.objects.get(pk=pid)
                    if f"{p.nom} {p.prenom}".strip().lower() == conducteur.strip().lower():
                        return Response({"error": f"{conducteur} est désigné comme conducteur : il ne peut pas être aussi passager de la même rotation."}, status=400)
                except Personnel.DoesNotExist:
                    pass
        if conducteur:
            # Regle : le conducteur ne peut pas deja etre conducteur sur un AUTRE convoi actif qui chevauche les dates
            chevauche = Voyage.objects.filter(
                conducteur__iexact=conducteur,
                statut__in=("planifie","en_voyage"),
                date_depart__lte=date_retour, date_retour_prevue__gte=date_depart,
            ).first()
            if chevauche:
                return Response({"error": f"{conducteur} est déjà conducteur sur un autre convoi actif du {chevauche.date_depart} au {chevauche.date_retour_prevue}."}, status=400)

        created = []
        exclus = []
        passagers_valides = []
        for pid in passagers_ids:
            conflict = _check_voyage_conflit(pid, date_depart, date_retour)
            if conflict:
                try:
                    from residences.models import Personnel
                    p = Personnel.objects.get(pk=pid)
                    nom = f"{p.nom} {p.prenom}"
                except Exception:
                    nom = f"Personne #{pid}"
                exclus.append(f"{nom} (déjà en voyage du {conflict.date_depart} au {conflict.date_retour_prevue})")
            else:
                passagers_valides.append(pid)
        passagers_ids = passagers_valides
        if not passagers_ids and exclus:
            return Response({"error": f"Aucun passager valide — tous en conflit : " + " | ".join(exclus)}, status=400)

        u = request.user
        is_admin = u.is_staff or u.is_superuser or (hasattr(u,"profile") and getattr(u.profile,"role","")=="admin")
        # Un voyage individuel doit TOUJOURS passer par une vraie validation
        # manuelle, meme cree par un admin - contrairement a une rotation
        # groupee ou l'admin qui l'organise EST de fait la validation.
        extra_validation = {}
        if is_admin and type_voyage != "individuel":
            from django.utils import timezone as tz2
            extra_validation = {"statut_validation":"valide", "valide_par":u, "date_validation":tz2.now()}

        for pid in passagers_ids:
            try:
                v = Voyage.objects.create(
                    personnel_id=pid, destination=destination, origine=origine,
                    date_depart=date_depart, date_retour_prevue=date_retour,
                    vehicule=vehicule, nb_places_total=nb_places,
                    vehicule_matricule=vehicule_matricule, vehicule_photo=vehicule_photo,
                    conducteur=conducteur,
                    heure_depart=heure_depart, point_rdv=point_rdv,
                    motif=motif, type_voyage=type_voyage,
                    rotation_id=rotation_id, statut="planifie",
                    enregistre_par=request.user,
                    **extra_validation,
                )
                created.append(v.id)
            except Exception:
                pass
        return Response({"rotation_id":rotation_id,"voyages_crees":len(created),"ids":created,"exclus":exclus},status=201)

    @action(detail=False, methods=["post"])
    def rejoindre_rotation(self, request):
        u = request.user
        is_admin = u.is_staff or u.is_superuser or (hasattr(u,"profile") and getattr(u.profile,"role","")=="admin")
        if not is_admin:
            return Response({"error":"Admin requis pour ajouter un passager à un convoi"}, status=403)
        rotation_id  = request.data.get("rotation_id")
        personnel_id = request.data.get("personnel_id")
        if not rotation_id or not personnel_id:
            return Response({"error":"rotation_id et personnel_id requis"},status=400)
        # Verrouillage transactionnel: sans ca, deux admins ajoutant un
        # passager AU MEME MOMENT sur le dernier siege libre pouvaient tous
        # les deux passer le controle "prises >= nb_places" (tous deux lus
        # AVANT que l'un ou l'autre n'ait cree son Voyage) et surbooker
        # reellement le vehicule - un risque physique, pas juste une
        # incoherence de donnees. select_for_update() serialise les
        # requetes concurrentes sur la MEME rotation : la seconde attend
        # que la premiere transaction commite avant de relire le compte.
        with transaction.atomic():
            existing = Voyage.objects.select_for_update().filter(rotation_id=rotation_id).exclude(statut="annule").first()
            if not existing:
                return Response({"error":"Rotation introuvable"},status=404)
            if existing.statut != "planifie":
                libelle = {"en_voyage":"déjà en transit","retour":"déjà terminé (retour effectué)"}.get(existing.statut, existing.statut)
                return Response({"error": f"Ce convoi est {libelle} — impossible d'y ajouter quelqu'un. Utilisez un convoi pas encore parti, ou créez un voyage individuel."}, status=400)
            prises = Voyage.objects.filter(rotation_id=rotation_id).exclude(statut="annule").count()
            if prises >= (existing.nb_places_total or 15):
                return Response({"error":"Rotation complète"},status=400)
            if Voyage.objects.filter(rotation_id=rotation_id,personnel_id=personnel_id).exists():
                return Response({"error":"Déjà inscrit sur cette rotation"},status=400)
            # Vérifier aussi si la personne est sur un autre voyage actif sur la même période
            conflict = _check_voyage_conflit(
                personnel_id, existing.date_depart, existing.date_retour_prevue
            )
            if conflict and conflict.rotation_id != rotation_id:
                return Response({"error": f"Cette personne est déjà sur un autre voyage actif du {conflict.date_depart} au {conflict.date_retour_prevue}"}, status=400)
            v = Voyage.objects.create(
                personnel_id=personnel_id, destination=existing.destination, origine=existing.origine,
                date_depart=existing.date_depart, date_retour_prevue=existing.date_retour_prevue,
                vehicule=existing.vehicule, nb_places_total=existing.nb_places_total,
                vehicule_matricule=existing.vehicule_matricule, vehicule_photo=existing.vehicule_photo,
                conducteur=existing.conducteur,
                heure_depart=existing.heure_depart, point_rdv=existing.point_rdv,
                motif=existing.motif, type_voyage=existing.type_voyage,
                rotation_id=rotation_id, statut="planifie",
                enregistre_par=request.user,
            )
            return Response(VoyageSerializer(v).data,status=201)

    @action(detail=False, methods=["post"])
    def partir_rotation(self, request):
        u = request.user
        is_admin = u.is_staff or u.is_superuser or (hasattr(u,"profile") and getattr(u.profile,"role","")=="admin")
        if not is_admin:
            return Response({"error":"Admin requis"}, status=403)
        rotation_id = request.data.get("rotation_id")
        if not rotation_id:
            return Response({"error":"rotation_id requis"},status=400)
        count = 0
        echecs = []
        for v in Voyage.objects.select_related("personnel").filter(rotation_id=rotation_id,statut="planifie"):
            try:
                v.partir(); count+=1
            except Exception as e:
                nom = f"{v.personnel.nom} {v.personnel.prenom}" if v.personnel else f"#{v.id}"
                echecs.append(f"{nom}: {e}")
        return Response({"ok":True,"partis":count,"echecs":echecs})

    @action(detail=False, methods=["post"])
    def retour_rotation(self, request):
        u = request.user
        is_admin = u.is_staff or u.is_superuser or (hasattr(u,"profile") and getattr(u.profile,"role","")=="admin")
        if not is_admin:
            return Response({"error":"Admin requis"}, status=403)
        rotation_id = request.data.get("rotation_id")
        if not rotation_id:
            return Response({"error":"rotation_id requis"},status=400)
        date_str = request.data.get("date_retour")
        date = datetime.date.fromisoformat(date_str) if date_str else None
        count = 0
        echecs = []
        for v in Voyage.objects.select_related("personnel").filter(rotation_id=rotation_id,statut="en_voyage"):
            try:
                v.revenir(date); count+=1
            except Exception as e:
                nom = f"{v.personnel.nom} {v.personnel.prenom}" if v.personnel else f"#{v.id}"
                echecs.append(f"{nom}: {e}")
        return Response({"ok":True,"rentres":count,"echecs":echecs})

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
    @action(detail=False, methods=["get"], permission_classes=[TokenInQueryOrHeader])
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


from .models import EtapeVoyage
from .serializers import EtapeVoyageSerializer

class EtapeVoyageViewSet(viewsets.ModelViewSet):
    """Étapes d'itinéraire (tronçons) d'un voyage — comme une vraie agence :
    plusieurs étapes possibles (ex: Camp -> Aéroport en bus, puis vol)."""
    queryset = EtapeVoyage.objects.select_related("voyage", "vehicule_flotte").all()
    serializer_class = EtapeVoyageSerializer
    filter_backends = [filters.SearchFilter]

    def get_queryset(self):
        qs = EtapeVoyage.objects.select_related("voyage", "vehicule_flotte").all()
        voyage_id = self.request.query_params.get("voyage")
        if voyage_id:
            qs = qs.filter(voyage_id=voyage_id)
        return qs

    def _is_admin(self, u):
        return u.is_staff or u.is_superuser or (hasattr(u,"profile") and getattr(u.profile,"role","")=="admin")

    def create(self, request, *args, **kwargs):
        if not self._is_admin(request.user):
            return Response({"error":"Admin requis pour gérer l'itinéraire d'un voyage"}, status=403)
        # Un voyage termine (retour) est fige - plus aucune modification
        # d'itineraire n'a de sens une fois le trajet reellement termine.
        voyage_id = request.data.get("voyage")
        if voyage_id:
            voyage = Voyage.objects.filter(pk=voyage_id).first()
            if voyage and voyage.statut == "retour":
                return Response({"error": "Ce voyage est terminé (retour effectué) — l'itinéraire ne peut plus être modifié."}, status=400)
        return super().create(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        if not self._is_admin(request.user):
            return Response({"error":"Admin requis pour gérer l'itinéraire d'un voyage"}, status=403)
        return super().update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        if not self._is_admin(request.user):
            return Response({"error":"Admin requis pour gérer l'itinéraire d'un voyage"}, status=403)
        return super().partial_update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        if not self._is_admin(request.user):
            return Response({"error":"Admin requis pour gérer l'itinéraire d'un voyage"}, status=403)
        return super().destroy(request, *args, **kwargs)


def _generer_billet_html(voyage):
    """Document imprimable façon billet d'agence de voyage — toutes les
    étapes de l'itinéraire, point de RDV, référence, à imprimer ou garder
    en PDF via le navigateur (Ctrl+P -> Enregistrer en PDF)."""
    p = voyage.personnel
    etapes = voyage.etapes.select_related("vehicule_flotte").all().order_by("ordre")
    etapes_html = "".join([f"""
        <tr>
          <td style="padding:10px;border-bottom:1px solid #e2e8f0;font-weight:700;color:#0F2A5C">{e.ordre}</td>
          <td style="padding:10px;border-bottom:1px solid #e2e8f0;font-weight:700;color:{'#16a34a' if e.sens=='retour' else '#0F2A5C'}">{'⬅️ Retour' if e.sens=='retour' else '➡️ Aller'}</td>
          <td style="padding:10px;border-bottom:1px solid #e2e8f0">{e.get_mode_transport_display()}</td>
          <td style="padding:10px;border-bottom:1px solid #e2e8f0">{e.origine} → {e.destination}</td>
          <td style="padding:10px;border-bottom:1px solid #e2e8f0">{e.date_etape.strftime('%d/%m/%Y')}{' à ' + e.heure_depart.strftime('%H:%M') if e.heure_depart else ''}</td>
          <td style="padding:10px;border-bottom:1px solid #e2e8f0">{(e.vehicule_flotte.nom + (' (' + e.vehicule_flotte.matricule + ')' if e.vehicule_flotte.matricule else '')) if e.vehicule_flotte else '—'}{(' — ' + e.conducteur) if e.conducteur else ''}</td>
          <td style="padding:10px;border-bottom:1px solid #e2e8f0;font-family:monospace">{e.reference or '—'}</td>
          <td style="padding:10px;border-bottom:1px solid #e2e8f0">{f'{e.billet_cout:,.0f} FCFA' if e.billet_cout else '—'}</td>
        </tr>
    """ for e in etapes]) or '<tr><td colspan="8" style="padding:16px;text-align:center;color:#94a3b8">Aucune étape détaillée — voyage simple</td></tr>'

    return f"""
    <!DOCTYPE html><html lang="fr"><head><meta charset="utf-8">
    <title>Billet de voyage — {p.nom if p else ''} {p.prenom if p else ''}</title>
    <style>
      body {{ font-family: 'IBM Plex Sans', system-ui, sans-serif; margin:0; padding:32px; color:#1e293b; }}
      .header {{ display:flex; justify-content:space-between; align-items:center; border-bottom:4px solid #C9972B; padding-bottom:16px; margin-bottom:24px; }}
      .badge {{ display:inline-block; padding:4px 14px; border-radius:20px; font-size:12px; font-weight:700; }}
      table {{ width:100%; border-collapse:collapse; margin-top:16px; }}
      th {{ text-align:left; padding:10px; background:#0F2A5C; color:#fff; font-size:11px; text-transform:uppercase; }}
      .btn-print {{ background:#C9972B; color:#000; border:none; padding:10px 20px; border-radius:8px; font-weight:700; cursor:pointer; }}
      @media print {{ .no-print {{ display:none; }} }}
    </style></head>
    <body>
      <button class="no-print btn-print" onclick="window.print()" style="margin-bottom:20px">🖨️ Imprimer / Enregistrer en PDF</button>
      <div class="header">
        <div>
          <h1 style="margin:0;color:#0F2A5C">✈️ Billet de voyage</h1>
          <p style="margin:4px 0 0;color:#64748b">RZI Camp — Roxgold Sango</p>
        </div>
        <span class="badge" style="background:#0F2A5C22;color:#0F2A5C">Rotation {voyage.rotation_id or '—'}</span>
      </div>
      <table style="margin-bottom:24px">
        <tr><td style="padding:6px 0;color:#64748b;width:160px">Voyageur</td><td style="font-weight:700">{p.nom if p else ''} {p.prenom if p else ''}</td></tr>
        <tr><td style="padding:6px 0;color:#64748b">Société</td><td>{p.societe if p else '—'}</td></tr>
        <tr><td style="padding:6px 0;color:#64748b">Point de départ</td><td>{voyage.origine or 'Camp Roxgold Sango'}</td></tr>
        <tr><td style="padding:6px 0;color:#64748b">Destination</td><td style="font-weight:700">{voyage.destination or '—'}</td></tr>
        <tr><td style="padding:6px 0;color:#64748b">Motif</td><td>{voyage.motif or '—'}</td></tr>
        <tr><td style="padding:6px 0;color:#64748b">Véhicule / Convoi</td><td>{voyage.vehicule or '—'}{f' — {voyage.vehicule_matricule}' if voyage.vehicule_matricule else ''}</td></tr>
        {f'<tr><td style="padding:6px 0;color:#64748b">Conducteur</td><td>{voyage.conducteur}</td></tr>' if voyage.conducteur else ''}
        <tr><td style="padding:6px 0;color:#64748b">Statut</td><td>{voyage.get_statut_display()} — {voyage.get_statut_validation_display()}</td></tr>
        {f'<tr><td style="padding:6px 0;color:#64748b">Validé par</td><td>{voyage.valide_par.get_full_name() or voyage.valide_par.username} le {voyage.date_validation.strftime("%d/%m/%Y à %H:%M")}</td></tr>' if voyage.valide_par and voyage.date_validation else ''}
      </table>
      <h2 style="color:#0F2A5C;font-size:16px">🗺️ Itinéraire</h2>
      <table>
        <thead><tr><th>Étape</th><th>Sens</th><th>Mode</th><th>Trajet</th><th>Date / Heure</th><th>Véhicule / Conducteur</th><th>Référence</th><th>Coût</th></tr></thead>
        <tbody>{etapes_html}</tbody>
      </table>
      <p style="margin-top:32px;color:#94a3b8;font-size:11px">Document généré le {voyage.created_at.strftime('%d/%m/%Y')} — RZI Camp ERP · Usage interne uniquement</p>
    </body></html>
    """


from .models import VehiculeFlotte
from .serializers import VehiculeFlotteSerializer

class VehiculeFlotteViewSet(viewsets.ModelViewSet):
    """Catalogue des véhicules du camp — lecture ouverte à tout connecté
    (pour choisir un véhicule à la création de rotation), écriture admin."""
    queryset = VehiculeFlotte.objects.filter(actif=True)
    serializer_class = VehiculeFlotteSerializer

    def get_permissions(self):
        if self.request.method == 'GET':
            return [IsAuthenticated()]
        u = self.request.user
        if not (u.is_authenticated and (u.is_staff or u.is_superuser or (hasattr(u,"profile") and getattr(u.profile,"role","")=="admin"))):
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Admin requis")
        return [IsAuthenticated()]

