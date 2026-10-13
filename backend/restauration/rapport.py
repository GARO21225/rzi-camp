"""Agregats des repas servis (RepasLog) : source UNIQUE du rapport detaille
affiche dans l'application ET du rapport envoye par email."""
import datetime
from django.db.models import Count, Avg, Max, Min
from django.db.models.functions import TruncDate, ExtractHour

from .models import RepasLog

LIBELLE_REPAS = {"petit_dejeuner": "Petit-déjeuner", "dejeuner": "Déjeuner", "diner": "Dîner"}


def _par_entite(qs):
    """Repas par ENTITE, comme le Camp Occupancy : employés Roxgold (par département),
    sous-traitants (par entreprise, « Nom - Mère » pour une filiale), visiteurs (par département)."""
    from residences.models import Departement, Entreprise
    deps = {d.nom.lower(): d.nom for d in Departement.objects.all()}
    ents = {e.nom.lower(): e for e in Entreprise.objects.select_related("entreprise_mere")}
    NR = "Non renseigné"
    rox, sst, vis = {}, {}, {}
    for typ, soc, dep, n in qs.values_list("personnel__type_personnel", "personnel__societe", "personnel__departement").annotate(n=Count("id")):
        soc, dep = (soc or "").strip(), (dep or "").strip()
        nom_dep = deps.get(dep.lower(), dep or NR)
        if typ == "visiteur":
            vis[nom_dep] = vis.get(nom_dep, 0) + n
        elif typ == "sous_traitant" or (soc and soc.lower() in ents and soc.upper() != "ROXGOLD"):
            e = ents.get(soc.lower())
            lib = (f"{e.nom} - {e.entreprise_mere.nom}" if e and e.entreprise_mere_id else (e.nom if e else (soc or "Société non renseignée")))
            sst[lib] = sst.get(lib, 0) + n
        elif typ:
            rox[nom_dep] = rox.get(nom_dep, 0) + n
        else:   # repas sans fiche personnel rattachée
            rox[NR] = rox.get(NR, 0) + n
    tri = lambda d: sorted(d.items(), key=lambda x: -x[1])
    return {"types": [(l, sum(x.values())) for l, x in (("Employés Roxgold", rox), ("Sous-traitants", sst), ("Visiteurs", vis)) if x],
            "departements": tri(rox), "soustraitants": tri(sst), "visiteurs": tri(vis)}


def _occupation_jour(jour, today):
    """Chambres occupees la nuit du jour (meme definition que le Camp Occupancy)."""
    try:
        from accounts.rapports_email import _occupants
        return len(_occupants(jour, today))
    except Exception:
        return None


def _legers(qs, nb_jours):
    total = qs.count()
    return {"total": total, "personnes_uniques": qs.exclude(personnel__isnull=True).values("personnel_id").distinct().count(),
            "moyenne_par_jour": round(total / nb_jours, 1) if nb_jours else 0}


def agreger(debut, fin, restaurant_ids=None, type_repas=None, today=None):
    """debut/fin : dates incluses. restaurant_ids : None = tous. type_repas : petit_dejeuner|dejeuner|diner."""
    from django.utils import timezone
    today = today or timezone.localdate()
    base = RepasLog.objects.filter(date_validation__date__gte=debut, date_validation__date__lte=fin)
    if restaurant_ids is not None:
        base = base.filter(restaurant_id__in=restaurant_ids)
    if type_repas:
        base = base.filter(qr_token__type_repas=type_repas)
    qs = base
    total = qs.count()
    nb_jours = (fin - debut).days + 1

    # ── série quotidienne : repas (3 types), personnes distinctes, couverture
    rows = (qs.annotate(d=TruncDate("date_validation")).values_list("d", "qr_token__type_repas").annotate(n=Count("id")))
    par_jour_repas = {}
    for d, t, n in rows:
        par_jour_repas.setdefault(d, {})[t] = n
    uniq_jour = {d: n for d, n in qs.exclude(personnel__isnull=True).annotate(d=TruncDate("date_validation"))
                 .values_list("d").annotate(n=Count("personnel_id", distinct=True))}
    serie = []
    for i in range(nb_jours):
        j = debut + datetime.timedelta(days=i)
        m = par_jour_repas.get(j, {})
        tot_j = sum(m.values())
        occ = _occupation_jour(j, today) if nb_jours <= 45 and j <= today else None
        serie.append({"date": j.isoformat(), "petit_dejeuner": m.get("petit_dejeuner", 0), "dejeuner": m.get("dejeuner", 0),
                      "diner": m.get("diner", 0), "total": tot_j, "personnes": uniq_jour.get(j, 0), "occupation": occ,
                      "couverture": round(tot_j / (occ * 3) * 100) if occ else None})
    jours_actifs = [x for x in serie if x["total"]]
    occ_vals = [x for x in serie if x["occupation"]]
    couverture = round(sum(x["total"] for x in occ_vals) / (sum(x["occupation"] for x in occ_vals) * 3) * 100) if occ_vals else None

    par_repas = [(LIBELLE_REPAS.get(k, k), n) for k, n in
                 qs.values_list("qr_token__type_repas").annotate(n=Count("id")).order_by("-n")]
    par_resto = [(k or "Non renseigné", n) for k, n in
                 qs.values_list("restaurant__nom").annotate(n=Count("id")).order_by("-n")]

    # ── restaurants (tous les actifs, même à 0) avec superviseurs affectés
    from .models import Restaurant
    resto_stats = {}
    for rid, t, n in qs.values_list("restaurant_id", "qr_token__type_repas").annotate(n=Count("id")):
        resto_stats.setdefault(rid, {})[t] = n
    dernier_scan = {rid: dt for rid, dt in qs.values_list("restaurant_id").annotate(m=Max("date_validation"))}
    restaurants = []
    for r in Restaurant.objects.filter(actif=True).prefetch_related("superviseurs__user"):
        if restaurant_ids is not None and r.id not in restaurant_ids:
            continue
        m = resto_stats.get(r.id, {})
        tot_r = sum(m.values())
        restaurants.append({"id": r.id, "nom": r.nom, "total": tot_r, "part": round(tot_r / total * 100) if total else 0,
                            "petit_dejeuner": m.get("petit_dejeuner", 0), "dejeuner": m.get("dejeuner", 0), "diner": m.get("diner", 0),
                            "moyenne_par_jour": round(tot_r / nb_jours, 1),
                            "superviseurs": [(s.user.get_full_name() or s.user.username) for s in r.superviseurs.all()],
                            "dernier_scan": dernier_scan.get(r.id).isoformat() if dernier_scan.get(r.id) else None})
    sans_resto = resto_stats.get(None)
    if sans_resto:
        t = sum(sans_resto.values())
        restaurants.append({"id": None, "nom": "Non renseigné", "total": t, "part": round(t / total * 100) if total else 0,
                            "petit_dejeuner": sans_resto.get("petit_dejeuner", 0), "dejeuner": sans_resto.get("dejeuner", 0),
                            "diner": sans_resto.get("diner", 0), "moyenne_par_jour": round(t / nb_jours, 1), "superviseurs": [], "dernier_scan": None})

    # ── superviseurs : scans, restaurants, premier / dernier scan
    sup = {}
    for uid, prenom, nom, usr, rnom, n, t0, t1 in qs.values_list(
            "valide_par_id", "valide_par__first_name", "valide_par__last_name", "valide_par__username", "restaurant__nom").annotate(
            n=Count("id"), t0=Min("date_validation"), t1=Max("date_validation")):
        label = (f"{prenom} {nom}".strip() or usr) if uid else "Non renseigné"
        e = sup.setdefault(label, {"nom": label, "scans": 0, "restaurants": set(), "premier": t0, "dernier": t1})
        e["scans"] += n
        if rnom: e["restaurants"].add(rnom)
        e["premier"], e["dernier"] = min(e["premier"], t0), max(e["dernier"], t1)
    superviseurs = sorted(({"nom": e["nom"], "scans": e["scans"], "restaurants": sorted(e["restaurants"]),
                            "premier": e["premier"].isoformat(), "dernier": e["dernier"].isoformat()} for e in sup.values()),
                          key=lambda x: -x["scans"])
    par_superviseur = [(x["nom"], x["scans"]) for x in superviseurs]

    par_societe = [(k or "Non renseignée", n) for k, n in
                   qs.values_list("personnel__societe").annotate(n=Count("id")).order_by("-n")][:15]
    par_heure = sorted((h, n) for h, n in qs.annotate(h=ExtractHour("date_validation")).values_list("h").annotate(n=Count("id")) if h is not None)
    matrice = {}
    for resto, repas, n in qs.values_list("restaurant__nom", "qr_token__type_repas").annotate(n=Count("id")):
        matrice.setdefault(resto or "Non renseigné", {})[LIBELLE_REPAS.get(repas, repas)] = n

    # ── période précédente (même durée) pour la comparaison
    fin_p = debut - datetime.timedelta(days=1)
    debut_p = fin_p - datetime.timedelta(days=nb_jours - 1)
    qp = RepasLog.objects.filter(date_validation__date__gte=debut_p, date_validation__date__lte=fin_p)
    if restaurant_ids is not None: qp = qp.filter(restaurant_id__in=restaurant_ids)
    if type_repas: qp = qp.filter(qr_token__type_repas=type_repas)
    precedent = {**_legers(qp, nb_jours), "debut": debut_p.isoformat(), "fin": fin_p.isoformat()}
    uniques = qs.exclude(personnel__isnull=True).values("personnel_id").distinct().count()

    # ── satisfaction (avis du personnel)
    from .models import AvisRestauration
    av = AvisRestauration.objects.filter(date_avis__gte=debut, date_avis__lte=fin)
    moy = av.aggregate(m=Avg("note"), n=Count("id"))
    satisfaction = {
        "moyenne": round(moy["m"], 2) if moy["m"] else None, "nb": moy["n"],
        "par_repas": [(dict(AvisRestauration.REPAS_CHOICES).get(k, k), round(m, 2), n) for k, m, n in
                      av.values_list("repas").annotate(m=Avg("note"), n=Count("id")).order_by("repas")],
        "distribution": [(str(k), n) for k, n in sorted(av.values_list("note").annotate(n=Count("id")))],
        "a_traiter": [{"date": a.date_avis.isoformat(), "repas": a.get_repas_display(), "note": a.note, "commentaire": a.commentaire[:200]}
                      for a in av.filter(note__lte=2).order_by("-date_creation")[:5]],
    }

    return {
        "debut": debut.isoformat(), "fin": fin.isoformat(), "total": total, "nb_jours": nb_jours,
        "jours_actifs": len(jours_actifs),
        "moyenne_par_jour": round(total / nb_jours, 1) if nb_jours else 0,
        "moyenne_jour_actif": round(total / len(jours_actifs), 1) if jours_actifs else 0,
        "personnes_uniques": uniques, "couverture": couverture, "precedent": precedent,
        "pic_jour": max(jours_actifs, key=lambda x: x["total"]) if jours_actifs else None,
        "pic_heure": max(par_heure, key=lambda x: x[1]) if par_heure else None,
        "serie": serie, "par_jour": [(x["date"], x["total"]) for x in serie],
        "par_repas": par_repas, "par_restaurant": par_resto, "restaurants": restaurants,
        "superviseurs": superviseurs, "par_superviseur": par_superviseur, "par_societe": par_societe, "par_entite": _par_entite(qs),
        "par_heure": [(f"{h:02d}h", n) for h, n in par_heure], "matrice": matrice,
        "satisfaction": satisfaction, "alertes": _alertes(debut, fin, restaurants, serie, total, couverture),
    }


def _alertes(debut, fin, restaurants, serie, total, couverture):
    al = []
    for r in restaurants:
        if r["id"] is not None and not r["superviseurs"]:
            al.append({"niveau": "rouge", "texte": f"{r['nom']} n'a aucun superviseur affecté — personne ne peut y scanner."})
    sans = next((r for r in restaurants if r["id"] is None), None)
    if sans and sans["total"]:
        al.append({"niveau": "orange", "texte": f"{sans['total']} repas sans restaurant renseigné (scans faits avant l'affectation des superviseurs ou par un admin)."})
    zeros = [x["date"] for x in serie if x["total"] == 0 and x["date"] <= datetime.date.today().isoformat()]
    if total and zeros and len(serie) > 1:
        al.append({"niveau": "orange", "texte": f"{len(zeros)} jour(s) sans aucun repas scanné : " + ", ".join(f"{d[8:10]}/{d[5:7]}" for d in zeros[:8]) + (" …" if len(zeros) > 8 else "")})
    if couverture is not None and total and couverture < 40:
        al.append({"niveau": "orange", "texte": f"Couverture faible ({couverture} %) : beaucoup de repas ne sont probablement pas scannés."})
    try:
        from residences.models import Personnel
        n = sum(1 for pk, qr in Personnel.objects.filter(actif=True).values_list("pk", "qr_code_string") if qr != Personnel.qr_signe(pk))
        if n:
            al.append({"niveau": "orange", "texte": f"{n} badge(s) n'ont pas de QR signé : ils seront refusés au scan (Restaurants → Réglages → Régénérer)."})
    except Exception:
        pass
    return al


def bornes(periode, today, debut=None, fin=None):
    """periode : aujourdhui | hier | 7j | semaine (lun-dim precedents) | mois | mois_precedent"""
    if periode == "perso" and debut and fin:
        try:
            return datetime.date.fromisoformat(str(debut)), datetime.date.fromisoformat(str(fin))
        except ValueError:
            pass
    if periode == "aujourdhui":
        return today, today
    if periode == "7j":
        return today - datetime.timedelta(days=6), today
    if periode == "semaine":
        lundi = today - datetime.timedelta(days=today.weekday() + 7)
        return lundi, lundi + datetime.timedelta(days=6)
    if periode == "mois":
        return today.replace(day=1), today
    if periode == "mois_precedent":
        fin = today.replace(day=1) - datetime.timedelta(days=1)
        return fin.replace(day=1), fin
    h = today - datetime.timedelta(days=1)
    return h, h
