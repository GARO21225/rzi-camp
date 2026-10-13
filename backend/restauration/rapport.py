"""Agregats des repas servis (RepasLog) : source UNIQUE du rapport detaille
affiche dans l'application ET du rapport envoye par email."""
import datetime
from django.db.models import Count
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


def agreger(debut, fin, restaurant_ids=None):
    """debut/fin : dates incluses. restaurant_ids : None = tous."""
    qs = RepasLog.objects.filter(date_validation__date__gte=debut, date_validation__date__lte=fin)
    if restaurant_ids is not None:
        qs = qs.filter(restaurant_id__in=restaurant_ids)
    total = qs.count()
    nb_jours = (fin - debut).days + 1

    par_jour = {d: n for d, n in qs.annotate(d=TruncDate("date_validation")).values_list("d").annotate(n=Count("id"))}
    serie = [((debut + datetime.timedelta(days=i)).isoformat(), par_jour.get(debut + datetime.timedelta(days=i), 0)) for i in range(nb_jours)]

    par_repas = [(LIBELLE_REPAS.get(k, k), n) for k, n in
                 qs.values_list("qr_token__type_repas").annotate(n=Count("id")).order_by("-n")]
    par_resto = [(k or "Non renseigné", n) for k, n in
                 qs.values_list("restaurant__nom").annotate(n=Count("id")).order_by("-n")]
    sup = {}
    for uid, prenom, nom, usr, n in qs.values_list("valide_par_id", "valide_par__first_name", "valide_par__last_name",
                                                    "valide_par__username").annotate(n=Count("id")):
        label = (f"{prenom} {nom}".strip() or usr) if uid else "Non renseigné"
        sup[label] = sup.get(label, 0) + n
    par_superviseur = sorted(sup.items(), key=lambda x: -x[1])
    par_societe = [(k or "Non renseignée", n) for k, n in
                   qs.values_list("personnel__societe").annotate(n=Count("id")).order_by("-n")][:15]
    par_heure = sorted((h, n) for h, n in qs.annotate(h=ExtractHour("date_validation")).values_list("h").annotate(n=Count("id")) if h is not None)

    matrice = {}
    for resto, repas, n in qs.values_list("restaurant__nom", "qr_token__type_repas").annotate(n=Count("id")):
        matrice.setdefault(resto or "Non renseigné", {})[LIBELLE_REPAS.get(repas, repas)] = n

    uniques = qs.exclude(personnel__isnull=True).values("personnel_id").distinct().count()
    return {
        "debut": debut.isoformat(), "fin": fin.isoformat(), "total": total, "nb_jours": nb_jours,
        "moyenne_par_jour": round(total / nb_jours, 1) if nb_jours else 0,
        "personnes_uniques": uniques,
        "par_jour": serie, "par_repas": par_repas, "par_restaurant": par_resto,
        "par_superviseur": par_superviseur, "par_societe": par_societe, "par_entite": _par_entite(qs),
        "par_heure": [(f"{h:02d}h", n) for h, n in par_heure],
        "matrice": matrice,
    }


def bornes(periode, today):
    """periode : aujourdhui | hier | 7j | semaine (lun-dim precedents) | mois | mois_precedent"""
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
