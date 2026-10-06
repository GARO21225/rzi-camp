from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from accounts.permissions import TokenInQueryOrHeader
import datetime, csv, uuid
from django.http import HttpResponse
from django.db import transaction
from django.db.models import Q
from .models import Voyage, Rotation
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
    fin = date_retour or date_depart
    # Trajets en aller simple : un trajet qui se termine le jour J et le
    # suivant qui commence le jour J se TOUCHENT sans se chevaucher
    # (ex : Camp -> Abidjan « je reviens le 20 », puis Abidjan -> Camp le 20).
    qs = Voyage.objects.filter(
        personnel_id=personnel_id,
        statut__in=("planifie", "en_voyage"),
    ).filter(
        Q(date_depart__lt=fin, date_retour_prevue__gt=date_depart) | Q(date_depart=date_depart)
    )
    if exclude_pk:
        qs = qs.exclude(pk=exclude_pk)
    return qs.first()


def _conducteur_en_conflit(conducteur_id, nom, date_depart, date_retour, exclude_rotation_id=None):
    """Cherche si cette personne (par ID si fourni, sinon par nom en texte
    libre) est deja conducteur (principal OU second) d'un AUTRE convoi actif
    dont la periode chevauche celle demandee.

    BUG REEL CORRIGE ICI : l'ancien controle ne regardait QUE le modele
    Voyage (les lignes passager). Depuis que "creer_rotation" cree
    TOUJOURS le convoi sans aucun passager (cf. Rotation.itineraire_modele
    et la regle "un convoi et un passager sont deux choses differentes"),
    un convoi tout juste cree n'a plus AUCUNE ligne Voyage tant que
    personne ne l'a rejoint - le chauffeur qui lui est assigne devenait
    donc invisible a ce controle, permettant de designer le MEME chauffeur
    sur 2 convois actifs a la meme date (signale : "dukastel est chauffeur
    le meme jour sur 2 convois"). Cherche desormais D'ABORD dans Rotation
    (source de verite, existe meme sans passager - meme raisonnement deja
    applique au controle du vehicule juste apres celui-ci), avec repli sur
    Voyage pour les voyages individuels (sans Rotation associee) et les
    anciennes donnees anterieures a ce modele."""
    if not (conducteur_id or nom):
        return None
    filtre_rot = Q()
    if conducteur_id:
        filtre_rot |= Q(conducteur_personnel_id=conducteur_id) | Q(conducteur_secondaire_personnel_id=conducteur_id)
    if nom:
        filtre_rot |= Q(conducteur__iexact=nom) | Q(conducteur_secondaire__iexact=nom)
    candidats = Rotation.objects.filter(
        filtre_rot, date_depart__lte=date_retour or date_depart, date_retour_prevue__gte=date_depart,
    )
    if exclude_rotation_id:
        candidats = candidats.exclude(rotation_id=exclude_rotation_id)
    for candidat in candidats:
        # Meme derivation de statut "reel" que le controle vehicule : un
        # convoi dont tous les passagers sont rentres/annules ne bloque
        # plus rien, meme si Rotation.statut (jamais mis a jour) dit
        # encore "planifie".
        membres = Voyage.objects.filter(rotation_id=candidat.rotation_id)
        if membres.exists() and not membres.exclude(statut__in=("retour", "annule")).exists():
            continue
        return candidat

    filtre_v = Q()
    if conducteur_id:
        filtre_v |= Q(conducteur_personnel_id=conducteur_id) | Q(conducteur_secondaire_personnel_id=conducteur_id)
    if nom:
        filtre_v |= Q(conducteur__iexact=nom) | Q(conducteur_secondaire__iexact=nom)
    qs = Voyage.objects.filter(
        filtre_v, statut__in=("planifie", "en_voyage"),
        date_depart__lte=date_retour or date_depart, date_retour_prevue__gte=date_depart,
    )
    if exclude_rotation_id:
        qs = qs.exclude(rotation_id=exclude_rotation_id)
    return qs.first()


def _appliquer_itineraire_a_voyage(voyage, itineraire):
    """Copie les étapes d'un ItineraireModele sur un Voyage donné - même
    logique que le sélecteur "Appliquer un itinéraire type" du détail d'un
    voyage côté frontend (MissionControl.jsx / appliquerItineraire), mais
    déclenchée automatiquement côté serveur quand un passager rejoint un
    convoi qui a mémorisé son itinéraire (Rotation.itineraire_modele) sur
    Rotation.itineraire_modele. N'écrase rien si des étapes "aller" existent
    déjà sur ce voyage (idempotent, ne duplique pas)."""
    from .models import EtapeVoyage
    if EtapeVoyage.objects.filter(voyage=voyage, sens="aller").exists():
        return
    # Le tableau JMP "Cote de securite de route" represente le trajet
    # COMPLET du convoi (ex: CAMP -> ... -> ABIDJAN), independamment du point
    # de montee/descente propre A CE passager (voyage.origine/destination) -
    # donc on part de l'origine de l'ITINERAIRE, jamais de celle du voyage.
    precedente = itineraire.origine or ""
    for i, et in enumerate(itineraire.etapes.order_by("ordre")):
        EtapeVoyage.objects.create(
            voyage=voyage, ordre=i + 1, sens="aller",
            origine=precedente, destination=et.ville,
            distance_km=et.distance_km, heure_depart=et.heure_depart, heure_arrivee_prevue=et.heure_arrivee,
            pause_fatigue=et.pause_fatigue or "", mode_transport="bus",
            date_etape=voyage.date_depart,
        )
        precedente = et.ville


class VoyageViewSet(viewsets.ModelViewSet):
    queryset = Voyage.objects.select_related("personnel","batiment","enregistre_par").all()
    serializer_class = VoyageSerializer
    filter_backends = [filters.SearchFilter]
    search_fields = ["personnel__nom","personnel__prenom","destination"]

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        # Liaison convoi <-> résidence appliquée à la date du trajet (throttlée)
        from .automatisation import appliquer_si_necessaire
        appliquer_si_necessaire()

    def get_queryset(self):
        # PERFORMANCE : sans ces préchargements, le serializer refaisait ~6
        # requêtes SQL PAR voyage (étapes, véhicule de chaque étape, validé
        # par...) - 1 200 requêtes pour la liste du Centre de Mobilité,
        # rechargée toutes les 30 s par chaque admin qui a la page ouverte.
        qs = (Voyage.objects
              .select_related("personnel", "batiment", "valide_par", "enregistre_par",
                              "conducteur_personnel", "conducteur_secondaire_personnel")
              .prefetch_related("etapes__vehicule_flotte"))
        statut = self.request.query_params.get("statut")
        statut_validation = self.request.query_params.get("statut_validation")
        personnel = self.request.query_params.get("personnel")
        rotation = self.request.query_params.get("rotation_id")
        if statut: qs = qs.filter(statut=statut)
        if statut_validation: qs = qs.filter(statut_validation=statut_validation)
        if personnel: qs = qs.filter(personnel_id=personnel)
        if rotation: qs = qs.filter(rotation_id=rotation)
        # Un non-admin ne voit QUE ses propres voyages - jamais ceux du
        # reste du camp. Avant ce correctif, n'importe quel agent pouvait
        # interroger l'API directement (hors interface) et voir les
        # deplacements de tout le monde ; le filtre cote frontend seul
        # n'est jamais une vraie protection.
        u = self.request.user
        role = getattr(getattr(u, "profile", None), "role", None)
        is_admin = u.is_staff or u.is_superuser or role == "admin"
        if not is_admin:
            qs = qs.filter(personnel__user=u)
        return qs

    def create(self, request, *args, **kwargs):
        # Règle d'or : un agent ne peut pas être sur 2 voyages actifs qui se
        # chevauchent dans le temps - deja applique pour les rotations
        # groupees (creer_rotation/rejoindre_rotation), mais manquait ici
        # pour la creation directe (voyage individuel).
        personnel_id = request.data.get("personnel")
        date_depart = request.data.get("date_depart")
        date_retour = request.data.get("date_retour_prevue")
        if date_depart and date_retour and str(date_retour) < str(date_depart):
            return Response({"error": "La date de retour ne peut pas être avant la date de départ"}, status=400)
        if personnel_id and date_depart and date_retour:
            conflict = _check_voyage_conflit(personnel_id, date_depart, date_retour)
            if conflict:
                return Response({
                    "error": f"Cette personne est déjà sur un autre voyage actif du {conflict.date_depart} au {conflict.date_retour_prevue} (règle : pas de voyages qui se chevauchent)."
                }, status=400)
        # Delai minimum de 48h avant le depart, pour une demande en
        # SELF-SERVICE (un agent qui declare son propre voyage) - un admin
        # cree en connaissance de cause (urgence, medical) et n'est jamais
        # bloque par cette regle, meme pour le compte d'un tiers.
        u = request.user
        is_admin = u.is_staff or u.is_superuser or (hasattr(u,"profile") and getattr(u.profile,"role","")=="admin")
        if not is_admin and date_depart:
            from django.utils import timezone
            from datetime import datetime, timedelta
            try:
                dt_depart = datetime.strptime(date_depart, "%Y-%m-%d").date()
            except ValueError:
                dt_depart = None
            if dt_depart:
                limite = timezone.localdate() + timedelta(days=2)
                if dt_depart < limite:
                    return Response({
                        "error": "Les demandes de voyage doivent être envoyées au moins 48h avant la date de départ. Pour un départ plus proche, contactez l'administrateur directement."
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
        motif = request.data.get("motif", "").strip()
        if not motif:
            return Response({"error":"Le motif de refus est obligatoire."}, status=400)
        voyage.statut_validation = "refuse"
        voyage.valide_par = u
        from django.utils import timezone
        voyage.date_validation = timezone.now()
        voyage.motif_refus = motif
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
            # Meme correctif que creer_rotation (voir _conducteur_en_conflit) :
            # verifie aussi Rotation, pas seulement Voyage, sinon le
            # chauffeur d'un convoi tout juste cree (encore sans aucun
            # passager) reste invisible a ce controle.
            chevauche = _conducteur_en_conflit(None, nouveau_conducteur, voyage.date_depart, voyage.date_retour_prevue,
                                                 exclude_rotation_id=voyage.rotation_id)
            if chevauche:
                return Response({"error": f"{nouveau_conducteur} est déjà chauffeur (principal ou second) sur un autre convoi actif du {chevauche.date_depart} au {chevauche.date_retour_prevue}."}, status=400)
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
        # Meme verrouillage que rejoindre_rotation : deplacer quelqu'un vers
        # un convoi cible verifie sa capacite avant d'agir - sans verrou,
        # deux deplacements simultanes vers le MEME convoi cible presque
        # plein pouvaient tous les deux passer le controle et le surbooker.
        with transaction.atomic():
            cible = Voyage.objects.select_for_update().filter(rotation_id=nouveau_rotation_id).exclude(statut="annule").first()
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

    def update(self, request, *args, **kwargs):
        # BUG REEL CORRIGE ICI : seul partial_update() (PATCH) verifiait
        # l'admin - update() (PUT) n'etait jamais surcharge et heritait du
        # comportement par defaut de ModelViewSet (IsAuthenticated tout
        # court), permettant a n'importe quel utilisateur connecte de
        # modifier n'importe quel voyage via une requete PUT. On refait le
        # controle ici et on delegue a l'implementation reelle (pas a
        # self.partial_update(), dont l'implementation DRF standard
        # rappelle self.update() - ca boucleraient a l'infini).
        u = request.user
        is_admin = u.is_staff or u.is_superuser or (hasattr(u,"profile") and getattr(u.profile,"role","")=="admin")
        if not is_admin:
            return Response({"error":"Admin requis"}, status=403)
        kwargs["partial"] = True
        return super().update(request, *args, **kwargs)

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
        date_str = request.data.get("date_depart_reelle")
        date = datetime.date.fromisoformat(date_str) if date_str else None
        voyage.partir(date)
        return Response(VoyageSerializer(voyage).data)

    @action(detail=True, methods=["post"])
    def enregistrer_montee(self, request, pk=None):
        """
        Enregistre un evenement de montee REEL pour ce passager - distinct
        du fait d'etre simplement AFFECTE a la rotation (Voyage deja
        cree). Point metier explicite du document de refonte : affecte ≠
        monte. Le lieu par defaut reprend voyage.origine (lieu de montee
        PREVU), mais peut etre corrige si la montee a reellement eu lieu
        ailleurs.
        """
        from .models import EvenementMonteeDescente
        import datetime as dt
        voyage = self.get_object()
        lieu = request.data.get("lieu") or voyage.origine or "—"
        date_heure_str = request.data.get("date_heure")
        date_heure = dt.datetime.fromisoformat(date_heure_str) if date_heure_str else timezone.now()
        if timezone.is_naive(date_heure):
            date_heure = timezone.make_aware(date_heure)
        evt = EvenementMonteeDescente.objects.create(
            voyage=voyage, type_evenement="montee", lieu=lieu, date_heure=date_heure,
            latitude=request.data.get("latitude"), longitude=request.data.get("longitude"),
            enregistre_par=request.user,
        )
        return Response({"id": evt.id, "type_evenement": "montee", "lieu": evt.lieu, "date_heure": evt.date_heure})

    @action(detail=True, methods=["post"])
    def enregistrer_descente(self, request, pk=None):
        """Meme principe que enregistrer_montee, pour l'evenement de descente."""
        from .models import EvenementMonteeDescente
        import datetime as dt
        voyage = self.get_object()
        lieu = request.data.get("lieu") or voyage.destination or "—"
        date_heure_str = request.data.get("date_heure")
        date_heure = dt.datetime.fromisoformat(date_heure_str) if date_heure_str else timezone.now()
        if timezone.is_naive(date_heure):
            date_heure = timezone.make_aware(date_heure)
        evt = EvenementMonteeDescente.objects.create(
            voyage=voyage, type_evenement="descente", lieu=lieu, date_heure=date_heure,
            latitude=request.data.get("latitude"), longitude=request.data.get("longitude"),
            enregistre_par=request.user,
        )
        return Response({"id": evt.id, "type_evenement": "descente", "lieu": evt.lieu, "date_heure": evt.date_heure})

    @action(detail=True, methods=["get"])
    def itineraire_reel(self, request, pk=None):
        """
        Itineraire REEL du passager (section 21 du document) : construit
        UNIQUEMENT a partir des evenements montee/descente reellement
        enregistres - jamais saisi manuellement comme une nouvelle route.
        Distinct de l'itineraire de la ROTATION (EtapeVoyage, deja
        existant) - le billet affichera les deux separement.
        """
        from .models import EvenementMonteeDescente
        voyage = self.get_object()
        segments = EvenementMonteeDescente.itineraire_reel(voyage)
        evenements = list(voyage.evenements_montee_descente.order_by("date_heure").values(
            "id", "type_evenement", "lieu", "date_heure"))
        return Response({"segments": segments, "evenements": evenements})

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
        # Arrivée au camp (trajet X -> Camp) : « repart du camp le » -> date de
        # départ de l'hébergement restitué (cf. Voyage.revenir), qui déclenche
        # la relance J-1 « Vous partez demain ? ».
        prochain = request.data.get("prochain_depart")
        if prochain:
            try:
                voyage.date_retour_prevue = datetime.date.fromisoformat(str(prochain))
            except ValueError:
                return Response({"error": "Date de prochain départ invalide"}, status=400)
            voyage.save(update_fields=["date_retour_prevue"])
        info_chambre = voyage.revenir(date)
        # Vehicule/conducteur du retour, si different de l'aller (ex: agent
        # regroupe dans un autre vehicule suite a un retour anticipe)
        champs_retour = {}
        if request.data.get("vehicule_retour"): champs_retour["vehicule_retour"] = request.data["vehicule_retour"]
        if request.data.get("vehicule_matricule_retour"): champs_retour["vehicule_matricule_retour"] = request.data["vehicule_matricule_retour"]
        if request.data.get("conducteur_retour"): champs_retour["conducteur_retour"] = request.data["conducteur_retour"]
        if champs_retour:
            for k,v in champs_retour.items(): setattr(voyage, k, v)
            voyage.save(update_fields=list(champs_retour.keys()))
        data = VoyageSerializer(voyage).data
        if info_chambre.get("chambre_occupee_par"):
            data["alerte_chambre"] = f"Sa résidence principale ({info_chambre['residence']}) est actuellement occupée par {info_chambre['chambre_occupee_par']} — restitution manuelle à organiser."
        return Response(data)

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
        pour permettre le nettoyage/correction de donnees par un admin.

        Bug corrige ici : ne verifiait/supprimait QUE les lignes Voyage,
        jamais l'objet Rotation lui-meme - depuis que Rotation existe de
        facon independante (creee meme avec 0 passager, cf. modele
        Rotation), un convoi sans aucun passager actif (ou dont tous les
        passagers ont deja ete retires/annules) repondait "introuvable"
        alors que la Rotation existait toujours et restait affichee/
        bloquante (vehicule/conducteur "occupes") sans qu'aucun bouton ne
        permette de la supprimer."""
        u = request.user
        is_admin = u.is_staff or u.is_superuser or (hasattr(u,"profile") and getattr(u.profile,"role","")=="admin")
        if not is_admin:
            return Response({"error":"Admin requis"}, status=403)
        rotation_id = request.data.get("rotation_id")
        if not rotation_id:
            return Response({"error":"rotation_id requis"}, status=400)
        membres = Voyage.objects.filter(rotation_id=rotation_id).exclude(statut="annule")
        rotation_obj = Rotation.objects.filter(rotation_id=rotation_id).first()
        if not membres.exists() and not rotation_obj:
            return Response({"error":"Convoi introuvable ou déjà vide"}, status=404)
        nb = membres.count()
        membres.delete()
        if rotation_obj:
            rotation_obj.delete()
        return Response({"ok": True, "supprimes": nb})

    # ── Stats ──────────────────────────────────────────────────────
    @action(detail=False, methods=["get"])
    def stats(self, request):
        from django.utils import timezone
        from datetime import timedelta
        # BUG REEL CORRIGE ICI : Voyage.objects.all() ignorait la
        # restriction "un non-admin ne voit que ses propres voyages" déjà
        # appliquée par get_queryset() (utilisée par list()) - un agent
        # recevait donc les statistiques de TOUT le camp (tableau de bord
        # admin), pas les siennes. get_queryset() applique déjà la bonne
        # règle, on la réutilise au lieu de la dupliquer.
        qs = self.get_queryset()
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
        # Données nominatives d'autres personnes : réservées aux admins.
        # Un utilisateur simple ne voit que ses propres retours anticipés.
        u = request.user
        role = getattr(getattr(u, "profile", None), "role", "")
        if not (u.is_staff or u.is_superuser or role == "admin"):
            pers = getattr(u, "personnel", None)
            qs = qs.filter(personnel=pers) if pers else qs.none()
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
        u = request.user
        role = getattr(getattr(u, "profile", None), "role", None)
        is_admin = u.is_staff or u.is_superuser or role == "admin"

        # Source de verite desormais le modele Rotation (existence
        # independante des passagers - bug corrige : avant, une rotation
        # sans aucun passager n'existait nulle part puisqu'elle n'etait
        # QUE le regroupement de lignes Voyage qui la partageaient). Les
        # rotations a 0 passager s'affichent donc maintenant normalement,
        # pretes a recevoir des personnes ensuite (section 11 du document).
        rotations_qs = list(Rotation.objects.all().order_by("-date_depart").values(
            "rotation_id","date_depart","date_retour_prevue","destination","origine",
            "vehicule","vehicule_matricule","vehicule_photo","conducteur","conducteur_secondaire","nb_places_total","heure_depart","point_rdv",
            "motif","niveau_alerte","trajet_aller_seul","itineraire_modele_id"))

        # PERFORMANCE : recupere TOUS les passagers de TOUTES les rotations
        # en UNE seule requete, puis regroupe en memoire par rotation_id -
        # au lieu d'une requete SEPAREE par rotation (N+1 classique).
        rotation_ids = [g["rotation_id"] for g in rotations_qs]

        # Villes intermediaires de l'itineraire de chaque convoi (dans
        # l'ordre) - necessaire pour que le frontend propose une liste
        # deroulante de points de montee/descente qui respecte l'ordre
        # REEL du trajet, au lieu d'un champ texte libre ou n'importe quoi
        # pouvait etre saisi (demande explicite : "qu'une liste deroulante
        # s'affiche en tenant compte de l'ordre de l'itineraire"). Une
        # seule requete groupee pour tous les itineraires references,
        # jamais une par convoi (N+1).
        itineraire_ids = {g["itineraire_modele_id"] for g in rotations_qs if g["itineraire_modele_id"]}
        villes_par_itineraire = {}
        if itineraire_ids:
            from .models import EtapeItineraireModele as _EIM
            for e in _EIM.objects.filter(itineraire_id__in=itineraire_ids).order_by("itineraire_id", "ordre"):
                villes_par_itineraire.setdefault(e.itineraire_id, []).append(e.ville)

        tous_passagers = list(Voyage.objects.filter(rotation_id__in=rotation_ids)
            .exclude(statut="annule")
            .select_related("personnel")
            .values("id","rotation_id","personnel_id","personnel__nom","personnel__prenom",
                    "personnel__societe","statut","statut_validation","destination"))
        passagers_par_rotation = {}
        for p in tous_passagers:
            passagers_par_rotation.setdefault(p["rotation_id"], []).append(p)

        # Chambre (residence principale) de chaque passager - demande
        # explicite ("ajouter les chambres d'occupation" au manifeste du
        # convoi) : utile pour savoir quelles chambres se liberent quand ce
        # convoi part. Meme cache "une seule requete groupee" que
        # PersonnelSerializer.get_residence_principale, construit ici
        # directement plutot que de repasser par le serializer Personnel.
        from residences.models import ResidentPrincipal as _RP
        personnel_ids_passagers = {p["personnel_id"] for p in tous_passagers if p["personnel_id"]}
        chambres_par_personnel = {
            rp.personnel_id: rp.batiment.residence
            for rp in _RP.objects.filter(personnel_id__in=personnel_ids_passagers, date_fin__isnull=True).select_related("batiment")
            if rp.batiment_id
        }
        for p in tous_passagers:
            p["chambre"] = chambres_par_personnel.get(p["personnel_id"]) or ""

        result = []
        for g in rotations_qs:
            passagers = passagers_par_rotation.get(g["rotation_id"], [])
            # BUG REEL CORRIGE ICI : g["destination"] etait ECRASEE par la
            # destination la plus frequente parmi les PASSAGERS (leur propre
            # lieu de descente), au lieu de rester la destination FINALE de
            # l'itineraire enregistree sur la Rotation elle-meme. Consequence
            # concrete signalee : un convoi Abidjan -> ... -> Camp (dernier
            # arret reel de l'itineraire) affichait "BOUAKE" comme
            # "destination finale" sur le JMP des qu'une majorite de
            # passagers descendait a Bouake - alors que Bouake n'est qu'une
            # ETAPE intermediaire, pas la fin du trajet du convoi. Ca
            # faussait aussi arrets_itineraire (tronque a Bouake) et le
            # badge "destinationDiffere" cote frontend (qui compare la
            # destination du passager a celle, censee etre fixe, du convoi).
            # g["destination"] reste donc TOUJOURS la valeur enregistree sur
            # la Rotation (deja presente via le values() plus haut) - ne
            # jamais la deriver des voyages passagers.
            if passagers:
                statuts_presents = {p["statut"] for p in passagers}
                if statuts_presents == {"retour"}:
                    statut_rotation = "retour"
                elif "en_voyage" in statuts_presents:
                    statut_rotation = "en_voyage"
                elif "planifie" in statuts_presents:
                    statut_rotation = "planifie"
                else:
                    statut_rotation = next(iter(statuts_presents), "planifie")
            else:
                statut_rotation = "planifie"
            g["statut"] = statut_rotation
            # Points d'arret ordonnes du convoi (origine -> villes
            # intermediaires -> destination), pour la liste deroulante
            # montee/descente cote frontend.
            g["arrets_itineraire"] = (
                [g["origine"]] + villes_par_itineraire.get(g["itineraire_modele_id"], []) + [g["destination"]]
                if g["origine"] and g["destination"] else []
            )
            # Liste nominative des passagers : UNIQUEMENT pour l'admin. Un
            # agent qui consulte les rotations disponibles pour en
            # rejoindre une ne doit voir qu'un nombre de sieges libres,
            # jamais qui sont les autres occupants du convoi (avant ce
            # correctif, le frontend n'affichait deja que l'agrege, mais
            # l'API elle-meme renvoyait les noms complets a quiconque -
            # visible via les outils reseau du navigateur).
            if is_admin:
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
        # "individuels" (voyages solo, sans rotation) : non utilise cote
        # frontend actuellement, mais meme principe applique par coherence -
        # jamais les noms d'autrui pour un non-admin.
        indiv = []
        if is_admin:
            indiv = list(Voyage.objects
                .filter(rotation_id__isnull=True)
                .select_related("personnel")
                .values("id","personnel__nom","personnel__prenom","destination","date_depart","statut")
                .order_by("-date_depart")[:50])
        return Response({"rotations":result,"individuels":indiv,"total_rotations":len(result)})

    @action(detail=False, methods=["get"])
    def demandes_a_organiser(self, request):
        """
        Section 6/11 du document de refonte : les demandes de voyage
        VALIDEES par l'admin (systeme de demandes existant, reutilise tel
        quel) dont le voyage n'a pas encore de vehicule/chauffeur. C'est le
        "pool" de personnes pretes a etre organisees en rotation.

        Expose aussi le convoi auquel le voyage est DEJA rattache (la
        validation regroupe automatiquement les demandes du meme itineraire
        et de la meme date dans une Rotation) pour que l'ecran puisse
        completer CE convoi plutot que d'en recreer un nouveau.
        Les voyages en vehicule personnel n'ont rien a organiser : exclus.
        """
        from residences.models import Demande
        demandes = (Demande.objects
            .filter(type_demande="voyage", statut="validee")
            .select_related("demandeur", "demandeur__personnel")
            .prefetch_related("voyages_generes"))
        # Voyages préchargés (prefetch_related) : filtrés en Python pour ne pas
        # refaire une requête par demande ; convois chargés en une fois.
        voyages_par_demande = {}
        for d in demandes:
            vs = [v for v in d.voyages_generes.all() if v.statut != "annule"]
            voyages_par_demande[d.id] = max(vs, key=lambda v: v.id) if vs else None
        rids = {v.rotation_id for v in voyages_par_demande.values() if v and v.rotation_id}
        rotations = {r.rotation_id: r for r in Rotation.objects.select_related("itineraire_modele").filter(rotation_id__in=rids)}
        result = []
        for d in demandes:
            voyage = voyages_par_demande[d.id]
            if not voyage or voyage.vehicule_matricule or voyage.vehicule_personnel:
                continue  # deja organisee (vehicule assigne), vehicule perso, ou voyage introuvable
            rot = rotations.get(voyage.rotation_id) if voyage.rotation_id else None
            p = getattr(d.demandeur, "personnel", None)
            result.append({
                "demande_id": d.id,
                "voyage_id": voyage.id,
                "personnel_id": p.id if p else None,
                "personnel_nom": f"{p.nom} {p.prenom}" if p else d.demandeur.get_full_name(),
                "origine": voyage.origine,
                "destination": voyage.destination,
                "date_depart": voyage.date_depart,
                "date_retour_prevue": voyage.date_retour_prevue,
                "rotation_id": rot.rotation_id if rot else None,
                "itineraire_nom": rot.itineraire_modele.nom if rot and rot.itineraire_modele else None,
            })
        return Response({"demandes_a_organiser": result})

    @action(detail=False, methods=["post"])
    def organiser_demandes_en_rotation(self, request):
        """
        Organise des voyages deja valides dans UN convoi partage (meme
        vehicule/chauffeur, meme rotation_id). Entrees :
          - demande_ids : demandes de voyage validees (onglet "A organiser")
          - voyage_ids  : voyages individuels hors convoi (ex: depart confirme
                          depuis "Mon depart") - meme traitement
          - rotation_id : convoi EXISTANT a completer (facultatif)

        BUG REEL CORRIGE ICI : cette action creait TOUJOURS une nouvelle
        rotation dimensionnee au nombre de demandes cochees
        (nb_places_total = len(voyages)) - une seule demande organisee
        donnait donc un convoi d'UNE place, plein d'emblee ("Rotation
        complete" pour tout ajout ulterieur), qui ressemblait a un voyage
        individuel. Et elle sortait les passagers du convoi deja forme
        automatiquement a la validation (meme itineraire + meme date).
        Desormais :
          - rotation_id fourni            -> on complete ce convoi ;
          - sinon, si tous les voyages sont deja dans le meme convoi -> on
            l'organise (vehicule/chauffeur) sans le casser ;
          - sinon nouveau convoi ;
          - capacite = celle du vehicule de la flotte (VehiculeFlotte),
            jamais le nombre de passagers du moment.
        Memes regles qu'avant : conducteur ≠ passager, conducteur ≠ second
        chauffeur, second chauffeur ≠ passager.
        """
        from residences.models import Demande, Personnel as _Pers
        data = request.data
        demande_ids = data.get("demande_ids") or []
        voyage_ids = data.get("voyage_ids") or []
        if not demande_ids and not voyage_ids:
            return Response({"error": "Au moins une demande ou un voyage requis."}, status=400)

        # ── Voyages a organiser ──
        voyages = []
        if demande_ids:
            demandes = Demande.objects.filter(id__in=demande_ids, type_demande="voyage", statut="validee")
            if demandes.count() != len(set(demande_ids)):
                return Response({"error": "Une ou plusieurs demandes ne sont pas valides/validées."}, status=400)
            for d in demandes:
                v = d.voyages_generes.exclude(statut="annule").order_by("-id").first()
                if not v:
                    return Response({"error": f"Aucun voyage généré pour la demande #{d.id}."}, status=400)
                voyages.append(v)
        if voyage_ids:
            extra = list(Voyage.objects.filter(id__in=voyage_ids).exclude(statut__in=["annule", "retour"]))
            if len(extra) != len(set(voyage_ids)):
                return Response({"error": "Un ou plusieurs voyages sont introuvables ou terminés."}, status=400)
            voyages += [v for v in extra if v.id not in {x.id for x in voyages}]
        for v in voyages:
            if v.vehicule_personnel:
                return Response({"error": f"{v.personnel.nom} {v.personnel.prenom} voyage avec son véhicule personnel — rien à organiser."}, status=400)

        # ── Convoi cible ──
        cible_id = (data.get("rotation_id") or "").strip()
        rotation = None
        if cible_id:
            rotation = Rotation.objects.filter(rotation_id=cible_id).first()
            if not rotation:
                return Response({"error": "Rotation introuvable."}, status=404)
            statuts = set(Voyage.objects.filter(rotation_id=cible_id).exclude(statut="annule").values_list("statut", flat=True))
            if statuts and not statuts & {"planifie", "en_voyage"}:
                return Response({"error": "Ce convoi est déjà terminé — impossible d'y ajouter quelqu'un."}, status=400)
        else:
            ids = {v.rotation_id for v in voyages}
            if len(ids) == 1 and None not in ids:
                rotation = Rotation.objects.filter(rotation_id=ids.pop()).first()
        for v in voyages:
            if v.vehicule_matricule and v.rotation_id != (rotation.rotation_id if rotation else None):
                return Response({"error": f"{v.personnel.nom} {v.personnel.prenom} est déjà organisé dans une autre rotation."}, status=409)

        # ── Vehicule / chauffeurs : ceux du formulaire, sinon ceux du convoi cible ──
        conducteur = (data.get("conducteur") or "").strip()
        conducteur_secondaire = (data.get("conducteur_secondaire") or "").strip()
        conducteur_personnel = conducteur_secondaire_personnel = None
        if data.get("conducteur_id"):
            conducteur_personnel = _Pers.objects.filter(pk=data.get("conducteur_id")).first()
            if conducteur_personnel:
                conducteur = f"{conducteur_personnel.nom} {conducteur_personnel.prenom}"
        if data.get("conducteur_secondaire_id"):
            conducteur_secondaire_personnel = _Pers.objects.filter(pk=data.get("conducteur_secondaire_id")).first()
            if conducteur_secondaire_personnel:
                conducteur_secondaire = f"{conducteur_secondaire_personnel.nom} {conducteur_secondaire_personnel.prenom}"
        vehicule = data.get("vehicule", "") or ""
        vehicule_matricule = data.get("vehicule_matricule", "") or ""
        if rotation and not vehicule_matricule:
            vehicule, vehicule_matricule = rotation.vehicule, rotation.vehicule_matricule
        if rotation and not conducteur:
            conducteur, conducteur_personnel = rotation.conducteur, rotation.conducteur_personnel
            if not conducteur_secondaire:
                conducteur_secondaire = rotation.conducteur_secondaire
                conducteur_secondaire_personnel = rotation.conducteur_secondaire_personnel
        if not conducteur or not vehicule_matricule:
            return Response({"error": "Véhicule et chauffeur principal sont obligatoires."}, status=400)
        meme_personne = (conducteur_personnel and conducteur_secondaire_personnel and conducteur_personnel.id == conducteur_secondaire_personnel.id) \
            if (conducteur_personnel or conducteur_secondaire_personnel) else (conducteur_secondaire and conducteur_secondaire.lower() == conducteur.lower())
        if meme_personne:
            return Response({"error": "Le second chauffeur doit être différent du chauffeur principal."}, status=400)

        itineraire_id = data.get("itineraire_modele_id") or None
        itineraire_obj = ItineraireModele.objects.filter(pk=itineraire_id).first() if itineraire_id else None
        if not itineraire_obj and rotation and rotation.itineraire_modele_id:
            itineraire_obj = rotation.itineraire_modele

        with transaction.atomic():
            if rotation:
                Rotation.objects.select_for_update().filter(pk=rotation.pk).first()
                deja = list(Voyage.objects.filter(rotation_id=rotation.rotation_id).exclude(statut="annule").exclude(id__in=[v.id for v in voyages]))
            else:
                deja = []
            tous = deja + voyages

            # Conducteur(s) jamais passager(s) - sur l'ENSEMBLE du convoi
            passagers_ids = {v.personnel_id for v in tous if v.personnel_id}
            noms_passagers = {f"{v.personnel.nom} {v.personnel.prenom}".strip().lower() for v in tous if v.personnel}
            for nom, pers, role in ((conducteur, conducteur_personnel, "conducteur"),
                                    (conducteur_secondaire, conducteur_secondaire_personnel, "second chauffeur")):
                if not nom:
                    continue
                if (pers and pers.id in passagers_ids) or (not pers and nom.lower() in noms_passagers):
                    return Response({"error": f"{nom} fait partie des personnes à transporter : ne peut pas être aussi {role}."}, status=400)

            # Capacite = celle du vehicule (flotte), sinon saisie, sinon celle du convoi / 15
            vf = VehiculeFlotte.objects.filter(matricule=vehicule_matricule).first() if vehicule_matricule else None
            try:
                saisie = int(data.get("nb_places_total") or 0)
            except (TypeError, ValueError):
                saisie = 0
            places = (vf.capacite if vf else 0) or saisie or max(rotation.nb_places_total if rotation else 0, 15)
            if len(tous) > places:
                return Response({"error": f"Le véhicule {vehicule_matricule} n'a que {places} place(s) pour {len(tous)} passager(s)."}, status=400)

            anciennes = {v.rotation_id for v in voyages if v.rotation_id} - ({rotation.rotation_id} if rotation else set())
            if not rotation:
                rotation = Rotation.objects.create(
                    rotation_id=str(uuid.uuid4())[:8].upper(),
                    origine=itineraire_obj.origine if itineraire_obj else (voyages[0].origine or ""),
                    destination=itineraire_obj.destination if itineraire_obj else (voyages[0].destination or ""),
                    date_depart=min(v.date_depart for v in voyages),
                    date_retour_prevue=max(v.date_retour_prevue for v in voyages),
                    statut="planifie", enregistre_par=request.user,
                )
            rotation.vehicule, rotation.vehicule_matricule = vehicule, vehicule_matricule
            if vf and vf.photo and not rotation.vehicule_photo:
                rotation.vehicule_photo = vf.photo
            rotation.conducteur, rotation.conducteur_personnel = conducteur, conducteur_personnel
            rotation.conducteur_secondaire, rotation.conducteur_secondaire_personnel = conducteur_secondaire, conducteur_secondaire_personnel
            rotation.nb_places_total = places
            if itineraire_obj:
                rotation.itineraire_modele = itineraire_obj
                rotation.origine = rotation.origine or itineraire_obj.origine
                rotation.destination = rotation.destination or itineraire_obj.destination
            rotation.save()

            for v in tous:
                v.vehicule, v.vehicule_matricule = vehicule, vehicule_matricule
                v.conducteur, v.conducteur_secondaire = conducteur, conducteur_secondaire
                v.conducteur_personnel, v.conducteur_secondaire_personnel = conducteur_personnel, conducteur_secondaire_personnel
                v.rotation_id = rotation.rotation_id
                v.type_voyage = "rotation"
                v.nb_places_total = places
                v.save(update_fields=["vehicule","vehicule_matricule","conducteur","conducteur_secondaire",
                                      "conducteur_personnel","conducteur_secondaire_personnel","rotation_id","type_voyage","nb_places_total"])
                if itineraire_obj:
                    _appliquer_itineraire_a_voyage(v, itineraire_obj)

            # Convois automatiques vides laissés derrière (jamais organisés) : supprimés
            for rid in anciennes:
                if not Voyage.objects.filter(rotation_id=rid).exclude(statut="annule").exists():
                    Rotation.objects.filter(rotation_id=rid, vehicule_matricule="").delete()

        return Response({"rotation_id": rotation.rotation_id, "nb_personnes": len(voyages),
                         "nb_passagers_total": len(tous), "nb_places_total": places}, status=201)

    @action(detail=False, methods=["post"])
    def creer_rotation(self, request):
        data = request.data
        rotation_id     = str(uuid.uuid4())[:8].upper()
        destination     = data.get("destination","")
        origine         = data.get("origine","Camp Roxgold Sango")
        date_depart     = data.get("date_depart")
        # Le convoi se deroule sur UN SEUL jour (aller uniquement, retour
        # supprime du modele) - il n'y a plus de champ "date de retour" a
        # saisir a la creation du convoi lui-meme (demande explicite :
        # "il faut differentier passager a convoi" - la date de retour est
        # desormais UNIQUEMENT un attribut du PASSAGER, saisie quand il
        # rejoint le convoi via rejoindre_rotation, jamais ici). On replie
        # sur date_depart par defaut, uniquement pour satisfaire le champ
        # NOT NULL de Rotation.date_retour_prevue - purement technique,
        # sans signification metier propre au convoi.
        date_retour     = data.get("date_retour_prevue") or date_depart
        vehicule        = data.get("vehicule","")
        vehicule_matricule = data.get("vehicule_matricule","")
        vehicule_photo  = data.get("vehicule_photo","")
        conducteur      = data.get("conducteur","")
        conducteur_secondaire = data.get("conducteur_secondaire","")
        itineraire_id   = data.get("itineraire_id") or None
        # Reference reelle vers Personnel (privilegiee) - le texte libre
        # ci-dessus reste accepte pour compatibilite ascendante (anciens
        # appelants, saisie manuelle exceptionnelle), mais quand un ID est
        # fourni il devient la source de verite et REMPLIT le texte
        # automatiquement, plutot que l'inverse.
        conducteur_personnel = None
        conducteur_secondaire_personnel = None
        conducteur_id = data.get("conducteur_id")
        conducteur_secondaire_id = data.get("conducteur_secondaire_id")
        if conducteur_id:
            from residences.models import Personnel as _Pers
            conducteur_personnel = _Pers.objects.filter(pk=conducteur_id).first()
            if conducteur_personnel:
                conducteur = f"{conducteur_personnel.nom} {conducteur_personnel.prenom}"
        if conducteur_secondaire_id:
            from residences.models import Personnel as _Pers
            conducteur_secondaire_personnel = _Pers.objects.filter(pk=conducteur_secondaire_id).first()
            if conducteur_secondaire_personnel:
                conducteur_secondaire = f"{conducteur_secondaire_personnel.nom} {conducteur_secondaire_personnel.prenom}"
        niveau_alerte   = data.get("niveau_alerte", 1)
        trajet_aller_seul = bool(data.get("trajet_aller_seul", False))
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
        if not date_depart:
            return Response({"error":"date_depart requis"},status=400)

        # Regle : le conducteur ne peut pas etre aussi passager de la meme
        # rotation - SAUF si c'est un voyage SOLO (une seule personne) : la
        # personne peut legitimement conduire elle-meme son propre vehicule.
        # Comparaison par ID (fiable) quand conducteur_personnel est fourni,
        # sinon repli sur la comparaison de nom (texte libre, ancien
        # comportement conserve pour compatibilite).
        if conducteur and len(passagers_ids) > 1:
            if conducteur_personnel:
                if conducteur_personnel.id in passagers_ids:
                    return Response({"error": f"{conducteur} est désigné comme conducteur : il ne peut pas être aussi passager de la même rotation."}, status=400)
            else:
                from residences.models import Personnel
                for pid in passagers_ids:
                    try:
                        p = Personnel.objects.get(pk=pid)
                        if f"{p.nom} {p.prenom}".strip().lower() == conducteur.strip().lower():
                            return Response({"error": f"{conducteur} est désigné comme conducteur : il ne peut pas être aussi passager de la même rotation."}, status=400)
                    except Personnel.DoesNotExist:
                        pass
        # Meme regle pour le second chauffeur (relance) - un cumul
        # chauffeur+second+passager n'a jamais ete controle jusqu'ici.
        if conducteur and conducteur_secondaire:
            meme_personne = (conducteur_personnel and conducteur_secondaire_personnel and conducteur_personnel.id == conducteur_secondaire_personnel.id) \
                if (conducteur_personnel or conducteur_secondaire_personnel) else (conducteur.strip().lower() == conducteur_secondaire.strip().lower())
            if meme_personne:
                return Response({"error": f"{conducteur} ne peut pas être à la fois conducteur principal et second chauffeur de la même rotation."}, status=400)
        if conducteur_secondaire and len(passagers_ids) > 1:
            if conducteur_secondaire_personnel:
                if conducteur_secondaire_personnel.id in passagers_ids:
                    return Response({"error": f"{conducteur_secondaire} est désigné comme second chauffeur : il ne peut pas être aussi passager de la même rotation."}, status=400)
            else:
                from residences.models import Personnel
                for pid in passagers_ids:
                    try:
                        p = Personnel.objects.get(pk=pid)
                        if f"{p.nom} {p.prenom}".strip().lower() == conducteur_secondaire.strip().lower():
                            return Response({"error": f"{conducteur_secondaire} est désigné comme second chauffeur : il ne peut pas être aussi passager de la même rotation."}, status=400)
                    except Personnel.DoesNotExist:
                        pass
        if conducteur:
            # Regle : le conducteur ne peut pas deja etre conducteur (principal
            # ou second) sur un AUTRE convoi actif qui chevauche les dates -
            # verifie desormais Rotation ET Voyage (voir _conducteur_en_conflit).
            chevauche = _conducteur_en_conflit(conducteur_id, conducteur, date_depart, date_retour)
            if chevauche:
                return Response({"error": f"{conducteur} est déjà chauffeur (principal ou second) sur un autre convoi actif du {chevauche.date_depart} au {chevauche.date_retour_prevue}."}, status=400)
        if conducteur_secondaire:
            # Meme controle de chevauchement pour le second chauffeur, sur
            # les DEUX roles a la fois (personne ne peut conduire 2 convois
            # en meme temps, quel que soit le role tenu sur chacun).
            chevauche2 = _conducteur_en_conflit(conducteur_secondaire_id, conducteur_secondaire, date_depart, date_retour)
            if chevauche2:
                return Response({"error": f"{conducteur_secondaire} est déjà chauffeur (principal ou second) sur un autre convoi actif du {chevauche2.date_depart} au {chevauche2.date_retour_prevue}."}, status=400)

        # Regle manquante jusqu'ici (signalee : "comment le meme vehicule est
        # utilise pour 3 rotations... a la meme date?") : un vehicule ne peut
        # pas non plus etre affecte a 2 convois actifs qui se chevauchent,
        # meme regle de chevauchement que pour le conducteur. On matche en
        # priorite sur le matricule (identifiant fiable), et a defaut sur le
        # nom du vehicule (repli texte libre, ancien comportement) - jamais
        # sur une valeur vide, qui ne veut rien dire ("aucun vehicule
        # renseigne" ne doit pas se bloquer lui-meme).
        # Deux sources a verifier : la Rotation elle-meme (existe meme sans
        # passager, cf. modele Rotation) ET les Voyage individuels (qui n'ont
        # pas de Rotation associee).
        if vehicule_matricule or vehicule:
            filtre_vehicule = Q()
            if vehicule_matricule:
                filtre_vehicule |= Q(vehicule_matricule__iexact=vehicule_matricule)
            if vehicule:
                filtre_vehicule |= Q(vehicule__iexact=vehicule)

            # Rotation.statut n'est JAMAIS mis a jour apres la creation (ni
            # par annuler/supprimer_planifie/supprimer_rotation, qui ne
            # touchent que les lignes Voyage) - filtrer sur ce champ
            # bloquerait le vehicule INDEFINIMENT, meme des mois apres que
            # tous les passagers du convoi soient rentres ou que le convoi
            # ait ete annule. On derive donc le vrai statut a partir des
            # Voyage rattaches (memes regles que l'action rotations()) :
            # un convoi sans aucun passager reste actif (vehicule reserve
            # a l'avance) ; un convoi dont TOUS les passagers sont
            # rentres/annules ne bloque plus rien.
            candidats_rotation = Rotation.objects.filter(
                filtre_vehicule,
                date_depart__lte=date_retour, date_retour_prevue__gte=date_depart,
            ).exclude(rotation_id=rotation_id)
            for candidat in candidats_rotation:
                membres = Voyage.objects.filter(rotation_id=candidat.rotation_id)
                if membres.exists() and not membres.exclude(statut__in=("retour","annule")).exists():
                    continue  # convoi termine ou annule - ne bloque plus
                return Response({"error": f"Ce véhicule ({vehicule_matricule or vehicule}) est déjà affecté au convoi {candidat.rotation_id} du {candidat.date_depart} au {candidat.date_retour_prevue}."}, status=400)

            chevauche_voyage = Voyage.objects.filter(
                filtre_vehicule,
                statut__in=("planifie","en_voyage"),
                date_depart__lte=date_retour, date_retour_prevue__gte=date_depart,
            ).exclude(rotation_id=rotation_id).first()
            if chevauche_voyage:
                return Response({"error": f"Ce véhicule ({vehicule_matricule or vehicule}) est déjà utilisé sur un autre voyage actif du {chevauche_voyage.date_depart} au {chevauche_voyage.date_retour_prevue}."}, status=400)

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

        # Villes intermediaires saisies LIBREMENT a la creation (sans
        # choisir un itineraire existant dans le selecteur) - avant ce
        # correctif, elles n'etaient jamais sauvegardees nulle part cote
        # backend : le frontend les postait comme EtapeVoyage directement
        # sur le voyage du PREMIER PASSAGER cree (data.ids[0]), qui
        # n'existe plus puisqu'un convoi se cree desormais TOUJOURS sans
        # passager (cf. plus haut). On les transforme ici en ItineraireModele
        # ad-hoc (inactif = n'apparait pas dans le selecteur d'itineraires
        # existants, purement usage interne a CE convoi), rattache a la
        # Rotation via itineraire_modele - exactement le meme mecanisme
        # que pour un itineraire existant choisi dans le selecteur, deja
        # applique automatiquement a chaque passager qui rejoint ensuite
        # (_appliquer_itineraire_a_voyage). Ceci corrige AUSSI la confusion
        # signalee entre le lieu de descente du PASSAGER et le lieu de fin
        # du CONVOI : le JMP part desormais toujours de l'origine du
        # convoi/itineraire, jamais du point de descente propre a un
        # passager individuel.
        villes_intermediaires = data.get("villesIntermediaires") or data.get("villes_intermediaires") or []
        if not itineraire_id and villes_intermediaires and destination:
            noms_valides = [v for v in villes_intermediaires if (v.get("nom") or "").strip()]
            if noms_valides:
                itineraire_adhoc = ItineraireModele.objects.create(
                    nom=f"{origine} → {destination} (convoi {rotation_id})",
                    origine=origine, destination=destination, actif=False,
                )
                ordre = 0
                precedente = origine
                for v in noms_valides:
                    ordre += 1
                    EtapeItineraireModele.objects.create(
                        itineraire=itineraire_adhoc, ordre=ordre, ville=v["nom"].strip(),
                        distance_km=v.get("distance_km") or None,
                        heure_depart=v.get("heure_depart") or None, heure_arrivee=v.get("heure_arrivee") or None,
                        pause_fatigue=v.get("pause") or v.get("pause_fatigue") or "",
                    )
                    precedente = v["nom"].strip()
                # Etape finale jusqu'a la destination du convoi elle-meme,
                # sauf si la derniere ville deja saisie EST cette destination.
                if precedente.strip().lower() != destination.strip().lower():
                    ordre += 1
                    EtapeItineraireModele.objects.create(
                        itineraire=itineraire_adhoc, ordre=ordre, ville=destination)
                itineraire_id = itineraire_adhoc.id

        # Bug reel corrige ici : la Rotation elle-meme (vehicule, chauffeur,
        # dates) est desormais toujours enregistree, MEME avec 0 passager -
        # avant ce correctif, une rotation cree sans personne ne persistait
        # RIEN du tout (cette boucle ne s'executait jamais), la rendant
        # invisible nulle part alors que la reponse annoncait un succes.
        # Section 11 du document de refonte : les personnes peuvent etre
        # ajoutees APRES la creation de la rotation, pas obligatoirement au
        # meme moment.
        if type_voyage != "individuel":
            Rotation.objects.create(
                rotation_id=rotation_id, vehicule=vehicule, vehicule_matricule=vehicule_matricule,
                vehicule_photo=vehicule_photo, conducteur=conducteur, conducteur_personnel=conducteur_personnel,
                conducteur_secondaire=conducteur_secondaire, conducteur_secondaire_personnel=conducteur_secondaire_personnel,
                destination=destination, origine=origine, date_depart=date_depart, date_retour_prevue=date_retour,
                heure_depart=heure_depart, point_rdv=point_rdv, motif=motif, nb_places_total=nb_places,
                niveau_alerte=niveau_alerte, trajet_aller_seul=trajet_aller_seul, itineraire_modele_id=itineraire_id,
                statut="planifie", enregistre_par=request.user,
            )

        for pid in passagers_ids:
            try:
                v = Voyage.objects.create(
                    personnel_id=pid, destination=destination, origine=origine,
                    date_depart=date_depart, date_retour_prevue=date_retour,
                    vehicule=vehicule, nb_places_total=nb_places,
                    vehicule_matricule=vehicule_matricule, vehicule_photo=vehicule_photo,
                    conducteur=conducteur, conducteur_secondaire=conducteur_secondaire, niveau_alerte=niveau_alerte,
                    conducteur_personnel=conducteur_personnel, conducteur_secondaire_personnel=conducteur_secondaire_personnel,
                    trajet_aller_seul=trajet_aller_seul,
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
        rotation_id  = request.data.get("rotation_id")
        voyage_id    = request.data.get("voyage_id")  # cible un voyage INDIVIDUEL (pas encore de rotation_id)
        personnel_id = request.data.get("personnel_id")
        # Montee/descente et date de retour PROPRES a ce passager - distinctes
        # du trajet du convoi lui-meme (signale : "tu donnes au passagers le
        # monte et descendre du convoi, c'est 2 choses differentes"). Vide/
        # absent = repli sur les valeurs du convoi (comportement d'avant,
        # toujours valide pour un passager qui fait le trajet complet).
        origine_passager      = (request.data.get("origine") or "").strip()
        destination_passager  = (request.data.get("destination") or "").strip()
        date_retour_passager  = request.data.get("date_retour_prevue") or None
        if not (rotation_id or voyage_id) or not personnel_id:
            return Response({"error":"rotation_id (ou voyage_id) et personnel_id requis"},status=400)
        # Un non-admin ne peut s'inscrire QUE lui-meme (self-service) -
        # jamais ajouter quelqu'un d'autre a un convoi, qui reste reserve a
        # l'admin. Avant ce correctif, le bouton "Rejoindre" affiche a
        # l'agent sur SA PROPRE page Voyages.jsx echouait systematiquement
        # (403), rendant la fonctionnalite inutilisable pour son public cible.
        if not is_admin:
            from residences.models import Personnel
            pers = Personnel.objects.filter(id=personnel_id, user=u).first()
            if not pers:
                return Response({"error":"Vous ne pouvez rejoindre un convoi que pour vous-même."}, status=403)
        # Verrouillage transactionnel: sans ca, deux admins ajoutant un
        # passager AU MEME MOMENT sur le dernier siege libre pouvaient tous
        # les deux passer le controle "prises >= nb_places" (tous deux lus
        # AVANT que l'un ou l'autre n'ait cree son Voyage) et surbooker
        # reellement le vehicule - un risque physique, pas juste une
        # incoherence de donnees. select_for_update() serialise les
        # requetes concurrentes sur la MEME rotation : la seconde attend
        # que la premiere transaction commite avant de relire le compte.
        with transaction.atomic():
            if voyage_id:
                # Rejoindre un voyage INDIVIDUEL : il n'a pas encore de
                # rotation_id (par definition) - on lui en attribue un a la
                # premiere personne qui le rejoint, le convertissant de
                # facto en petit convoi partage. Un autre passager DOIT
                # pouvoir se joindre a un individuel (demande explicite) -
                # bien different d'un verrou qui l'interdirait.
                cible = Voyage.objects.select_for_update().filter(id=voyage_id).exclude(statut="annule").first()
                if not cible:
                    return Response({"error":"Voyage introuvable"}, status=404)
                if not cible.rotation_id:
                    cible.rotation_id = str(uuid.uuid4())[:8].upper()
                    cible.type_voyage = "rotation"
                    cible.save(update_fields=["rotation_id","type_voyage"])
                rotation_id = cible.rotation_id
            existing = Voyage.objects.select_for_update().filter(rotation_id=rotation_id).exclude(statut="annule").first()
            rotation_obj = Rotation.objects.filter(rotation_id=rotation_id).first()
            if not existing and not rotation_obj:
                return Response({"error":"Rotation introuvable"},status=404)
            # Attributs partages de la rotation : le modele Rotation est la
            # source de verite (existe meme sans aucun passager - bug
            # corrige) ; a defaut (anciennes rotations anterieures a ce
            # modele, deja migrees en principe, ou incoherence), repli sur
            # le voyage existant comme avant.
            ref_statut = existing.statut if existing else "planifie"
            ref_nb_places = (rotation_obj.nb_places_total if rotation_obj else None) or (existing.nb_places_total if existing else 15)
            ref_date_depart = (rotation_obj.date_depart if rotation_obj else None) or (existing.date_depart if existing else None)
            ref_date_retour = (rotation_obj.date_retour_prevue if rotation_obj else None) or (existing.date_retour_prevue if existing else None)
            ref_conducteur = (rotation_obj.conducteur if rotation_obj else "") or (existing.conducteur if existing else "")
            ref_conducteur_secondaire = (rotation_obj.conducteur_secondaire if rotation_obj else "") or (existing.conducteur_secondaire if existing else "")
            ref_vehicule = (rotation_obj.vehicule if rotation_obj else "") or (existing.vehicule if existing else "")
            ref_vehicule_matricule = (rotation_obj.vehicule_matricule if rotation_obj else "") or (existing.vehicule_matricule if existing else "")
            ref_destination = (rotation_obj.destination if rotation_obj else "") or (existing.destination if existing else "")
            ref_origine = (rotation_obj.origine if rotation_obj else "") or (existing.origine if existing else "")
            ref_conducteur_personnel_id = (rotation_obj.conducteur_personnel_id if rotation_obj else None) or (existing.conducteur_personnel_id if existing else None)
            ref_conducteur_secondaire_personnel_id = (rotation_obj.conducteur_secondaire_personnel_id if rotation_obj else None) or (existing.conducteur_secondaire_personnel_id if existing else None)
            ref_niveau_alerte = (rotation_obj.niveau_alerte if rotation_obj else None) or (existing.niveau_alerte if existing else 1)
            ref_trajet_aller_seul = rotation_obj.trajet_aller_seul if rotation_obj else (existing.trajet_aller_seul if existing else False)

            if ref_statut not in ("planifie", "en_voyage"):
                # "en_voyage" reste rejoignable : c'est exactement le cas
                # d'une montee en cours de route (point intermediaire) -
                # bloquer ici aurait annule l'un des buts explicites de la
                # fonctionnalite montee/descente. Seul un retour deja
                # entame ou un convoi annule reste bloque : rejoindre un
                # vehicule qui rentre deja au camp n'a pas de sens.
                libelle = {"retour":"déjà terminé (retour effectué)"}.get(ref_statut, ref_statut)
                return Response({"error": f"Ce convoi est {libelle} — impossible d'y ajouter quelqu'un."}, status=400)
            prises = Voyage.objects.filter(rotation_id=rotation_id).exclude(statut="annule").count()
            if prises >= ref_nb_places:
                return Response({"error":"Rotation complète"},status=400)
            # Meme delai de 48h que la creation directe - mais UNIQUEMENT si
            # le convoi n'est pas deja parti ("en_voyage" = montee en cours
            # de route, par definition a court terme, exemptee).
            if not is_admin and ref_statut == "planifie":
                from django.utils import timezone
                from datetime import timedelta
                limite = timezone.localdate() + timedelta(days=2)
                if ref_date_depart and ref_date_depart < limite:
                    return Response({"error": "Les demandes pour rejoindre un convoi doivent être envoyées au moins 48h avant son départ. Pour un départ plus proche, contactez l'administrateur directement."}, status=400)
            if Voyage.objects.filter(rotation_id=rotation_id,personnel_id=personnel_id).exists():
                return Response({"error":"Déjà inscrit sur cette rotation"},status=400)
            # Le chauffeur (principal ou second) de CE convoi ne peut pas
            # non plus s'y inscrire comme passager - meme regle qu'a la
            # creation, jamais verifiee ici jusqu'a present.
            from residences.models import Personnel
            pers_cible = Personnel.objects.filter(pk=personnel_id).first()
            if pers_cible:
                if ref_conducteur_personnel_id and ref_conducteur_personnel_id == pers_cible.id:
                    return Response({"error": f"{pers_cible.nom} {pers_cible.prenom} est déjà désigné conducteur de ce convoi — ne peut pas aussi être passager."}, status=400)
                if ref_conducteur_secondaire_personnel_id and ref_conducteur_secondaire_personnel_id == pers_cible.id:
                    return Response({"error": f"{pers_cible.nom} {pers_cible.prenom} est déjà désigné second chauffeur de ce convoi — ne peut pas aussi être passager."}, status=400)
                nom_complet = f"{pers_cible.nom} {pers_cible.prenom}".strip().lower()
                if not ref_conducteur_personnel_id and ref_conducteur and ref_conducteur.strip().lower() == nom_complet:
                    return Response({"error": f"{pers_cible.nom} {pers_cible.prenom} est déjà désigné conducteur de ce convoi — ne peut pas aussi être passager."}, status=400)
                if not ref_conducteur_secondaire_personnel_id and ref_conducteur_secondaire and ref_conducteur_secondaire.strip().lower() == nom_complet:
                    return Response({"error": f"{pers_cible.nom} {pers_cible.prenom} est déjà désigné second chauffeur de ce convoi — ne peut pas aussi être passager."}, status=400)
            # Valeurs EFFECTIVES pour ce passager : sa propre montee/descente/
            # date de retour si fournies, sinon repli sur celles du convoi.
            date_retour_effectif = date_retour_passager or ref_date_retour
            origine_effective     = origine_passager or ref_origine
            destination_effective = destination_passager or ref_destination
            if ref_date_depart and date_retour_effectif and str(date_retour_effectif) < str(ref_date_depart):
                return Response({"error": "La date de retour ne peut pas être avant la date de départ du convoi"}, status=400)
            # Vérifier aussi si la personne est sur un autre voyage actif sur la même période
            # (avec SA date de retour reelle - c'est elle qui determine s'il
            # faut lui garder sa chambre, pas la date du convoi/vehicule).
            conflict = _check_voyage_conflit(
                personnel_id, ref_date_depart, date_retour_effectif
            )
            if conflict and conflict.rotation_id != rotation_id:
                return Response({"error": f"Cette personne est déjà sur un autre voyage actif du {conflict.date_depart} au {conflict.date_retour_prevue}"}, status=400)
            v = Voyage.objects.create(
                personnel_id=personnel_id, destination=destination_effective, origine=origine_effective,
                date_depart=ref_date_depart, date_retour_prevue=date_retour_effectif,
                vehicule=ref_vehicule, nb_places_total=ref_nb_places,
                vehicule_matricule=ref_vehicule_matricule, vehicule_photo=(rotation_obj.vehicule_photo if rotation_obj else (existing.vehicule_photo if existing else "")),
                conducteur=ref_conducteur, conducteur_secondaire=ref_conducteur_secondaire,
                conducteur_personnel_id=ref_conducteur_personnel_id, conducteur_secondaire_personnel_id=ref_conducteur_secondaire_personnel_id,
                niveau_alerte=ref_niveau_alerte, trajet_aller_seul=ref_trajet_aller_seul,
                heure_depart=(rotation_obj.heure_depart if rotation_obj else (existing.heure_depart if existing else None)),
                point_rdv=(rotation_obj.point_rdv if rotation_obj else (existing.point_rdv if existing else "")),
                motif=(rotation_obj.motif if rotation_obj else (existing.motif if existing else "")),
                type_voyage="rotation",
                rotation_id=rotation_id, statut="planifie",
                enregistre_par=request.user,
            )
            # Le convoi memorise l'itineraire type choisi a sa creation, meme
            # cree sans aucun passager (Rotation.itineraire_modele) - on
            # l'applique ici au voyage de CE passager qui rejoint, pour que
            # le tableau JMP "Cote de securite de route" ne reste pas vide
            # tant que personne n'a rejoint (bug signale : les villes
            # intermediaires saisies a la creation d'un convoi vide n'etaient
            # jamais persistees, faute de voyage auquel les rattacher).
            if rotation_obj and rotation_obj.itineraire_modele_id:
                _appliquer_itineraire_a_voyage(v, rotation_obj.itineraire_modele)
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
        date_str = request.data.get("date_depart_reelle")
        date_reelle = datetime.date.fromisoformat(date_str) if date_str else None
        count = 0
        echecs = []
        for v in Voyage.objects.select_related("personnel").filter(rotation_id=rotation_id,statut="planifie"):
            try:
                v.partir(date_reelle); count+=1
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
        alertes_chambre = []
        for v in Voyage.objects.select_related("personnel").filter(rotation_id=rotation_id,statut="en_voyage"):
            try:
                info = v.revenir(date); count+=1
                if info.get("chambre_occupee_par"):
                    alertes_chambre.append(f"{v.personnel.nom} {v.personnel.prenom} : sa chambre ({info['residence']}) est occupée par {info['chambre_occupee_par']}.")
            except Exception as e:
                nom = f"{v.personnel.nom} {v.personnel.prenom}" if v.personnel else f"#{v.id}"
                echecs.append(f"{nom}: {e}")
        return Response({"ok":True,"rentres":count,"echecs":echecs,"alertes_chambre":alertes_chambre})

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
            "date_depart_effective":str(v.date_depart_effective) if v.date_depart_effective else None,
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

    def update(self, request, *args, **kwargs):
        # Meme correctif que VoyageViewSet.update() ci-dessus : PUT n'etait
        # jamais garde. On ne passe pas par self.partial_update() (son
        # super() rappellerait self.update() -> boucle infinie).
        if not self._is_admin(request.user):
            return Response({"error":"Admin requis pour gérer l'itinéraire d'un voyage"}, status=403)
        kwargs["partial"] = True
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
    en PDF via le navigateur (Ctrl+P -> Enregistrer en PDF).

    Enrichi (refonte Centre de Mobilite) avec une carte distinguant
    l'itineraire de la ROTATION (EtapeVoyage, deja existant) de
    l'itineraire REEL du PASSAGER (EvenementMonteeDescente, evenements
    horodates reellement survenus - jamais saisi manuellement). Coordonnees
    reprises telles quelles de frontend/src/data/coordsDestinations.js
    (source de verite partagee avec CarteItineraire.jsx) - dupliquees ici
    car cette page HTML est generee cote serveur, sans acces au bundle JS
    du frontend.
    """
    from .models import EvenementMonteeDescente
    import json as _json

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

    # Trajet PLANIFIE du passager (sa propre montee -> descente, voyage.origine/
    # voyage.destination) - affiche ICI de facon bien visible, car des
    # utilisateurs confondaient ce champ, deja rempli a la reservation, avec
    # la section "montee/descente reelles" ci-dessous (qui, elle, ne se
    # remplit QUE quand un admin clique explicitement "Enregistrer
    # montée"/"Enregistrer descente" dans le detail du voyage - AUCUN
    # scanner materiel n'existe dans l'app, "scan" etait un mot trompeur
    # employe ici a tort la fois precedente - et reste donc a juste titre
    # vide tant que personne n'a clique ces boutons).
    trajet_passager_html = f"""
      <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:14px 16px;margin:16px 0">
        <div style="font-size:11px;color:#1d4ed8;font-weight:700;text-transform:uppercase;letter-spacing:.5px">🧍 Trajet de ce passager (prévu à la réservation)</div>
        <div style="font-size:15px;font-weight:700;color:#0F2A5C;margin-top:4px">{voyage.origine or '—'} → {voyage.destination or '—'}</div>
      </div>
    """

    # Montee/descente REELLES du passager (section 21-22 du document de
    # refonte) - construit UNIQUEMENT a partir des evenements enregistres
    # MANUELLEMENT par un admin via les boutons "Enregistrer montée" /
    # "Enregistrer descente" du detail du voyage (PAS un scan materiel -
    # aucun lecteur QR/badge n'existe dans cette app), jamais saisi
    # automatiquement a la reservation - distinct du trajet PREVU ci-dessus.
    # Reste normalement vide tant que personne n'a clique ces boutons.
    segments = EvenementMonteeDescente.itineraire_reel(voyage)
    evenements = list(voyage.evenements_montee_descente.order_by("date_heure"))
    if evenements:
        evenements_html = "".join([f"""
            <tr>
              <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0">{'🟢 Montée' if e.type_evenement=='montee' else '🔴 Descente'}</td>
              <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;font-weight:700">{e.lieu}</td>
              <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0">{e.date_heure.strftime('%d/%m/%Y à %H:%M')}</td>
            </tr>
        """ for e in evenements])
        itineraire_reel_html = f"""
          <h2 style="color:#0F2A5C;font-size:16px">🟢 Montée / descente réelles</h2>
          <p style="color:#64748b;font-size:12px;margin-top:-8px">Horodatage des montées/descentes enregistrées manuellement (bouton "Enregistrer montée/descente") — distinct du trajet prévu ci-dessus, qui lui est renseigné à la réservation.</p>
          <table style="margin-bottom:16px">
            <thead><tr><th>Événement</th><th>Lieu</th><th>Date / Heure</th></tr></thead>
            <tbody>{evenements_html}</tbody>
          </table>
        """
    else:
        itineraire_reel_html = """
          <h2 style="color:#0F2A5C;font-size:16px">🟢 Montée / descente réelles</h2>
          <p style="color:#94a3b8;font-size:12px">Aucune montée/descente encore enregistrée pour ce voyage (bouton "Enregistrer montée/descente" dans le détail du voyage) — le trajet prévu du passager reste visible ci-dessus.</p>
        """

    # Points pour la carte : itineraire de la ROTATION (origine/etapes/destination
    # du voyage - le trajet PREVU DU CONVOI) vs itineraire PROPRE DU PASSAGER
    # (sa montee -> sa descente, voyage.origine/voyage.destination - peut
    # differer du trajet complet du convoi) vs points REELS (evenements
    # montee/descente).
    points_prevus = [voyage.origine or "Camp Roxgold Sango"] + [e.destination for e in etapes] if etapes else [voyage.origine or "Camp Roxgold Sango", voyage.destination or ""]
    points_passager = [voyage.origine, voyage.destination] if voyage.origine and voyage.destination else []
    points_reels = [e.lieu for e in evenements]
    carte_html = f"""
      <h2 style="color:#0F2A5C;font-size:16px">🗺️ Carte — itinéraire du passager, du convoi et réel</h2>
      <div id="billet-map" style="height:320px;border-radius:10px;margin-bottom:24px;background:#f1f5f9"></div>
      <script src="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.js"></script>
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.css"/>
      <script>
       window.addEventListener('load', function() {{
        try {{
        if (typeof L === 'undefined') throw new Error('Bibliothèque de carte indisponible');
        const COORDS = {_json.dumps({
            'camp roxgold sango':[8.05,-6.75],'sango mine site':[8.05,-6.75],'camp de base':[8.05,-6.75],
            "site d'exploration":[8.05,-6.75],'autre site minier':[8.05,-6.75],'mine agbaou':[5.85,-5.35],
            'mine yaouré':[6.85,-5.35],'abidjan':[5.3600,-4.0083],'yamoussoukro':[6.8276,-5.2893],
            'bouaké':[7.6906,-5.0300],'san pedro':[4.7485,-6.6363],'korhogo':[9.4580,-5.6297],'man':[7.4125,-7.5539],
            'daloa':[6.8770,-6.4502],'gagnoa':[6.1319,-5.9506],'séguéla':[7.9611,-6.6731],'mankono':[8.0583,-6.1889],
            'ferkessédougou':[9.5975,-5.1978],'bouna':[9.2667,-3.0000],'touba':[8.2833,-7.6833],'divo':[5.8372,-5.3572],
            'odienné':[9.5090,-7.5654],'bondoukou':[8.0402,-2.8000],'abengourou':[6.7297,-3.4964],
        })};
        function normaliser(s) {{ return s.trim().toLowerCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g, ''); }}
        const COORDS_N = Object.fromEntries(Object.entries(COORDS).map(([k,v]) => [normaliser(k), v]));
        function chercherCoords(nom) {{
          if (!nom) return null;
          const k = normaliser(nom);
          if (COORDS_N[k]) return COORDS_N[k];
          for (const [key, c] of Object.entries(COORDS_N)) {{ if (k.includes(key) || key.includes(k)) return c; }}
          return null;
        }}
        async function routeRoutiere(a, b) {{
          try {{
            const url = `https://router.project-osrm.org/route/v1/driving/${{a[1]}},${{a[0]}};${{b[1]}},${{b[0]}}?overview=full&geometries=geojson`;
            const ctrl = new AbortController(); setTimeout(()=>ctrl.abort(), 6000);
            const r = await fetch(url, {{signal: ctrl.signal}});
            const d = await r.json();
            if (d.routes && d.routes[0] && d.routes[0].geometry && d.routes[0].geometry.coordinates.length > 1) {{
              return d.routes[0].geometry.coordinates.map(c => [c[1], c[0]]);
            }}
          }} catch (e) {{ /* repli ligne droite */ }}
          return null;
        }}
        async function tracerRoute(map, points, options, popup) {{
          if (points.length < 2) return;
          const segments = [];
          for (let i = 0; i < points.length - 1; i++) {{
            const seg = await routeRoutiere(points[i], points[i+1]);
            segments.push(...(seg || [points[i], points[i+1]]));
          }}
          L.polyline(segments, options).addTo(map).bindPopup(popup);
        }}
        const pointsPrevus = {_json.dumps(points_prevus)}.map(chercherCoords).filter(Boolean);
        const pointsPassager = {_json.dumps(points_passager)}.map(chercherCoords).filter(Boolean);
        const pointsReels = {_json.dumps(points_reels)}.map(chercherCoords).filter(Boolean);
        if (pointsPrevus.length >= 2 || pointsPassager.length >= 2 || pointsReels.length >= 2) {{
          const tous = [...pointsPrevus, ...pointsPassager, ...pointsReels];
          const lats = tous.map(p=>p[0]), lngs = tous.map(p=>p[1]);
          const centre = [(Math.min(...lats)+Math.max(...lats))/2, (Math.min(...lngs)+Math.max(...lngs))/2];
          const map = L.map('billet-map').setView(centre, 7);
          L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{{z}}/{{y}}/{{x}}', {{attribution:'Tiles &copy; Esri &mdash; Esri, HERE, Garmin, FAO, NOAA, USGS, &copy; OpenStreetMap contributors'}}).addTo(map);
          if (pointsPrevus.length >= 2) L.polyline(pointsPrevus, {{color:'#94a3b8', weight:3, dashArray:'6 6'}}).addTo(map).bindPopup('Itinéraire prévu (convoi)');
          if (pointsReels.length >= 2) L.polyline(pointsReels, {{color:'#16a34a', weight:4}}).addTo(map).bindPopup('Itinéraire réel (passager)');
          if (pointsPassager.length >= 2) {{
            L.circleMarker(pointsPassager[0], {{radius:7, color:'#fff', weight:2, fillColor:'#1d4ed8', fillOpacity:1}}).addTo(map).bindPopup('🟦 Montée : {voyage.origine or ""}');
            L.circleMarker(pointsPassager[pointsPassager.length-1], {{radius:7, color:'#fff', weight:2, fillColor:'#1d4ed8', fillOpacity:1}}).addTo(map).bindPopup('🟦 Descente : {voyage.destination or ""}');
            tracerRoute(map, pointsPassager, {{color:'#1d4ed8', weight:5}}, 'Trajet du passager (montée → descente)');
          }}
          map.fitBounds(L.latLngBounds(tous), {{padding:[20,20]}});
        }} else {{
          document.getElementById('billet-map').innerHTML = '<div style="padding:40px;text-align:center;color:#94a3b8">Coordonnées non disponibles pour tracer la carte.</div>';
        }}
        }} catch (err) {{
          document.getElementById('billet-map').innerHTML = '<div style="padding:40px;text-align:center;color:#94a3b8">🗺️ Carte indisponible (connexion réseau) — les informations d\\'itinéraire ci-dessus restent complètes.</div>';
        }}
       }});
      </script>
      <p style="font-size:11px;color:#64748b;margin-top:-16px">🟦 Trait bleu = trajet du passager (sa montée → sa descente) · Trait gris pointillé = trajet complet du convoi · Trait vert = trajet réellement constaté</p>
    """

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
          <p style="margin:4px 0 0;color:#64748b">Roxgold SiteLife — Roxgold Sango</p>
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
      {trajet_passager_html}
      <h2 style="color:#0F2A5C;font-size:16px">🗺️ Itinéraire complet du convoi (toutes étapes)</h2>
      <table>
        <thead><tr><th>Étape</th><th>Sens</th><th>Mode</th><th>Trajet</th><th>Date / Heure</th><th>Véhicule / Conducteur</th><th>Référence</th><th>Coût</th></tr></thead>
        <tbody>{etapes_html}</tbody>
      </table>
      {itineraire_reel_html}
      {carte_html}
      <p style="margin-top:32px;color:#94a3b8;font-size:11px">Document généré le {voyage.created_at.strftime('%d/%m/%Y')} — Roxgold SiteLife · Usage interne uniquement</p>
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


from .models import ItineraireModele, EtapeItineraireModele
from .serializers import ItineraireModeleSerializer, EtapeItineraireModeleSerializer

class ItineraireModeleViewSet(viewsets.ModelViewSet):
    """Itinéraires types (ex: "Camp → Abidjan") réutilisables à la création
    d'une rotation — lecture ouverte à tout connecté, écriture admin (même
    principe que VehiculeFlotteViewSet).
    Contrairement à VehiculeFlotteViewSet, le queryset ne filtre PAS sur
    actif=True : l'écran de gestion (Paramétrage) doit pouvoir lister,
    modifier et réactiver un itinéraire désactivé, pas seulement les
    itinéraires actifs. Le tri "actif seulement" se fait côté frontend, à
    l'endroit où l'itinéraire est proposé au choix (création de rotation)."""
    queryset = ItineraireModele.objects.all().prefetch_related("etapes")
    serializer_class = ItineraireModeleSerializer

    def get_permissions(self):
        if self.request.method == 'GET':
            return [IsAuthenticated()]
        u = self.request.user
        if not (u.is_authenticated and (u.is_staff or u.is_superuser or (hasattr(u,"profile") and getattr(u.profile,"role","")=="admin"))):
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Admin requis")
        return [IsAuthenticated()]


class EtapeItineraireModeleViewSet(viewsets.ModelViewSet):
    """Étapes (villes/horaires/distances) d'un itinéraire type — gérées
    depuis Paramétrage pour que l'ajout d'un futur itinéraire (ou la
    correction d'un existant) ne nécessite plus de migration de données
    (cf. 0031_bootstrap_itineraires_camp_abidjan.py, qui reste le seed
    initial mais n'est plus le seul moyen d'en ajouter). Même principe de
    permission que ItineraireModeleViewSet : lecture ouverte, écriture
    admin uniquement."""
    queryset = EtapeItineraireModele.objects.all().order_by("itineraire","ordre")
    serializer_class = EtapeItineraireModeleSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        itineraire_id = self.request.query_params.get("itineraire")
        if itineraire_id:
            qs = qs.filter(itineraire_id=itineraire_id)
        return qs

    def get_permissions(self):
        if self.request.method == 'GET':
            return [IsAuthenticated()]
        u = self.request.user
        if not (u.is_authenticated and (u.is_staff or u.is_superuser or (hasattr(u,"profile") and getattr(u.profile,"role","")=="admin"))):
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Admin requis")
        return [IsAuthenticated()]

