"""
Contenu des rapports envoyés par email (Paramétrage → Rapports par email).

Chaque rapport a un TYPE (quelles sections) et des OPTIONS (paramètres) :
  horizon_jours : fenêtre « à venir » pour la mobilité (défaut 1 = aujourd'hui)
  seuil_stock   : un article est « faible » à partir de ce stock (défaut 5)
  details       : liste nominative (personnes, incidents, articles) en plus des chiffres
"""
from django.conf import settings
from django.utils import timezone
import datetime
import html as _h

TYPES = {
    "synthese":    "📊 Synthèse générale (tout)",
    "residences":  "🏠 Résidences & occupation (+ Camp Occupancy)",
    "occupation":  "🏕️ Camp Occupancy (départements, sous-traitants, visiteurs)",
    "maintenance": "🛠️ Maintenance & incidents",
    "mobilite":    "✈️ Mobilité (départs / retours)",
    "boutique":    "🛒 Boutique & stock",
}
OPTIONS_DEFAUT = {
    "horizon_jours": 1, "seuil_stock": 5, "details": False,
    # Camp Occupancy (réglables depuis Paramétrage → Rapports par email)
    "jour_reference": "aujourdhui",       # "aujourdhui" | "hier"
    "occ_departements": True, "occ_soustraitants": True, "occ_visiteurs": True,
    "occ_graphiques": True, "occ_tendance": True, "jours_tendance": 7,
    "masquer_zeros": False,
}
BOOLS_OCC = ("occ_departements", "occ_soustraitants", "occ_visiteurs", "occ_graphiques", "occ_tendance", "masquer_zeros")


def options_effectives(opts):
    o = dict(OPTIONS_DEFAUT)
    for k, v in (opts or {}).items():
        if k in o and v not in (None, ""):
            o[k] = v
    try:
        o["horizon_jours"] = max(1, min(60, int(o["horizon_jours"])))
        o["seuil_stock"] = max(0, int(o["seuil_stock"]))
    except (TypeError, ValueError):
        o["horizon_jours"], o["seuil_stock"] = 1, 5
    o["details"] = bool(o["details"])
    for k in BOOLS_OCC:
        o[k] = bool(o[k])
    try:
        o["jours_tendance"] = max(2, min(31, int(o["jours_tendance"])))
    except (TypeError, ValueError):
        o["jours_tendance"] = 7
    if o["jour_reference"] not in ("aujourdhui", "hier"):
        o["jour_reference"] = "aujourdhui"
    return o


def _e(x):
    return _h.escape(str(x if x is not None else ""))


def _liste(items):
    if not items:
        return ""
    return "<ul style='margin:4px 0 0;padding-left:18px;font-size:12.5px;color:#334155'>" + "".join(f"<li>{_e(i)}</li>" for i in items[:30]) + (f"<li>… +{len(items)-30}</li>" if len(items) > 30 else "") + "</ul>"


def _titre(t):
    return f"<h3 style='color:#0F2A5C;font-size:15px;margin:26px 0 8px;padding-bottom:6px;border-bottom:2px solid #C9972B'>{t}</h3>"


def _kpis(tuiles):
    """Rangée de tuiles KPI (tableau HTML : compatible tous clients mail). tuiles = [(libellé, valeur, couleur)]"""
    cells = "".join(
        f"<td align='center' style='padding:12px 6px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;width:{100//max(1,len(tuiles))}%'>"
        f"<div style='font-size:24px;font-weight:700;color:{c}'>{_e(v)}</div>"
        f"<div style='font-size:11px;color:#64748b;margin-top:2px'>{_e(l)}</div></td>"
        for l, v, c in tuiles)
    return f"<table role='presentation' width='100%' cellspacing='6' cellpadding='0' style='border-collapse:separate;margin:6px 0'><tr>{cells}</tr></table>"


def _barres(titre, donnees, couleur="#2563EB", suffixe="", pct_total=True):
    """Histogramme horizontal en tableau HTML (les <svg>/<script> sont bloqués par les clients mail).
    donnees = [(libellé, nombre)] ; couleur = str ou fonction(libellé) -> str"""
    donnees = [(l, n) for l, n in donnees if n]
    if not donnees:
        return ""
    mx = max(n for _, n in donnees)
    tot = sum(n for _, n in donnees)
    lignes = ""
    for l, n in donnees:
        col = couleur(l) if callable(couleur) else couleur
        pct = max(3, round(n / mx * 100))
        pct_html = (" <span style='color:#94a3b8;font-weight:400'>(%d%%)</span>" % round(n / tot * 100)) if pct_total else ""
        lignes += (f"<tr><td style='font-size:12px;color:#334155;padding:3px 8px 3px 0;width:34%;white-space:nowrap'>{_e(l)}</td>"
                   f"<td style='padding:3px 0'><div style='background:{col};height:14px;width:{pct}%;border-radius:3px'></div></td>"
                   f"<td style='font-size:12px;font-weight:700;color:#0f172a;padding:3px 0 3px 8px;width:70px;white-space:nowrap'>{n}{suffixe} {pct_html}</td></tr>")
    return (f"<div style='font-size:12px;font-weight:700;color:#475569;margin:14px 0 4px'>{_e(titre)}</div>"
            f"<table role='presentation' width='100%' cellspacing='0' cellpadding='0'>{lignes}</table>")


def _jauge(libelle, pct, couleur):
    return (f"<div style='font-size:12px;font-weight:700;color:#475569;margin:14px 0 4px'>{_e(libelle)}</div>"
            f"<div style='background:#e2e8f0;border-radius:6px;height:16px;overflow:hidden'><div style='background:{couleur};height:16px;width:{min(100,max(0,pct))}%'></div></div>")


COUL_STATUT = {"Occupé": "#DC2626", "Libre": "#16A34A", "Réservé": "#2563EB", "Maintenance": "#D97706"}
COUL_PRIO = {"critique": "#DC2626", "haute": "#EA580C", "moyenne": "#CA8A04", "basse": "#16A34A"}


def _compter(qs, champ):
    from django.db.models import Count
    return list(qs.values_list(champ).annotate(n=Count("id")).order_by("-n"))


def _sec_residences(o, today):
    from residences.models import Batiment, Personnel
    total = Batiment.objects.count()
    par_statut = _compter(Batiment.objects.all(), "statut")
    n = dict(par_statut)
    occ = n.get("Occupé", 0)
    taux = round(occ / total * 100, 1) if total else 0
    actifs = Personnel.objects.filter(actif=True)
    fin = today + datetime.timedelta(days=o["horizon_jours"])
    partants = Batiment.objects.filter(statut="Occupé", date_depart__gte=today, date_depart__lte=fin)
    arrivants = Batiment.objects.filter(date_arrivee__gte=today, date_arrivee__lte=fin)
    corps = _kpis([("Chambres", total, "#0F2A5C"), ("Occupées", occ, "#DC2626"), ("Libres", n.get("Libre", 0), "#16A34A"),
                   ("Taux d'occupation", f"{taux}%", "#C9972B")])
    corps += _jauge("Taux d'occupation", taux, "#DC2626" if taux > 90 else "#C9972B")
    corps += _barres("Répartition par statut", par_statut, lambda l: COUL_STATUT.get(l, "#64748b"))
    corps += _barres("Occupation par bloc (chambres occupées)", _compter(Batiment.objects.filter(statut="Occupé"), "bloc")[:12], "#0F2A5C")
    corps += _barres("Personnel actif par société", _compter(actifs, "societe")[:10], "#2563EB")
    corps += _barres("Personnel actif par type", [(dict(Personnel.TYPE_CHOICES).get(k, k), v) for k, v in _compter(actifs, "type_personnel")], "#7C3AED")
    corps += f"<p style='font-size:12.5px;color:#334155;margin:12px 0 0'>Dans les {o['horizon_jours']} prochain(s) jour(s) : <b>{partants.count()}</b> départ(s) de résidence · <b>{arrivants.count()}</b> arrivée(s)</p>"
    if o["details"]:
        corps += _liste([f"{b.residence} {b.bloc or ''} — {b.occupant or '?'} (part le {b.date_depart:%d/%m})" for b in partants])
    return _titre("🏠 Résidences & personnel") + corps


def _sec_maintenance(o, today):
    from maintenance.models import Incident
    tous = Incident.objects.all()
    ouverts = tous.exclude(statut__in=["resolu", "cloture", "annule"])
    sla = ouverts.filter(sla_depasse=True)
    il_y_a_7 = timezone.now() - datetime.timedelta(days=7)
    nouveaux = tous.filter(date_creation__gte=il_y_a_7).count()
    resolus = tous.filter(date_resolution__gte=il_y_a_7).count()
    corps = _kpis([("Ouverts", ouverts.count(), "#0F2A5C"), ("Dépassement SLA", sla.count(), "#DC2626" if sla.exists() else "#16A34A"),
                   ("Nouveaux (7 j)", nouveaux, "#EA580C"), ("Résolus (7 j)", resolus, "#16A34A")])
    corps += _barres("Incidents ouverts par priorité", [(dict(Incident.PRIORITE).get(k, k).split(" ", 1)[-1], v) for k, v in _compter(ouverts, "priorite")],
                     lambda l: COUL_PRIO.get(l.lower(), "#64748b"))
    corps += _barres("Incidents ouverts par catégorie", [(dict(Incident.CATEGORIE).get(k, k), v) for k, v in _compter(ouverts, "categorie")][:10], "#0F2A5C")
    corps += _barres("Incidents ouverts par statut", [(dict(Incident.STATUT).get(k, k), v) for k, v in _compter(ouverts, "statut")], "#7C3AED")
    if o["details"]:
        corps += _liste([f"[{i.priorite}] {i.titre} — {i.residence}{' ⚠️ SLA' if i.sla_depasse else ''}" for i in ouverts.order_by("-sla_depasse", "-date_creation")[:30]])
    return _titre("🛠️ Maintenance") + corps


def _sec_mobilite(o, today):
    from voyages.models import Voyage
    fin = today + datetime.timedelta(days=o["horizon_jours"] - 1)
    actifs = Voyage.objects.exclude(statut__in=["annule", "retour"])
    deps = actifs.filter(date_depart__gte=today, date_depart__lte=fin)
    rets = actifs.filter(date_retour_prevue__gte=today, date_retour_prevue__lte=fin)
    attente = Voyage.objects.filter(statut_validation="en_attente").count()
    en_route = Voyage.objects.filter(statut="en_voyage").count()
    horizon = "aujourd'hui" if o["horizon_jours"] == 1 else f"sur {o['horizon_jours']} jours"
    corps = _kpis([(f"Départs {horizon}", deps.count(), "#0F2A5C"), (f"Retours {horizon}", rets.count(), "#16A34A"),
                   ("En voyage", en_route, "#2563EB"), ("À valider", attente, "#DC2626" if attente else "#16A34A")])
    corps += _barres("Voyages par statut", [(dict(Voyage.STATUT).get(k, k), v) for k, v in _compter(Voyage.objects.all(), "statut")], "#2563EB")
    corps += _barres(f"Départs {horizon} par destination", _compter(deps, "destination")[:10], "#0F2A5C")
    corps += _barres("Voyages par statut de validation", _compter(Voyage.objects.all(), "statut_validation"), "#C9972B")
    if o["details"]:
        nom = lambda v: f"{v.personnel.nom} {v.personnel.prenom}" if v.personnel_id else "?"
        corps += "<p style='margin:8px 0 0;font-weight:700;font-size:12px'>Départs :</p>" + (_liste([f"{nom(v)} — {v.origine} → {v.destination} ({v.date_depart:%d/%m})" for v in deps.select_related("personnel")]) or "<p style='color:#94a3b8'>Aucun.</p>")
        corps += "<p style='margin:8px 0 0;font-weight:700;font-size:12px'>Retours :</p>" + (_liste([f"{nom(v)} — {v.destination} → {v.origine} ({v.date_retour_prevue:%d/%m})" for v in rets.select_related("personnel")]) or "<p style='color:#94a3b8'>Aucun.</p>")
    return _titre("✈️ Mobilité") + corps


def _sec_boutique(o, today):
    from restauration.models import ArticleBoutique
    base = ArticleBoutique.objects.filter(actif=True)
    epuise = base.filter(stock=0)
    faible = base.filter(stock__gt=0, stock__lte=o["seuil_stock"])
    corps = _kpis([("Articles actifs", base.count(), "#0F2A5C"), ("Épuisés", epuise.count(), "#DC2626" if epuise.exists() else "#16A34A"),
                   (f"Stock ≤ {o['seuil_stock']}", faible.count(), "#EA580C")])
    corps += _barres("Articles par catégorie", _compter(base, "categorie")[:10], "#0F2A5C")
    corps += _barres("Stocks les plus bas", [(a.nom, a.stock) for a in base.order_by("stock")[:8]], "#DC2626", pct_total=False)
    if o["details"]:
        corps += _liste([f"{a.nom} — épuisé" for a in epuise] + [f"{a.nom} — {a.stock} {a.unite}" for a in faible])
    return _titre("🛒 Boutique & stock") + corps



# ───────────── Camp Occupancy (même format que le fichier « Camp Occupancy ») ─────────────
def _occupants(jour, today):
    """Personnes hébergées la nuit du `jour` : [(Personnel|None, société_texte)], dédoublonnées."""
    from django.db.models import Q
    from residences.models import OccupationHistory, Batiment
    vus, res = set(), []
    hist = (OccupationHistory.objects.filter(date_arrivee__lte=jour)
            .filter(Q(date_depart__isnull=True) | Q(date_depart__gt=jour)).select_related("personnel"))
    for h in hist:
        cle = ("p", h.personnel_id) if h.personnel_id else ("n", (h.occupant_nom or "").strip().lower())
        if cle in vus:
            continue
        vus.add(cle)
        res.append((h.personnel, h.societe or ""))
    if jour >= today:   # chambres occupées aujourd'hui sans ligne d'historique
        for b in Batiment.objects.filter(statut="Occupé").select_related("personnel"):
            cle = ("p", b.personnel_id) if b.personnel_id else ("n", (b.occupant or "").strip().lower())
            if cle in vus or cle == ("n", ""):
                continue
            vus.add(cle)
            res.append((b.personnel, ""))
    return res


def _camp_occupancy(jour, today):
    """Structure du rapport pour un jour : départements Roxgold / sous-traitants / visiteurs."""
    from residences.models import Departement, Entreprise
    deps = [d.nom for d in Departement.objects.filter(actif=True)]
    ents = {e.nom.lower(): e for e in Entreprise.objects.select_related("departement", "entreprise_mere")}
    cdep = {d: 0 for d in deps}; cdep["Non renseigné"] = 0
    cvis = {d: 0 for d in deps}; cvis["Non renseigné"] = 0
    cent, autres = {}, {}
    def dep_connu(nom):
        nom = (nom or "").strip()
        for d in deps:
            if d.lower() == nom.lower():
                return d
        return "Non renseigné"
    for pers, soc in _occupants(jour, today):
        type_p = pers.type_personnel if pers else ""
        societe = (pers.societe if pers else soc) or ""
        if type_p == "visiteur":
            cvis[dep_connu(pers.departement)] += 1
        elif type_p == "sous_traitant" or (not type_p and societe.strip().lower() in ents and societe.strip().upper() != "ROXGOLD"):
            e = ents.get(societe.strip().lower())
            if e:
                cent[e.pk] = cent.get(e.pk, 0) + 1
            else:
                autres[societe.strip() or "Sous-traitant (société non renseignée)"] = autres.get(societe.strip() or "Sous-traitant (société non renseignée)", 0) + 1
        else:
            cdep[dep_connu(pers.departement if pers else "")] += 1
    lignes_ent = []
    for e in sorted(ents.values(), key=lambda x: (x.entreprise_mere_id is not None, x.departement_id is None, x.nom)):
        if not e.actif and not cent.get(e.pk):
            continue
        n = cent.get(e.pk, 0)
        if e.entreprise_mere_id:
            lib = f"{e.nom} - {e.entreprise_mere.nom}"
        elif e.departement_id:
            lib = f"{e.nom} - ({e.departement.nom})"
        else:
            if not n:
                continue
            lib = e.nom
        lignes_ent.append((lib, n))
    lignes_ent += sorted(autres.items())
    return {"jour": jour, "dep": cdep, "ent": lignes_ent, "vis": cvis}


def _tableau_occ(titre, lignes, total_label=None, o=None):
    ligne = lambda l, n, gras=False: (
        f"<tr><td style='padding:4px 10px;font-size:12.5px;border-bottom:1px solid #e2e8f0;{'font-weight:700;background:#f1f5f9;' if gras else ''}'>{_e(l)}</td>"
        f"<td align='right' style='padding:4px 10px;font-size:12.5px;border-bottom:1px solid #e2e8f0;width:60px;{'font-weight:700;background:#f1f5f9;' if gras else ''}'>{n}</td></tr>")
    corps = "".join(ligne(l, n) for l, n in lignes if not (o and o["masquer_zeros"] and not n))
    if total_label is not None:
        corps += ligne(total_label, sum(n for _, n in lignes), True)
    return (f"<div style='font-size:12px;font-weight:700;color:#fff;background:#0F2A5C;padding:6px 10px;margin-top:12px'>{_e(titre)}</div>"
            f"<table role='presentation' width='100%' cellspacing='0' cellpadding='0' style='border:1px solid #e2e8f0'>{corps}</table>")


def _colonnes(titre, donnees, couleur="#0F2A5C"):
    """Histogramme vertical en tableau HTML (tendance sur N jours)."""
    if not donnees:
        return ""
    mx = max(n for _, n in donnees) or 1
    haut = 90
    cols = "".join(
        f"<td align='center' valign='bottom' style='padding:0 2px'><div style='font-size:10px;font-weight:700;color:#0f172a'>{n}</div>"
        f"<div style='background:{couleur};height:{max(2, round(n / mx * haut))}px;border-radius:3px 3px 0 0'></div>"
        f"<div style='font-size:9px;color:#64748b;margin-top:2px'>{_e(l)}</div></td>" for l, n in donnees)
    return (f"<div style='font-size:12px;font-weight:700;color:#475569;margin:14px 0 4px'>{_e(titre)}</div>"
            f"<table role='presentation' width='100%' cellspacing='0' cellpadding='0'><tr>{cols}</tr></table>")


def _sec_occupation(o, today):
    jour = today - datetime.timedelta(days=1) if o["jour_reference"] == "hier" else today
    d = _camp_occupancy(jour, today)
    t_dep = sum(d["dep"].values()); t_ent = sum(n for _, n in d["ent"]); t_vis = sum(d["vis"].values())
    total = t_dep + t_ent + t_vis
    corps = (f"<div style='text-align:center;margin-bottom:6px'><div style='font-size:11px;color:#64748b;letter-spacing:1px'>ROXGOLD SANGO</div>"
             f"<div style='font-size:16px;font-weight:700;color:#0F2A5C'>Camp Occupancy</div>"
             f"<div style='font-size:12px;color:#64748b'>{jour:%d/%m/%Y}</div></div>")
    corps += _kpis([("Total camp", total, "#0F2A5C"), ("Employés Roxgold", t_dep, "#2563EB"), ("Sous-traitants", t_ent, "#C9972B"), ("Visiteurs", t_vis, "#7C3AED")])
    if o["occ_graphiques"]:
        corps += _barres("Répartition du camp", [("Employés Roxgold", t_dep), ("Sous-traitants", t_ent), ("Visiteurs", t_vis)],
                         lambda l: {"Employés Roxgold": "#2563EB", "Sous-traitants": "#C9972B"}.get(l, "#7C3AED"))
        if o["occ_departements"]:
            corps += _barres("Employés Roxgold par département", list(d["dep"].items()), "#2563EB", pct_total=False)
        if o["occ_soustraitants"]:
            corps += _barres("Sous-traitants (top 10)", sorted(d["ent"], key=lambda x: -x[1])[:10], "#C9972B", pct_total=False)
        if o["occ_visiteurs"]:
            corps += _barres("Visiteurs par département", list(d["vis"].items()), "#7C3AED", pct_total=False)
    if o["occ_tendance"]:
        serie = []
        for i in range(o["jours_tendance"] - 1, -1, -1):
            j = jour - datetime.timedelta(days=i)
            x = _camp_occupancy(j, today)
            serie.append((f"{j:%d/%m}", sum(x["dep"].values()) + sum(n for _, n in x["ent"]) + sum(x["vis"].values())))
        corps += _colonnes(f"Occupation du camp — {o['jours_tendance']} derniers jours", serie)
    if o["occ_departements"]:
        corps += _tableau_occ("Dept.", [(k, v) for k, v in d["dep"].items() if k != "Non renseigné" or v], "Total", o)
    if o["occ_soustraitants"]:
        corps += _tableau_occ("Main Contractors / Casual Visitors", d["ent"], None, o)
    if o["occ_visiteurs"]:
        corps += _tableau_occ("Visitors", [(f"Visitors {k}", v) for k, v in d["vis"].items() if k != "Non renseigné" or v], None, o)
    corps += (f"<table role='presentation' width='100%' cellspacing='0' cellpadding='0' style='margin-top:10px'><tr>"
              f"<td style='padding:8px 10px;background:#0F2A5C;color:#fff;font-weight:700;font-size:13px'>Total Daily Camp Occupancy</td>"
              f"<td align='right' style='padding:8px 10px;background:#0F2A5C;color:#fff;font-weight:700;font-size:13px;width:60px'>{total}</td></tr></table>")
    return _titre("🏕️ Camp Occupancy") + corps

SECTIONS = {"residences": _sec_residences, "occupation": _sec_occupation, "maintenance": _sec_maintenance, "mobilite": _sec_mobilite, "boutique": _sec_boutique}


def generer_contenu_rapport(nom, type_rapport="synthese", options=None):
    o = options_effectives(options)
    today = timezone.localtime(timezone.now()).date()
    if type_rapport == "residences":
        cles = ["residences", "occupation"]
    else:
        cles = list(SECTIONS) if type_rapport not in SECTIONS else [type_rapport]
    corps = "".join(SECTIONS[c](o, today) for c in cles)
    sujet = f"📊 {nom} — {today:%d/%m/%Y}"
    html = f"""
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
      <div style="background:#0F2A5C;color:#fff;padding:20px;border-radius:10px 10px 0 0">
        <h2 style="margin:0">{_e(nom)}</h2>
        <p style="margin:4px 0 0;opacity:.8">Roxgold SiteLife — {today:%d/%m/%Y}</p>
      </div>
      <div style="border:1px solid #e2e8f0;border-top:none;border-radius:0 0 10px 10px;padding:20px">
        {corps}
        <p style="color:#94a3b8;font-size:11px;margin-top:24px">Rapport généré automatiquement — Roxgold SiteLife</p>
      </div>
    </div>"""
    return sujet, html


def envoyer_aux_destinataires(r):
    """Envoie via le fournisseur email du projet (Resend, réglé dans Paramétrage →
    Connexion par Email — le même que pour les OTP). Retourne (nb_ok, erreurs)."""
    from .email import envoyer_email
    sujet, corps = generer_contenu_rapport(r.nom, r.type_rapport, r.options)
    ok_n, erreurs = 0, []
    for dest in r.destinataires:
        ok, info = envoyer_email(dest, sujet, corps, type_message="rapport", campagne=r.nom)
        if ok:
            ok_n += 1
        else:
            erreurs.append(f"{dest} : {info}")
    return ok_n, erreurs


def envoyer_rapport(r, maintenant=None):
    ok_n, erreurs = envoyer_aux_destinataires(r)
    if not ok_n:
        raise RuntimeError("; ".join(erreurs) or "aucun destinataire")
    r.derniere_execution = maintenant or timezone.localtime(timezone.now())
    r.save(update_fields=["derniere_execution"])


def envoyer_rapports_dus(maintenant=None):
    """Envoie tous les rapports dus. Retourne (envoyes, erreurs)."""
    from .models import RapportPlanifie
    maintenant = maintenant or timezone.localtime(timezone.now())
    envoyes, erreurs = [], []
    from .models import Parametre
    if Parametre.get('email_provider', 'test') == 'test':
        # Mode test = aucun envoi réel : ne rien marquer « envoyé » pour que
        # les rapports partent dès que Resend est activé.
        return envoyes, [("*", "email_provider = test : activer Resend dans Paramétrage")]
    for r in RapportPlanifie.objects.filter(actif=True):
        if not r.est_du(maintenant):
            continue
        try:
            envoyer_rapport(r, maintenant)
            envoyes.append(r.nom)
        except Exception as e:
            erreurs.append((r.nom, str(e)))
    return envoyes, erreurs


def envoyer_si_necessaire(delai=300):
    """Version paresseuse (pas de cron requis) : au plus une vérification / `delai` s."""
    from django.core.cache import cache
    try:
        if not cache.add("rapports_email_throttle", 1, delai):
            return None
        # En arrière-plan : le SMTP ne doit jamais ralentir la requête de l'utilisateur
        import threading
        threading.Thread(target=_dus_silencieux, daemon=True).start()
    except Exception:
        return None


def _dus_silencieux():
    try:
        envoyer_rapports_dus()
    except Exception:
        pass
