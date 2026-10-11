"""
Suivi en direct des convois (façon Yango) :

  Conducteur (téléphone)                 Centre de Mobilité (carte)
  ───────────────────────                ──────────────────────────
  POST {rid}/partir/      ─────────────▶ véhicule apparaît, statut "en route"
  POST {rid}/position/    (toutes ~15s)▶ le véhicule se déplace + trace
  POST {rid}/arret/       ─────────────▶ marqueur d'arrêt + notification admin
  POST {rid}/reprendre/   ─────────────▶ repart
  POST {rid}/arriver/     ─────────────▶ statut "arrivé" + notification

Toutes les routes sont indexées par rotation_id (clé historique déjà utilisée
partout dans le Centre de Mobilité), pas par l'id numérique de Rotation.
"""
import datetime
import os

from django.db import transaction, IntegrityError
from django.db.models import Q
from django.utils import timezone
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from django.http import HttpResponse

from . import suivi_rapports
from .models import Rotation, Voyage, SuiviConvoi, PositionConvoi, ArretConvoi, DeposeArret

# Intervalle minimal entre deux points enregistrés dans la trace (la position
# "courante" est, elle, toujours mise à jour).
INTERVALLE_TRACE_S = 10
MAX_POINTS_TRACE = 600
# Fréquence d'envoi demandée au téléphone (configurable) et seuil au-delà duquel la position est dite ancienne.
INTERVALLE_ENVOI_S = int(os.environ.get("SUIVI_INTERVALLE_S", "15"))
POSITION_ANCIENNE_S = int(os.environ.get("SUIVI_POSITION_ANCIENNE_S", "120"))
MAX_POINTS_PAR_ENVOI = 200


def _est_admin(u):
    return bool(u.is_staff or u.is_superuser or (hasattr(u, "profile") and getattr(u.profile, "role", "") == "admin"))


def _noms_utilisateur(u):
    """« nom prénom » / « prénom nom » (minuscules) des fiches Personnel de l'utilisateur."""
    from residences.models import Personnel
    noms = set()
    for p in Personnel.objects.filter(user=u):
        noms.add(f"{p.nom} {p.prenom}".strip().lower())
        noms.add(f"{p.prenom} {p.nom}".strip().lower())
    return noms


def _est_conducteur(u, rotation):
    if any(p is not None and p.user_id == u.id
           for p in (rotation.conducteur_personnel, rotation.conducteur_secondaire_personnel)):
        return True
    # Chauffeur choisi par son nom (texte) sans lien vers sa fiche : on le reconnaît par son nom.
    noms = _noms_utilisateur(u)
    return any((n or "").strip().lower() in noms for n in (rotation.conducteur, rotation.conducteur_secondaire) if n)


def _nom(p):
    return f"{p.prenom} {p.nom}".strip() if p else "—"


def _float(v):
    try:
        return float(v) if v not in (None, "") else None
    except (TypeError, ValueError):
        return None


def _coord_valide(lat, lng):
    return lat is not None and lng is not None and -90 <= lat <= 90 and -180 <= lng <= 180 and not (lat == 0 and lng == 0)


def _horodatage_serveur(brut, now, depart_at):
    """Heure d'un point reçu : celle du téléphone SEULEMENT si plausible (entre le départ et maintenant) ;
    jamais dans le futur. Renvoie None si le point est antérieur au départ du convoi."""
    from django.utils.dateparse import parse_datetime
    t = parse_datetime(str(brut)) if brut else None
    if t is None:
        return now
    if timezone.is_naive(t):
        t = timezone.make_aware(t, datetime.timezone.utc)
    if t > now:
        return now
    if t < depart_at:
        return None
    return t


def _notifier_admins(titre, message, type_notif="info"):
    """Même mécanisme que DemandeAdmin.notifier_admin (cloche du header)."""
    try:
        from django.contrib.auth.models import User
        from accounts.models import Profile
        from evenements.models import SimpleNotification
        admins = set(User.objects.filter(is_staff=True, is_active=True))
        admins.update(p.user for p in Profile.objects.filter(role="admin").select_related("user") if p.user)
        SimpleNotification.objects.bulk_create([
            SimpleNotification(user=a, titre=titre[:200], message=message, type_notif=type_notif)
            for a in admins
        ])
    except Exception:
        pass  # une notification ratée ne doit jamais bloquer le conducteur


def _passagers(rotation):
    return Voyage.objects.select_related("personnel").filter(
        rotation_id=rotation.rotation_id
    ).exclude(statut="annule")


def _serialiser(rotation, avec_trace=False):
    suivi = getattr(rotation, "suivi", None)
    data = {
        "rotation_id": rotation.rotation_id,
        "vehicule": rotation.vehicule,
        "vehicule_matricule": rotation.vehicule_matricule,
        "conducteur": rotation.conducteur or _nom(rotation.conducteur_personnel),
        "origine": rotation.origine,
        "destination": rotation.destination,
        "date_depart": str(rotation.date_depart),
        "heure_depart": rotation.heure_depart.strftime("%H:%M") if rotation.heure_depart else None,
        "point_rdv": rotation.point_rdv,
        "nb_places_total": rotation.nb_places_total,
        "nb_passagers_prevus": _passagers(rotation).filter(statut__in=["planifie", "en_voyage"]).count(),
        "intervalle_envoi_s": INTERVALLE_ENVOI_S,
        "suivi": None,
    }
    if not suivi:
        return data
    arrets = list(suivi.arrets.prefetch_related("deposes__voyage__personnel"))
    arret_en_cours = next((a for a in reversed(arrets) if a.fin is None), None)
    deposes_ids = set(DeposeArret.objects.filter(arret__suivi=suivi).values_list("voyage_id", flat=True))
    data["suivi"] = {
        "statut": suivi.statut,
        "depart_at": suivi.depart_at,
        "arrivee_at": suivi.arrivee_at,
        "latitude": suivi.latitude,
        "longitude": suivi.longitude,
        "vitesse_kmh": suivi.vitesse_kmh,
        "cap": suivi.cap,
        "position_at": suivi.position_at,
        "precision_m": suivi.precision_m,
        # Calculé côté serveur : le front ne présente JAMAIS une vieille position comme actuelle.
        "position_age_s": int((timezone.now() - suivi.position_at).total_seconds()) if suivi.position_at else None,
        "position_ancienne": bool(suivi.statut != "arrive" and (not suivi.position_at or (timezone.now() - suivi.position_at).total_seconds() > POSITION_ANCIENNE_S)),
        "duree_s": suivi.duree_s, "distance_km": suivi.distance_km,
        "nb_passagers_depart": suivi.nb_passagers_depart,
        "nb_a_bord": max(0, suivi.nb_passagers_depart - len(deposes_ids)),
        "arret_en_cours": arret_en_cours.id if arret_en_cours else None,
        "arrets": [{
            "id": a.id, "type": a.type_arret, "type_label": a.get_type_arret_display(),
            "lieu": a.lieu, "note": a.note, "latitude": a.latitude, "longitude": a.longitude,
            "debut": a.debut, "fin": a.fin, "nb_a_bord": a.nb_a_bord,
            "deposes": [_nom(d.voyage.personnel) for d in a.deposes.all()],
        } for a in arrets],
        "a_bord": [
            {"voyage_id": v.id, "nom": _nom(v.personnel), "destination": v.destination}
            for v in _passagers(rotation).filter(statut="en_voyage") if v.id not in deposes_ids
        ],
    }
    if avec_trace:
        pts = list(suivi.positions.order_by("-date_heure").values_list("latitude", "longitude")[:MAX_POINTS_TRACE])
        data["suivi"]["trace"] = [list(p) for p in reversed(pts)]
    return data


class SuiviConvoiViewSet(viewsets.ViewSet):
    lookup_field = "rotation_id"
    lookup_value_regex = "[^/]+"

    def _rotation(self, request, rotation_id, ecriture=True):
        rotation = Rotation.objects.select_related(
            "conducteur_personnel", "conducteur_secondaire_personnel"
        ).filter(rotation_id=rotation_id).first()
        if not rotation:
            return None, Response({"error": "Rotation introuvable"}, status=404)
        if not (_est_admin(request.user) or _est_conducteur(request.user, rotation)):
            return None, Response({"error": "Réservé au conducteur de ce convoi ou à l'admin"}, status=403)
        if ecriture and request.method == "POST" and not hasattr(rotation, "suivi") and self.action != "partir":
            return None, Response({"error": "Le convoi n'est pas encore parti"}, status=400)
        return rotation, None

    # ── Lecture ──────────────────────────────────────────────────
    @action(detail=False, methods=["get"])
    def mes_convois(self, request):
        """Convois dont l'utilisateur est conducteur, d'hier à J+7, pas encore arrivés."""
        today = timezone.localdate()
        filtre = Q(conducteur_personnel__user=request.user) | Q(conducteur_secondaire_personnel__user=request.user)
        for n in _noms_utilisateur(request.user):
            filtre |= Q(conducteur__iexact=n) | Q(conducteur_secondaire__iexact=n)
        qs = Rotation.objects.select_related("suivi", "conducteur_personnel").filter(
            filtre,
            date_depart__range=(today - datetime.timedelta(days=1), today + datetime.timedelta(days=7)),
        ).exclude(statut="annule").exclude(suivi__statut="arrive").order_by("date_depart", "heure_depart")
        return Response([_serialiser(r) for r in qs])

    @action(detail=False, methods=["get"])
    def actifs(self, request):
        """Convois en route / à l'arrêt (+ arrivés depuis moins de 2h) — carte du Centre de Mobilité."""
        if not _est_admin(request.user):
            return Response({"error": "Admin requis"}, status=403)
        recent = timezone.now() - datetime.timedelta(hours=2)
        qs = Rotation.objects.select_related("suivi", "conducteur_personnel").filter(
            Q(suivi__statut__in=["en_route", "arret"]) | Q(suivi__arrivee_at__gte=recent)
        )
        return Response([_serialiser(r, avec_trace=True) for r in qs])

    def retrieve(self, request, rotation_id=None):
        rotation, err = self._rotation(request, rotation_id, ecriture=False)
        if err:
            return err
        return Response(_serialiser(rotation, avec_trace=True))

    # ── Actions conducteur ──────────────────────────────────────
    @action(detail=True, methods=["post"])
    def partir(self, request, rotation_id=None):
        rotation, err = self._rotation(request, rotation_id)
        if err:
            return err
        if hasattr(rotation, "suivi"):
            return Response({"error": "Ce convoi est déjà parti"}, status=400)
        if rotation.statut == "annule":
            return Response({"error": "Ce convoi est annulé."}, status=400)
        # Pas de départ « à l'aveugle » : une position GPS réelle et valide est obligatoire.
        lat0, lng0 = _float(request.data.get("latitude")), _float(request.data.get("longitude"))
        if not _coord_valide(lat0, lng0):
            return Response({"error": "Position GPS valide requise : autorisez la localisation et attendez la position avant de partir.",
                             "code": "gps_requis"}, status=400)
        if SuiviConvoi.objects.filter(demarre_par=request.user, statut__in=["en_route", "arret"]).exists():
            return Response({"error": "Vous avez déjà un trajet en cours : terminez-le avant d'en démarrer un autre.", "code": "trajet_en_cours"}, status=400)
        en_attente = [_nom(v.personnel) for v in _passagers(rotation).filter(statut="planifie", statut_validation="en_attente")]
        if en_attente:
            return Response({"error": "Départ impossible : demande(s) sans décision (validez ou refusez) — " + ", ".join(en_attente),
                             "en_attente": en_attente}, status=400)
        now = timezone.now()
        echecs = []
        with transaction.atomic():
            # Même effet que "Départ" côté Centre de Mobilité (partir_rotation) :
            # les passagers encore "planifiés" passent "en voyage".
            for v in _passagers(rotation).filter(statut="planifie").exclude(statut_validation="refuse"):
                try:
                    v.partir(None)
                except Exception as e:
                    echecs.append(f"{_nom(v.personnel)}: {e}")
            nb = _passagers(rotation).filter(statut="en_voyage").count()
            try:
                suivi_cree = SuiviConvoi.objects.create(
                    rotation=rotation, statut="en_route", depart_at=now, demarre_par=request.user,
                    nb_passagers_depart=nb, latitude=lat0, longitude=lng0, position_at=now,
                    depart_latitude=lat0, depart_longitude=lng0, precision_m=_float(request.data.get("precision")),
                )
            except IntegrityError:   # double clic / deux appareils : un seul voyage actif par mission
                return Response({"error": "Ce convoi est déjà parti"}, status=400)
            PositionConvoi.objects.create(suivi=suivi_cree, latitude=lat0, longitude=lng0, date_heure=now,
                                          precision_m=_float(request.data.get("precision")), client_id="depart")
        _notifier_admins(
            f"🚐 Départ convoi {rotation.vehicule_matricule or rotation.vehicule or rotation.rotation_id}",
            f"{rotation.conducteur or 'Le conducteur'} est parti à {timezone.localtime(now):%H:%M} "
            f"avec {nb} passager(s) — {rotation.origine or 'Camp'} → {rotation.destination or '?'}",
        )
        return Response({**_serialiser(rotation), "echecs": echecs}, status=201)

    @action(detail=True, methods=["post"])
    def position(self, request, rotation_id=None):
        """Une position (latitude, longitude, precision, vitesse_kmh, cap, client_id, horodatage) ou un lot
        `points: [...]` renvoyé après une perte de réseau. `client_id` rend le renvoi idempotent (pas de doublon)."""
        rotation, err = self._rotation(request, rotation_id)
        if err:
            return err
        suivi = rotation.suivi
        if suivi.statut == "arrive":
            return Response({"ok": True, "ignore": "convoi arrivé"})
        brut = request.data.get("points")
        if brut is None:
            brut = [request.data]
        if not isinstance(brut, list) or not brut:
            return Response({"error": "points invalides"}, status=400)
        if len(brut) > MAX_POINTS_PAR_ENVOI:
            return Response({"error": f"Trop de points ({MAX_POINTS_PAR_ENVOI} maximum par envoi)"}, status=400)
        now = timezone.now()
        enregistres = doublons = rejetes = 0
        dernier_ok = None
        for pt in brut:
            if not isinstance(pt, dict):
                rejetes += 1
                continue
            lat, lng = _float(pt.get("latitude")), _float(pt.get("longitude"))
            if not _coord_valide(lat, lng):
                rejetes += 1
                continue
            t = _horodatage_serveur(pt.get("horodatage"), now, suivi.depart_at)
            if t is None:
                rejetes += 1
                continue
            cid = str(pt.get("client_id") or "")[:40]
            vitesse, precision = _float(pt.get("vitesse_kmh")), _float(pt.get("precision"))
            if cid:
                if suivi.positions.filter(client_id=cid).exists():
                    doublons += 1
                    continue
            else:
                dernier = suivi.positions.order_by("-date_heure").values_list("date_heure", flat=True).first()
                if dernier and (t - dernier).total_seconds() < INTERVALLE_TRACE_S:
                    doublons += 1
                    continue
            try:
                with transaction.atomic():
                    PositionConvoi.objects.create(suivi=suivi, latitude=lat, longitude=lng, vitesse_kmh=vitesse,
                                                  precision_m=precision, date_heure=t, client_id=cid)
            except IntegrityError:
                doublons += 1
                continue
            enregistres += 1
            if dernier_ok is None or t >= dernier_ok[0]:
                dernier_ok = (t, lat, lng, vitesse, precision, _float(pt.get("cap")))
        # La position « courante » ne recule jamais : un point ancien renvoyé en différé ne l'écrase pas.
        if dernier_ok and (suivi.position_at is None or dernier_ok[0] >= suivi.position_at):
            t, lat, lng, vitesse, precision, cap = dernier_ok
            suivi.latitude, suivi.longitude, suivi.position_at = lat, lng, t
            suivi.vitesse_kmh, suivi.precision_m, suivi.cap = vitesse, precision, cap
            suivi.save(update_fields=["latitude", "longitude", "position_at", "vitesse_kmh", "precision_m", "cap"])
        if enregistres == 0 and doublons == 0 and rejetes:
            return Response({"error": "latitude/longitude invalides", "rejetes": rejetes}, status=400)
        return Response({"ok": True, "enregistres": enregistres, "doublons": doublons, "rejetes": rejetes})

    @action(detail=True, methods=["post"])
    def arret(self, request, rotation_id=None):
        """Signale un arrêt. `deposes` = liste de voyage_id des passagers qui descendent ici."""
        rotation, err = self._rotation(request, rotation_id)
        if err:
            return err
        suivi = rotation.suivi
        if suivi.statut == "arrive":
            return Response({"error": "Convoi déjà arrivé"}, status=400)
        type_arret = request.data.get("type") or "pause"
        if type_arret not in dict(ArretConvoi.TYPE_CHOIX):
            return Response({"error": "Type d'arrêt inconnu"}, status=400)
        now = timezone.now()
        lat, lng = _float(request.data.get("latitude")), _float(request.data.get("longitude"))
        lieu = (request.data.get("lieu") or "").strip()[:150]
        ids = [int(i) for i in (request.data.get("deposes") or []) if str(i).isdigit()]
        with transaction.atomic():
            suivi.arrets.filter(fin__isnull=True).update(fin=now)
            a = ArretConvoi.objects.create(
                suivi=suivi, type_arret=type_arret, lieu=lieu,
                note=(request.data.get("note") or "")[:300],
                latitude=lat if lat is not None else suivi.latitude,
                longitude=lng if lng is not None else suivi.longitude,
                debut=now,
            )
            from .models import EvenementMonteeDescente
            for v in _passagers(rotation).filter(id__in=ids, statut="en_voyage"):
                DeposeArret.objects.get_or_create(arret=a, voyage=v)
                # Alimente aussi le journal montée/descente existant (billet / itinéraire réel)
                EvenementMonteeDescente.objects.create(
                    voyage=v, type_evenement="descente", lieu=lieu or "En route", date_heure=now,
                    latitude=a.latitude, longitude=a.longitude, enregistre_par=request.user,
                )
            a.nb_a_bord = suivi.nb_a_bord()
            a.save(update_fields=["nb_a_bord"])
            suivi.statut = "arret"
            if lat is not None and lng is not None:
                suivi.latitude, suivi.longitude, suivi.position_at = lat, lng, now
            suivi.save(update_fields=["statut", "latitude", "longitude", "position_at"])
        nb_deposes = a.deposes.count()
        _notifier_admins(
            f"{a.get_type_arret_display()} — convoi {rotation.vehicule_matricule or rotation.rotation_id}",
            f"{lieu or 'Lieu non précisé'} à {timezone.localtime(now):%H:%M}"
            + (f" · {nb_deposes} passager(s) déposé(s)" if nb_deposes else "")
            + f" · {a.nb_a_bord} à bord" + (f" · {a.note}" if a.note else ""),
            type_notif="alerte" if type_arret == "incident" else "info",
        )
        return Response(_serialiser(rotation, avec_trace=False), status=201)

    @action(detail=True, methods=["post"])
    def reprendre(self, request, rotation_id=None):
        rotation, err = self._rotation(request, rotation_id)
        if err:
            return err
        suivi = rotation.suivi
        if suivi.statut == "arrive":
            return Response({"error": "Convoi déjà arrivé"}, status=400)
        suivi.arrets.filter(fin__isnull=True).update(fin=timezone.now())
        suivi.statut = "en_route"
        suivi.save(update_fields=["statut"])
        return Response(_serialiser(rotation))

    @action(detail=True, methods=["post"])
    def arriver(self, request, rotation_id=None):
        """Clôture : heure d'arrivée, dernière position, durée et distance calculées PAR LE SERVEUR. Idempotent."""
        rotation, err = self._rotation(request, rotation_id)
        if err:
            return err
        with transaction.atomic():
            suivi = SuiviConvoi.objects.select_for_update().get(pk=rotation.suivi.pk)
            if suivi.statut == "arrive":   # clôture répétée : aucun effet, aucune notification
                return Response({**_serialiser(rotation), "deja_cloture": True})
            now = timezone.now()
            suivi.arrets.filter(fin__isnull=True).update(fin=now)
            lat, lng = _float(request.data.get("latitude")), _float(request.data.get("longitude"))
            if _coord_valide(lat, lng):
                suivi.latitude, suivi.longitude, suivi.position_at = lat, lng, now
                suivi.precision_m = _float(request.data.get("precision"))
                PositionConvoi.objects.get_or_create(suivi=suivi, client_id="arrivee", defaults=dict(
                    latitude=lat, longitude=lng, date_heure=now, precision_m=suivi.precision_m))
            suivi.statut, suivi.arrivee_at, suivi.cloture_par = "arrive", now, request.user
            suivi.duree_s = max(0, int((now - suivi.depart_at).total_seconds()))
            suivi.distance_km = suivi_rapports.distance_trace_km(suivi_rapports.lire_points(suivi))
            suivi.save()
        rotation.suivi = suivi
        h, m = divmod(suivi.duree_s // 60, 60)
        _notifier_admins(
            f"🏁 Convoi {rotation.vehicule_matricule or rotation.rotation_id} arrivé",
            f"{rotation.destination or 'Destination'} atteinte à {timezone.localtime(now):%H:%M} "
            f"(trajet {h}h{m:02d}, ~{suivi.distance_km} km) · {suivi.nb_a_bord()} passager(s) à bord",
        )
        return Response(_serialiser(rotation))

    # ── Historique et rapports (mêmes règles d'accès que le suivi) ──
    def _filtre_acces(self, request):
        if _est_admin(request.user):
            return Q()
        f = Q(conducteur_personnel__user=request.user) | Q(conducteur_secondaire_personnel__user=request.user)
        for n in _noms_utilisateur(request.user):
            f |= Q(conducteur__iexact=n) | Q(conducteur_secondaire__iexact=n)
        return f

    @action(detail=False, methods=["get"])
    def historique(self, request):
        """Trajets suivis (en cours et terminés). Filtres : du, au (date de départ), chauffeur, vehicule,
        rotation_id, statut. Admin : tous ; conducteur : uniquement ses propres convois."""
        qs = Rotation.objects.select_related("suivi", "conducteur_personnel").filter(self._filtre_acces(request), suivi__isnull=False)
        g = request.query_params
        if g.get("du"):
            qs = qs.filter(suivi__depart_at__date__gte=g["du"])
        if g.get("au"):
            qs = qs.filter(suivi__depart_at__date__lte=g["au"])
        if g.get("chauffeur"):
            qs = qs.filter(Q(conducteur__icontains=g["chauffeur"]) | Q(conducteur_personnel__nom__icontains=g["chauffeur"]) | Q(conducteur_personnel__prenom__icontains=g["chauffeur"]))
        if g.get("vehicule"):
            qs = qs.filter(Q(vehicule__icontains=g["vehicule"]) | Q(vehicule_matricule__icontains=g["vehicule"]))
        if g.get("rotation_id"):
            qs = qs.filter(rotation_id__icontains=g["rotation_id"])
        if g.get("statut") in ("en_route", "arret", "arrive"):
            qs = qs.filter(suivi__statut=g["statut"])
        lignes = []
        for r in qs.order_by("-suivi__depart_at")[:300]:
            d = _serialiser(r)
            d["mission"] = f"{r.origine or '—'} → {r.destination or '—'}"
            lignes.append(d)
        return Response(lignes)

    @action(detail=True, methods=["get"])
    def rapport(self, request, rotation_id=None):
        rotation, err = self._rotation(request, rotation_id, ecriture=False)
        if err:
            return err
        if not hasattr(rotation, "suivi"):
            return Response({"error": "Ce convoi n'est pas encore parti"}, status=404)
        return Response(suivi_rapports.donnees_rapport(rotation))

    @action(detail=True, methods=["get"])
    def export_csv(self, request, rotation_id=None):
        rotation, err = self._rotation(request, rotation_id, ecriture=False)
        if err:
            return err
        if not hasattr(rotation, "suivi"):
            return Response({"error": "Ce convoi n'est pas encore parti"}, status=404)
        rep = HttpResponse(suivi_rapports.export_csv(rotation), content_type="text/csv; charset=utf-8")
        rep["Content-Disposition"] = f'attachment; filename="trajet_{rotation.rotation_id}.csv"'
        return rep

    @action(detail=True, methods=["get"])
    def export_pdf(self, request, rotation_id=None):
        rotation, err = self._rotation(request, rotation_id, ecriture=False)
        if err:
            return err
        if not hasattr(rotation, "suivi"):
            return Response({"error": "Ce convoi n'est pas encore parti"}, status=404)
        rep = HttpResponse(suivi_rapports.export_pdf(rotation), content_type="application/pdf")
        rep["Content-Disposition"] = f'attachment; filename="rapport_trajet_{rotation.rotation_id}.pdf"'
        return rep
