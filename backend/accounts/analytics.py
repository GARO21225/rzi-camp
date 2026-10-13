"""Endpoint unique /api/analytics/ : agrégats réels (aucun nom de personne) pour la page Analytics."""
from collections import Counter, defaultdict
from datetime import timedelta

from django.db.models import Count, Q
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response


def _jours(debut, n):
    return [debut + timedelta(days=i) for i in range(n)]


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def analytics(request):
    from maintenance.models import Incident
    from residences.models import Batiment, OccupationHistory, Personnel
    from voyages.models import Voyage

    today = timezone.localdate()
    try:
        nb = max(7, min(90, int(request.query_params.get("jours", 30))))
    except ValueError:
        nb = 30
    debut = today - timedelta(days=nb - 1)

    # ── Parc & occupation ──
    bats = list(Batiment.objects.values("bloc", "statut"))
    par_statut = Counter(b["statut"] for b in bats)
    par_bloc = defaultdict(lambda: {"total": 0, "occupes": 0})
    for b in bats:
        d = par_bloc[b["bloc"] or "—"]
        d["total"] += 1
        d["occupes"] += b["statut"] == "Occupé"
    total = len(bats)
    hors_service = par_statut.get("Maintenance", 0)
    exploitable = max(1, total - hors_service)

    # chambres occupées chaque nuit (une chambre = une unité, comme Camp Occupancy)
    hist = (OccupationHistory.objects.filter(date_arrivee__lte=today)
            .filter(Q(date_depart__isnull=True) | Q(date_depart__gte=debut))
            .values_list("batiment_id", "date_arrivee", "date_depart"))
    nuits = {j: set() for j in _jours(debut, nb)}
    for bid, arr, dep in hist:
        for j in nuits:
            if arr <= j and (dep is None or dep > j):
                nuits[j].add(bid)
    tendance = [{"date": j.isoformat(), "occupees": len(s)} for j, s in nuits.items()]
    # aujourd'hui : l'état réel du parc fait foi
    if tendance:
        tendance[-1]["occupees"] = par_statut.get("Occupé", 0)

    # ── Personnel ──
    pers = list(Personnel.objects.values_list("type_personnel", "societe"))
    par_type = Counter(t or "roxgold" for t, _ in pers)
    par_societe = Counter((s or "N/A") for _, s in pers).most_common(8)

    # ── Incidents ──
    incs = list(Incident.objects.values("statut", "priorite", "categorie", "date_creation", "date_resolution", "sla_depasse"))
    ouverts_st = ("declare", "assigne", "en_cours")
    ouverts = [i for i in incs if i["statut"] in ouverts_st]
    resolus = [i for i in incs if i["date_resolution"] and i["statut"] in ("resolu", "cloture")]
    delai_h = (sum((i["date_resolution"] - i["date_creation"]).total_seconds() for i in resolus) / len(resolus) / 3600) if resolus else None
    cree_j, resolu_j = Counter(), Counter()
    for i in incs:
        cree_j[timezone.localtime(i["date_creation"]).date()] += 1
        if i["date_resolution"]:
            resolu_j[timezone.localtime(i["date_resolution"]).date()] += 1
    inc_tend = [{"date": j.isoformat(), "crees": cree_j.get(j, 0), "resolus": resolu_j.get(j, 0)} for j in _jours(debut, nb)]

    # ── Voyages (14 jours à venir) ──
    voy = Voyage.objects.all()
    fin = today + timedelta(days=13)
    dep_j = Counter(voy.filter(statut="planifie", date_depart__range=(today, fin)).values_list("date_depart", flat=True))
    ret_j = Counter(voy.filter(statut__in=("planifie", "en_voyage"), date_retour_prevue__range=(today, fin)).values_list("date_retour_prevue", flat=True))
    voy_prog = [{"date": j.isoformat(), "departs": dep_j.get(j, 0), "retours": ret_j.get(j, 0)} for j in _jours(today, 14)]

    # ── Plaintes, événements, alertes (utilisé aussi par l'assistant) ──
    from evenements.models import AlerteCampus, Evenement
    from residences.models import Plainte
    clos = ["resolue", "confirmee", "cloturee", "rejetee"]
    pl_ouv = Plainte.objects.exclude(statut__in=clos)
    maintenant = timezone.now()
    ev = Evenement.objects.exclude(statut__in=("annule", "termine"))
    plaintes = {
        "ouvertes": pl_ouv.count(), "non_affectees": pl_ouv.filter(affecte_a__isnull=True).count(),
        "par_statut": dict(Plainte.objects.values_list("statut").annotate(n=Count("id")).values_list("statut", "n")),
    }
    evenements = {
        "en_cours": ev.filter(date_debut__lte=maintenant).filter(Q(date_fin__isnull=True) | Q(date_fin__gte=maintenant)).count(),
        "a_venir_7j": ev.filter(date_debut__gt=maintenant, date_debut__lte=maintenant + timedelta(days=7)).count(),
        "prochains": [{"titre": e.titre, "date": e.date_debut.isoformat(), "lieu": e.lieu}
                      for e in ev.filter(date_debut__gt=maintenant).order_by("date_debut")[:3]],
    }
    alertes = {"actives": list(AlerteCampus.objects.filter(active=True).values_list("message", flat=True)[:5])}

    return Response({
        "plaintes": plaintes, "evenements": evenements, "alertes": alertes,
        "genere": timezone.now().isoformat(), "jours": nb,
        "parc": {
            "total": total, "par_statut": dict(par_statut), "hors_service": hors_service,
            "taux": round(par_statut.get("Occupé", 0) * 100 / exploitable, 1),
            "par_bloc": sorted(({"bloc": k, **v} for k, v in par_bloc.items()), key=lambda x: -x["total"]),
            "tendance": tendance,
        },
        "personnel": {"total": len(pers), "par_type": dict(par_type), "par_societe": [{"societe": s, "n": n} for s, n in par_societe]},
        "incidents": {
            "total": len(incs), "ouverts": len(ouverts), "sla_depasse": sum(1 for i in ouverts if i["sla_depasse"]),
            "critiques_ouverts": sum(1 for i in ouverts if i["priorite"] == "critique"),
            "delai_moyen_h": round(delai_h, 1) if delai_h is not None else None,
            "par_statut": dict(Counter(i["statut"] for i in incs)),
            "par_priorite": dict(Counter(i["priorite"] for i in incs)),
            "par_categorie": [{"categorie": c or "Autre", "n": n} for c, n in Counter(i["categorie"] for i in incs).most_common(6)],
            "tendance": inc_tend,
        },
        "voyages": {
            "total": voy.count(),
            "par_statut": dict(voy.values_list("statut").annotate(n=Count("id")).values_list("statut", "n")),
            "programme": voy_prog,
        },
    })
