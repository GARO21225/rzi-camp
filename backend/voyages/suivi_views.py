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

from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import Rotation, Voyage, SuiviConvoi, PositionConvoi, ArretConvoi, DeposeArret

# Intervalle minimal entre deux points enregistrés dans la trace (la position
# "courante" est, elle, toujours mise à jour).
INTERVALLE_TRACE_S = 10
MAX_POINTS_TRACE = 600


def _est_admin(u):
    return bool(u.is_staff or u.is_superuser or (hasattr(u, "profile") and getattr(u.profile, "role", "") == "admin"))


def _est_conducteur(u, rotation):
    return any(
        p is not None and p.user_id == u.id
        for p in (rotation.conducteur_personnel, rotation.conducteur_secondaire_personnel)
    )


def _nom(p):
    return f"{p.prenom} {p.nom}".strip() if p else "—"


def _float(v):
    try:
        return float(v) if v not in (None, "") else None
    except (TypeError, ValueError):
        return None


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
        """Convois dont l'utilisateur est conducteur, d'hier à J+1, pas encore arrivés."""
        today = timezone.localdate()
        qs = Rotation.objects.select_related("suivi", "conducteur_personnel").filter(
            Q(conducteur_personnel__user=request.user) | Q(conducteur_secondaire_personnel__user=request.user),
            date_depart__range=(today - datetime.timedelta(days=1), today + datetime.timedelta(days=1)),
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
        now = timezone.now()
        echecs = []
        with transaction.atomic():
            # Même effet que "Départ" côté Centre de Mobilité (partir_rotation) :
            # les passagers encore "planifiés" passent "en voyage".
            for v in _passagers(rotation).filter(statut="planifie"):
                try:
                    v.partir(None)
                except Exception as e:
                    echecs.append(f"{_nom(v.personnel)}: {e}")
            nb = _passagers(rotation).filter(statut="en_voyage").count()
            SuiviConvoi.objects.create(
                rotation=rotation, statut="en_route", depart_at=now, demarre_par=request.user,
                nb_passagers_depart=nb,
                latitude=_float(request.data.get("latitude")), longitude=_float(request.data.get("longitude")),
                position_at=now if request.data.get("latitude") else None,
            )
        _notifier_admins(
            f"🚐 Départ convoi {rotation.vehicule_matricule or rotation.vehicule or rotation.rotation_id}",
            f"{rotation.conducteur or 'Le conducteur'} est parti à {timezone.localtime(now):%H:%M} "
            f"avec {nb} passager(s) — {rotation.origine or 'Camp'} → {rotation.destination or '?'}",
        )
        return Response({**_serialiser(rotation), "echecs": echecs}, status=201)

    @action(detail=True, methods=["post"])
    def position(self, request, rotation_id=None):
        rotation, err = self._rotation(request, rotation_id)
        if err:
            return err
        lat, lng = _float(request.data.get("latitude")), _float(request.data.get("longitude"))
        if lat is None or lng is None or not (-90 <= lat <= 90 and -180 <= lng <= 180):
            return Response({"error": "latitude/longitude invalides"}, status=400)
        suivi = rotation.suivi
        if suivi.statut == "arrive":
            return Response({"ok": True, "ignore": "convoi arrivé"})
        now = timezone.now()
        vitesse = _float(request.data.get("vitesse_kmh"))
        dernier = suivi.positions.order_by("-date_heure").values_list("date_heure", flat=True).first()
        if not dernier or (now - dernier).total_seconds() >= INTERVALLE_TRACE_S:
            PositionConvoi.objects.create(suivi=suivi, latitude=lat, longitude=lng, vitesse_kmh=vitesse, date_heure=now)
        suivi.latitude, suivi.longitude, suivi.position_at = lat, lng, now
        suivi.vitesse_kmh = vitesse
        suivi.cap = _float(request.data.get("cap"))
        suivi.save(update_fields=["latitude", "longitude", "position_at", "vitesse_kmh", "cap"])
        return Response({"ok": True})

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
        rotation, err = self._rotation(request, rotation_id)
        if err:
            return err
        suivi = rotation.suivi
        if suivi.statut == "arrive":
            return Response(_serialiser(rotation))
        now = timezone.now()
        suivi.arrets.filter(fin__isnull=True).update(fin=now)
        suivi.statut, suivi.arrivee_at = "arrive", now
        lat, lng = _float(request.data.get("latitude")), _float(request.data.get("longitude"))
        if lat is not None and lng is not None:
            suivi.latitude, suivi.longitude, suivi.position_at = lat, lng, now
        suivi.save()
        duree = now - suivi.depart_at
        h, m = divmod(int(duree.total_seconds() // 60), 60)
        _notifier_admins(
            f"🏁 Convoi {rotation.vehicule_matricule or rotation.rotation_id} arrivé",
            f"{rotation.destination or 'Destination'} atteinte à {timezone.localtime(now):%H:%M} "
            f"(trajet {h}h{m:02d}) · {suivi.nb_a_bord()} passager(s) à bord",
        )
        return Response(_serialiser(rotation))
