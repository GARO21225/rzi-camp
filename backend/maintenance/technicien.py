"""Profil technicien : tableau de bord (indicateurs clés + tâches assignées) et liste des assignations en 2 blocs."""
from datetime import timedelta

from django.contrib.auth.models import User
from django.db.models import Q
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import Incident

OUVERTS = ["assigne", "en_cours"]
ORDRE_PRIORITE = {"critique": 0, "haute": 1, "moyenne": 2, "basse": 3}
PLAINTES_OUVERTES = ["affectee", "prise_en_charge", "en_cours", "en_attente", "reouverte"]


def _est_admin(u):
    return bool(u.is_staff or u.is_superuser or getattr(getattr(u, "profile", None), "role", None) == "admin")


def _nom(u):
    return (u.get_full_name() or u.username) if u else ""


def _incident(i):
    return {"type": "incident", "id": i.id, "titre": i.titre, "residence": i.residence, "bloc": i.bloc, "priorite": i.priorite,
            "statut": i.statut, "sla_echeance": i.sla_echeance, "sla_depasse": i.sla_depasse, "date_assignation": i.date_assignation}


def _plainte(p):
    return {"type": "plainte", "id": p.id, "titre": (p.description or "")[:80], "categorie": p.categorie, "residence": p.batiment.residence,
            "priorite": p.priorite, "statut": p.statut, "date_affectation": p.date_affectation,
            "occupant": f"{p.occupant.nom} {p.occupant.prenom}"}


def _taches(user):
    inc = list(Incident.objects.filter(assigne_a=user, statut__in=OUVERTS))
    inc.sort(key=lambda i: (not i.sla_depasse, ORDRE_PRIORITE.get(i.priorite, 9), i.date_assignation or i.date_creation))
    from residences.models import Plainte
    pl = list(Plainte.objects.filter(affecte_a=user, statut__in=PLAINTES_OUVERTES).select_related("batiment", "occupant").order_by("date_affectation"))
    return inc, pl


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def tableau_technicien(request):
    """Mon tableau de bord. Un admin peut passer ?technicien_id=<user id> pour voir celui d'un technicien."""
    u = request.user
    cible = u
    tid = request.query_params.get("technicien_id")
    if tid:
        if not _est_admin(u) and str(u.id) != str(tid):
            return Response({"error": "Admin requis"}, status=403)
        cible = User.objects.filter(pk=tid).first() or u
    maintenant = timezone.now()
    il_y_a_7j, il_y_a_30j = maintenant - timedelta(days=7), maintenant - timedelta(days=30)
    inc, pl = _taches(cible)
    from residences.models import Plainte
    res30 = list(Incident.objects.filter(assigne_a=cible, date_resolution__gte=il_y_a_30j).only("date_resolution", "date_assignation", "date_creation", "sla_echeance"))
    durees = [(i.date_resolution - (i.date_assignation or i.date_creation)).total_seconds() / 3600 for i in res30]
    avec_sla = [i for i in res30 if i.sla_echeance]
    sla_ok = sum(1 for i in avec_sla if i.date_resolution <= i.sla_echeance)
    kpi = {
        "a_traiter": sum(1 for i in inc if i.statut == "assigne") + sum(1 for p in pl if p.statut in ("affectee", "reouverte")),
        "en_cours": sum(1 for i in inc if i.statut == "en_cours") + sum(1 for p in pl if p.statut in ("prise_en_charge", "en_cours")),
        "en_attente": sum(1 for p in pl if p.statut == "en_attente"),
        "critiques": sum(1 for i in inc if i.priorite == "critique"),
        "sla_depasse": sum(1 for i in inc if i.sla_depasse),
        "resolus_7j": Incident.objects.filter(assigne_a=cible, date_resolution__gte=il_y_a_7j).count()
                      + Plainte.objects.filter(resolu_par=cible, date_resolution__gte=il_y_a_7j).count(),
        "resolus_30j": len(res30) + Plainte.objects.filter(resolu_par=cible, date_resolution__gte=il_y_a_30j).count(),
        "temps_moyen_h": round(sum(durees) / len(durees), 1) if durees else None,
        "taux_sla_pct": round(100 * sla_ok / len(avec_sla)) if avec_sla else None,
        "total_ouvert": len(inc) + len(pl),
    }
    return Response({"technicien": {"id": cible.id, "nom": _nom(cible)}, "kpi": kpi,
                     "incidents": [_incident(i) for i in inc], "plaintes": [_plainte(p) for p in pl]})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def assignations(request):
    """Qui a quoi, en 2 blocs : administrateurs (en haut) puis techniciens (en bas). Admin uniquement."""
    if not _est_admin(request.user):
        return Response({"error": "Admin requis"}, status=403)
    from residences.models import Plainte
    admins = User.objects.filter(is_active=True).filter(Q(is_staff=True) | Q(is_superuser=True) | Q(profile__role="admin")).distinct().order_by("last_name", "username")
    techs = User.objects.filter(is_active=True, profile__role="technicien").exclude(pk__in=admins.values("pk")).order_by("last_name", "username")
    inc_par, pl_par = {}, {}
    for i in Incident.objects.filter(assigne_a__isnull=False, statut__in=OUVERTS):
        inc_par.setdefault(i.assigne_a_id, []).append(i)
    for p in Plainte.objects.filter(affecte_a__isnull=False, statut__in=PLAINTES_OUVERTES).select_related("batiment", "occupant"):
        pl_par.setdefault(p.affecte_a_id, []).append(p)

    def bloc(qs):
        out = []
        for x in qs:
            incs, pls = inc_par.get(x.id, []), pl_par.get(x.id, [])
            out.append({"id": x.id, "nom": _nom(x), "username": x.username, "nb_incidents": len(incs), "nb_plaintes": len(pls),
                        "taches": [_incident(i) for i in incs] + [_plainte(p) for p in pls]})
        return out

    return Response({"admins": bloc(admins), "techniciens": bloc(techs)})
