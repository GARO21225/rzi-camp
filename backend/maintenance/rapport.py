"""
Rapport de maintenance — source UNIQUE (email planifié, page Rapports,
bouton « Rapport » de la page Maintenance, impression).

Avant, le rapport complet était généré par le navigateur (JS) et le
rapport email par le serveur avec un autre contenu : les deux ne
disaient pas la même chose. Ici tout est en HTML « compatible email »
(tableaux et styles en ligne, ni SVG ni CSS grid) pour s'afficher à
l'identique dans Outlook/Gmail, à l'écran et à l'impression.

SLA : le drapeau `sla_depasse` n'était recalculé que par l'action
manuelle « Vérifier SLA » ; un incident sans échéance (créé par un
chemin qui ne la renseignait pas) n'était jamais « hors délai ». Le
délai est maintenant évalué ici, à partir des heures paramétrées
(Paramétrage → SLA) : échéance = sla_echeance, ou à défaut
date de création + délai de sa priorité.
"""
import datetime
import html as _h

from django.db.models import F, Q
from django.utils import timezone

from .models import Incident, get_sla_heures

OUVERTS = ("declare", "assigne", "en_cours")
TERMINES = ("resolu", "cloture")
NAVY, NAVY_D, OR = "#0F2A5C", "#081B3D", "#C9972B"
ENCRE, GRIS, BORD = "#0F172A", "#64748B", "#E2E8F0"
STATUTS = [("declare", "Déclaré", "#3B82F6"), ("assigne", "Assigné", "#F97316"), ("en_cours", "En cours", "#EAB308"),
           ("resolu", "Résolu", "#16A34A"), ("cloture", "Clôturé", "#64748B"), ("annule", "Annulé", "#94A3B8")]
PRIOS = [("critique", "Critique", "#DC2626"), ("haute", "Haute", "#F97316"), ("moyenne", "Moyenne", "#CA8A04"), ("basse", "Basse", "#16A34A")]
LIB_STATUT = {k: l for k, l, _ in STATUTS}
COUL_STATUT = {k: c for k, _, c in STATUTS}
LIB_PRIO = {k: l for k, l, _ in PRIOS}
COUL_PRIO = {k: c for k, _, c in PRIOS}
PALETTE = [NAVY, OR, "#2563EB", "#16A34A", "#7C3AED", "#0891B2", "#DC2626", "#DB2777", "#EA580C", "#64748B"]


def _e(x):
    return _h.escape(str(x if x is not None else ""))


# ── SLA ────────────────────────────────────────────────────────────────
def actualiser_sla():
    """Complète les échéances manquantes et met à jour `sla_depasse`
    (incidents ouverts dont l'échéance est passée, incidents résolus après
    l'échéance). Requêtes en masse, sans save() : rapide et sans effet de
    bord. Renvoie les incidents ouverts qui viennent de passer hors délai."""
    maintenant = timezone.now()
    for prio, heures in get_sla_heures().items():
        Incident.objects.filter(sla_echeance__isnull=True, priorite=prio).update(
            sla_echeance=F("date_creation") + datetime.timedelta(hours=heures))
    nouveaux = list(Incident.objects.filter(statut__in=OUVERTS, sla_echeance__lt=maintenant, sla_depasse=False))
    if nouveaux:
        Incident.objects.filter(pk__in=[i.pk for i in nouveaux]).update(sla_depasse=True)
    Incident.objects.filter(statut__in=TERMINES, sla_depasse=False, date_resolution__gt=F("sla_echeance")).update(sla_depasse=True)
    return nouveaux


def actualiser_sla_si_necessaire(delai=60):
    """Au plus une fois par `delai` secondes (appelé depuis les listes et rapports)."""
    try:
        from django.core.cache import cache
        if not cache.add("maintenance_sla_maj", 1, delai):
            return
        nouveaux = actualiser_sla()
        if nouveaux:
            from .views import _notifier
            for inc in nouveaux[:20]:
                _notifier(inc, f"⏰ SLA dépassé — Incident #{inc.id} : {inc.titre}", "relance")
    except Exception:
        pass


def echeance(inc, heures=None):
    if inc.sla_echeance:
        return inc.sla_echeance
    if not inc.date_creation:
        return None
    heures = heures or get_sla_heures()
    return inc.date_creation + datetime.timedelta(hours=heures.get(inc.priorite, 24))


def hors_delai(inc, maintenant=None, heures=None):
    maintenant = maintenant or timezone.now()
    ech = echeance(inc, heures)
    if not ech:
        return bool(inc.sla_depasse)
    if inc.statut in OUVERTS:
        return maintenant > ech
    if inc.statut in TERMINES:
        return bool(inc.sla_depasse) or bool(inc.date_resolution and inc.date_resolution > ech)
    return False


# ── Briques HTML (compatibles email) ──────────────────────────────────
def _duree(h):
    if h is None:
        return "—"
    if h < 1:
        return f"{max(1, round(h * 60))} min"
    if h < 48:
        return f"{h:.1f} h".replace(".", ",")
    return f"{h / 24:.1f} j".replace(".", ",")


def _pct(n, t):
    return round(n / t * 100) if t else 0


def _jour(d):
    if not d:
        return "—"
    d = timezone.localtime(d) if isinstance(d, datetime.datetime) else d
    mois = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."]
    return f"{d.day:02d} {mois[d.month - 1]} {d.year}"


def _jour_court(d):
    return _jour(d).rsplit(" ", 1)[0] if d else "—"


def _section(num, titre, sous=""):
    return (f"<table role='presentation' width='100%' cellspacing='0' cellpadding='0' style='margin:30px 0 14px'><tr>"
            f"<td width='34' valign='middle'><div style='width:30px;height:30px;line-height:30px;border-radius:9px;background:{NAVY};color:{OR};"
            f"font-weight:900;font-size:13px;text-align:center'>{num}</div></td>"
            f"<td valign='middle' style='padding-left:10px'><div style='font-size:17px;font-weight:800;color:{NAVY}'>{titre}</div>"
            + (f"<div style='font-size:11.5px;color:{GRIS}'>{sous}</div>" if sous else "") + "</td></tr></table>")


def _kpis(tuiles):
    cells = "".join(
        f"<td valign='top' width='{100 // len(tuiles)}%' style='padding:6px'>"
        f"<div style='border:1px solid {BORD};border-left:4px solid {c};border-radius:12px;padding:12px 14px;background:#fff'>"
        f"<div style='font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:{GRIS}'>{i} {_e(l)}</div>"
        f"<div style='font-size:28px;font-weight:900;color:{c};line-height:1.1;margin-top:8px'>{_e(v)}</div>"
        f"<div style='font-size:11px;color:{GRIS};margin-top:2px'>{_e(s)}</div></div></td>"
        for i, l, v, s, c in tuiles)
    return f"<table role='presentation' width='100%' cellspacing='0' cellpadding='0' style='margin:0 -6px'><tr>{cells}</tr></table>"


def _jauges(items):
    cells = ""
    for libelle, pct, sous, coul in items:
        cells += (f"<td valign='top' width='{100 // len(items)}%' style='padding:6px'>"
                  f"<div style='border:1px solid {BORD};border-radius:12px;padding:12px 14px;background:#FAFBFD'>"
                  f"<table role='presentation' width='100%' cellspacing='0' cellpadding='0'><tr>"
                  f"<td style='font-size:13px;font-weight:800;color:{ENCRE}'>{_e(libelle)}</td>"
                  f"<td align='right' style='font-size:20px;font-weight:900;color:{coul}'>{'—' if pct is None else f'{pct}%'}</td></tr></table>"
                  f"<div style='background:#E9EEF5;border-radius:99px;height:10px;margin:8px 0 6px;overflow:hidden'>"
                  f"<div style='background:{coul};height:10px;width:{max(0, min(100, pct or 0))}%;border-radius:99px'></div></div>"
                  f"<div style='font-size:11px;color:{GRIS}'>{_e(sous)}</div></div></td>")
    return f"<table role='presentation' width='100%' cellspacing='0' cellpadding='0' style='margin:0 -6px'><tr>{cells}</tr></table>"


def _barres(lignes, vide="Aucune donnée"):
    lignes = [l for l in lignes if l[1]]
    if not lignes:
        return f"<div style='color:#94A3B8;font-size:12px;padding:12px 0;text-align:center'>{vide}</div>"
    mx = max(n for _, n, _ in lignes)
    tot = sum(n for _, n, _ in lignes)
    rows = "".join(
        f"<tr><td style='font-size:11.5px;color:#334155;font-weight:600;padding:4px 10px 4px 0;width:38%;white-space:nowrap;overflow:hidden'>{_e(l)}</td>"
        f"<td style='padding:4px 0'><div style='background:#F1F5F9;border-radius:99px;height:12px'>"
        f"<div style='background:{c};height:12px;border-radius:99px;width:{max(3, round(n / mx * 100))}%'></div></div></td>"
        f"<td align='right' style='font-size:11.5px;font-weight:800;color:{ENCRE};padding:4px 0 4px 10px;width:62px;white-space:nowrap'>{n} "
        f"<span style='color:#94A3B8;font-weight:400;font-size:10.5px'>{_pct(n, tot)}%</span></td></tr>"
        for l, n, c in lignes)
    return f"<table role='presentation' width='100%' cellspacing='0' cellpadding='0'>{rows}</table>"


def _carte(titre, contenu):
    return (f"<div style='border:1px solid {BORD};border-radius:14px;padding:14px 16px;background:#fff'>"
            f"<div style='font-size:11.5px;font-weight:800;color:{NAVY};text-transform:uppercase;letter-spacing:.6px;margin-bottom:10px'>"
            f"<span style='display:inline-block;width:8px;height:8px;border-radius:2px;background:{OR};margin-right:6px'></span>{titre}</div>{contenu}</div>")


def _deux(a, b):
    return (f"<table role='presentation' width='100%' cellspacing='0' cellpadding='0' style='margin:0 -6px'><tr>"
            f"<td valign='top' width='50%' style='padding:6px'>{a}</td><td valign='top' width='50%' style='padding:6px'>{b}</td></tr></table>")


def _badge(texte, c):
    return (f"<span style='display:inline-block;padding:2px 9px;border-radius:99px;font-size:10px;font-weight:700;"
            f"background:{c}1A;color:{c};border:1px solid {c}40;white-space:nowrap'>{_e(texte)}</span>")


def _tableau(entetes, lignes):
    th = "".join(f"<th align='left' style='background:{NAVY};color:#fff;padding:9px 10px;font-size:10px;font-weight:700;"
                 f"text-transform:uppercase;letter-spacing:.6px;white-space:nowrap'>{h}</th>" for h in entetes)
    trs = ""
    for k, cells in enumerate(lignes):
        fond = "#FAFBFD" if k % 2 else "#FFFFFF"
        trs += "<tr>" + "".join(f"<td style='padding:8px 10px;border-top:1px solid #EEF2F7;background:{fond};font-size:11.5px;vertical-align:middle'>{c}</td>" for c in cells) + "</tr>"
    return (f"<table role='presentation' width='100%' cellspacing='0' cellpadding='0' style='border:1px solid {BORD};border-radius:12px;"
            f"border-collapse:separate;overflow:hidden'><thead><tr>{th}</tr></thead><tbody>{trs}</tbody></table>")


def _titre_inc(i):
    lieu = _e(i.residence or "—") + (f" · {_e(i.bloc)}" if i.bloc else "")
    return f"<div style='font-weight:700;color:{ENCRE}'>{_e(i.titre or '—')}</div><div style='color:{GRIS};font-size:10.5px'>📍 {lieu}</div>"


def _nom(u):
    return (u.get_full_name() or u.username) if u else ""


# ── Rapport ──────────────────────────────────────────────────────────
def rapport_html(qs=None, debut=None, fin=None, largeur=980):
    """Rapport complet (fragment HTML autonome, compatible email)."""
    actualiser_sla_si_necessaire()
    def _d(v):
        if isinstance(v, str):
            try:
                return datetime.date.fromisoformat(v[:10])
            except ValueError:
                return None
        return v
    debut, fin = _d(debut), _d(fin)
    qs = (qs if qs is not None else Incident.objects.all()).select_related("assigne_a")
    if debut:
        qs = qs.filter(date_creation__date__gte=debut)
    if fin:
        qs = qs.filter(date_creation__date__lte=fin)
    incidents = list(qs.order_by("date_creation"))
    maintenant = timezone.now()
    heures = get_sla_heures()
    hd = {i.pk: hors_delai(i, maintenant, heures) for i in incidents}

    actifs = [i for i in incidents if i.statut != "annule"]
    ouverts = [i for i in incidents if i.statut in OUVERTS]
    resolus = [i for i in incidents if i.statut in TERMINES]
    crit_ouverts = [i for i in ouverts if i.priorite == "critique"]
    ouverts_hd = [i for i in ouverts if hd[i.pk]]
    resolus_hd = [i for i in resolus if hd[i.pk]]
    non_assignes = [i for i in ouverts if not i.assigne_a_id]
    durees = [(i.date_resolution - i.date_creation).total_seconds() / 3600 for i in resolus if i.date_resolution and i.date_creation]
    duree_moy = sum(durees) / len(durees) if durees else None
    taux_res = _pct(len(resolus), len(actifs))
    taux_sla = _pct(len(resolus) - len(resolus_hd), len(resolus)) if resolus else None
    age_j = lambda i: (maintenant - i.date_creation).days
    plus_ancien = min(ouverts, key=lambda i: i.date_creation) if ouverts else None

    loc = timezone.localtime(maintenant)
    periode = (f"Du {_jour(debut) if debut else 'début'} au {_jour(fin) if fin else 'aujourd’hui'}" if (debut or fin) else "Toute la période")
    ref = f"RM-{loc:%Y%m%d}-{len(incidents):03d}"
    sla_txt = " · ".join(f"{LIB_PRIO[k]} {heures[k]} h" for k, _, _ in PRIOS)

    # Points d'attention
    alertes = []
    if crit_ouverts:
        alertes.append(("🚨", f"{len(crit_ouverts)} incident(s) critique(s) encore ouvert(s)",
                        " · ".join(f"#{i.id} {i.titre} — {i.residence or ''}" for i in crit_ouverts[:4]), "#FEF2F2", "#FECACA"))
    if ouverts_hd:
        alertes.append(("⏰", f"{len(ouverts_hd)} incident(s) ouvert(s) hors délai SLA",
                        " · ".join(f"#{i.id} {i.titre} ({age_j(i)} j)" for i in sorted(ouverts_hd, key=lambda i: i.date_creation)[:4]), "#FEF2F2", "#FECACA"))
    if non_assignes:
        alertes.append(("👷", f"{len(non_assignes)} incident(s) ouvert(s) sans technicien", "Ces dossiers n'ont encore aucun responsable.", "#FFF7ED", "#FED7AA"))
    if plus_ancien and age_j(plus_ancien) >= 3:
        alertes.append(("📅", f"Plus ancien dossier ouvert : {age_j(plus_ancien)} jours",
                        f"#{plus_ancien.id} {plus_ancien.titre} — déclaré le {_jour(plus_ancien.date_creation)}", "#FFF7ED", "#FED7AA"))
    if alertes:
        cases = [f"<td valign='top' width='50%' style='padding:5px'><div style='background:{fd};border:1px solid {bd};border-radius:12px;padding:11px 13px'>"
                 f"<div style='font-weight:800;font-size:12.5px;color:{ENCRE}'>{ic} {_e(t)}</div>"
                 f"<div style='font-size:11px;color:#7C2D12;margin-top:3px'>{_e(s)}</div></div></td>" for ic, t, s, fd, bd in alertes]
        if len(cases) % 2:
            cases.append("<td width='50%'></td>")
        bloc_alertes = ("<table role='presentation' width='100%' cellspacing='0' cellpadding='0' style='margin:0 -5px'>"
                        + "".join(f"<tr>{cases[k]}{cases[k + 1]}</tr>" for k in range(0, len(cases), 2)) + "</table>")
    else:
        bloc_alertes = ("<div style='background:#F0FDF4;border:1px solid #BBF7D0;border-radius:12px;padding:13px 15px;color:#166534;font-weight:700'>"
                        "✅ Aucun point bloquant : pas d'incident critique ouvert ni de dossier hors délai.</div>")

    # Répartitions
    def compte(cle):
        m = {}
        for i in incidents:
            k = cle(i)
            if k:
                m[k] = m.get(k, 0) + 1
        return sorted(m.items(), key=lambda x: -x[1])
    lib_cat = dict(Incident.CATEGORIE)
    par_statut = [(l, sum(1 for i in incidents if i.statut == k), c) for k, l, c in STATUTS]
    par_prio = [(l, sum(1 for i in incidents if i.priorite == k), c) for k, l, c in PRIOS]
    par_cat = [(lib_cat.get(k, k), n, PALETTE[j % len(PALETTE)]) for j, (k, n) in enumerate(compte(lambda i: i.categorie)[:8])]
    par_lieu = [(k, n, OR) for k, n in compte(lambda i: f"{i.residence}{' · ' + i.bloc if i.bloc else ''}" if i.residence else None)[:8]]

    # Évolution (semaines si ≤ 10 semaines, sinon mois)
    evolution = []
    if incidents:
        d0 = timezone.localtime(incidents[0].date_creation).date()
        d1 = loc.date()
        if (d1 - d0).days <= 70:
            lundi = d0 - datetime.timedelta(days=d0.weekday())
            while lundi <= d1:
                f_ = lundi + datetime.timedelta(days=7)
                n = sum(1 for i in incidents if lundi <= timezone.localtime(i.date_creation).date() < f_)
                r = sum(1 for i in resolus if i.date_resolution and lundi <= timezone.localtime(i.date_resolution).date() < f_)
                evolution.append((f"Sem. {_jour_court(lundi)}", n, r))
                lundi = f_
        else:
            mois = {}
            for i in incidents:
                d = timezone.localtime(i.date_creation)
                mois.setdefault((d.year, d.month), [0, 0])[0] += 1
            for i in resolus:
                if i.date_resolution:
                    d = timezone.localtime(i.date_resolution)
                    if (d.year, d.month) in mois:
                        mois[(d.year, d.month)][1] += 1
            noms = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."]
            evolution = [(f"{noms[m - 1]} {a % 100:02d}", v[0], v[1]) for (a, m), v in sorted(mois.items())][-12:]
    if len(evolution) >= 2:
        mx = max(max(n, r) for _, n, r in evolution) or 1
        rows = "".join(
            f"<tr><td style='font-size:11px;color:{GRIS};padding:3px 10px 3px 0;white-space:nowrap;width:22%'>{_e(l)}</td>"
            f"<td style='padding:3px 0'><div style='background:{NAVY};height:9px;border-radius:99px;width:{max(2, round(n / mx * 100)) if n else 0}%'></div>"
            f"<div style='background:{OR};height:9px;border-radius:99px;margin-top:2px;width:{max(2, round(r / mx * 100)) if r else 0}%'></div></td>"
            f"<td align='right' style='font-size:11px;color:{ENCRE};padding-left:10px;white-space:nowrap;width:70px'><b>{n}</b> / <span style='color:{OR};font-weight:700'>{r}</span></td></tr>"
            for l, n, r in evolution)
        bloc_evol = (f"<table role='presentation' width='100%' cellspacing='0' cellpadding='0'>{rows}</table>"
                     f"<div style='font-size:11px;color:{GRIS};margin-top:8px'><span style='display:inline-block;width:10px;height:10px;border-radius:3px;background:{NAVY}'></span> Déclarés "
                     f"&nbsp; <span style='display:inline-block;width:10px;height:10px;border-radius:3px;background:{OR}'></span> Résolus</div>")
    else:
        bloc_evol = f"<div style='color:#94A3B8;font-size:12px;padding:12px 0;text-align:center'>Période trop courte pour une tendance</div>"

    # Intervenants
    techs = {}
    for i in incidents:
        if not i.assigne_a_id:
            continue
        t = techs.setdefault(i.assigne_a_id, {"nom": _nom(i.assigne_a), "total": 0, "res": 0, "cours": 0, "sla": 0, "h": []})
        t["total"] += 1
        if i.statut in TERMINES:
            t["res"] += 1
            t["sla"] += 0 if hd[i.pk] else 1
            if i.date_resolution:
                t["h"].append((i.date_resolution - i.date_creation).total_seconds() / 3600)
        elif i.statut in OUVERTS:
            t["cours"] += 1
    lignes_tech = []
    for t in sorted(techs.values(), key=lambda t: -t["total"]):
        tx = _pct(t["res"], t["total"])
        lignes_tech.append([
            f"<b style='color:{ENCRE}'>👷 {_e(t['nom'])}</b>", f"<b>{t['total']}</b>", t["cours"], t["res"],
            f"<div style='background:#F1F5F9;border-radius:99px;height:6px;width:80px;display:inline-block;vertical-align:middle'>"
            f"<div style='background:{OR};height:6px;border-radius:99px;width:{tx}%'></div></div> <b>{tx}%</b>",
            _duree(sum(t["h"]) / len(t["h"]) if t["h"] else None),
            (f"<b style='color:{'#16A34A' if t['sla'] == t['res'] else '#DC2626'}'>{_pct(t['sla'], t['res'])}%</b>" if t["res"] else "—"),
        ])

    ordre_p = {k: n for n, (k, _, _) in enumerate(PRIOS)}
    ouverts_tries = sorted(ouverts, key=lambda i: (ordre_p.get(i.priorite, 9), i.date_creation))
    lignes_ouv = []
    for i in ouverts_tries[:40]:
        ech = echeance(i, heures)
        sla = (f"<b style='color:#DC2626'>⚠️ Dépassé</b><div style='font-size:10px;color:{GRIS}'>depuis le {_jour_court(ech)}</div>" if hd[i.pk]
               else f"<b style='color:#16A34A'>✓ {_jour_court(ech)}</b>")
        lignes_ouv.append([f"<span style='color:#94A3B8;font-family:monospace'>#{i.id}</span>", _titre_inc(i), _e(lib_cat.get(i.categorie, i.categorie)),
                           _badge(LIB_PRIO.get(i.priorite, i.priorite), COUL_PRIO.get(i.priorite, GRIS)),
                           _badge(LIB_STATUT.get(i.statut, i.statut), COUL_STATUT.get(i.statut, GRIS)),
                           _e(_nom(i.assigne_a)) if i.assigne_a_id else "<b style='color:#DC2626'>Non assigné</b>",
                           f"<span style='white-space:nowrap'>{_jour_court(i.date_creation)}</span>", f"<b>{age_j(i)} j</b>", sla])

    recents = sorted([i for i in resolus if i.date_resolution], key=lambda i: i.date_resolution, reverse=True)[:12]
    lignes_res = [[f"<span style='color:#94A3B8;font-family:monospace'>#{i.id}</span>",
                   _titre_inc(i) + (f"<div style='color:{GRIS};font-size:10.5px'>{_e(str(i.commentaire_resolution)[:90])}</div>" if i.commentaire_resolution else ""),
                   _e(_nom(i.assigne_a) or "—"), f"<span style='white-space:nowrap'>{_jour(i.date_resolution)}</span>",
                   _duree((i.date_resolution - i.date_creation).total_seconds() / 3600),
                   "<b style='color:#DC2626'>Dépassé</b>" if hd[i.pk] else "<b style='color:#16A34A'>Respecté</b>"] for i in recents]

    puce = lambda v, l: f"<span style='display:inline-block;background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.2);border-radius:99px;padding:5px 12px;font-size:11.5px;font-weight:600;margin:0 6px 6px 0'><b style='color:{OR}'>{v}</b> {l}</span>"
    num = 6
    html = f"""
<div style="font-family:'Segoe UI',Arial,sans-serif;color:{ENCRE};max-width:{largeur}px;margin:0 auto;background:#fff;font-size:12.5px;line-height:1.45">
  <div style="background:{NAVY_D};background-image:linear-gradient(135deg,{NAVY_D} 0%,{NAVY} 60%,#1E3A8A 100%);color:#fff;padding:28px 32px 24px;border-radius:14px 14px 0 0">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr>
      <td valign="top"><table role="presentation" cellspacing="0" cellpadding="0"><tr>
        <td><div style="width:44px;height:44px;line-height:44px;border-radius:12px;background:{OR};color:{NAVY_D};font-weight:900;font-size:20px;text-align:center">R</div></td>
        <td style="padding-left:12px"><div style="font-size:15px;font-weight:800">Roxgold SiteLife</div><div style="font-size:11px;opacity:.7">Camp résidentiel · Sango, Côte d'Ivoire</div></td>
      </tr></table></td>
      <td valign="top" align="right" style="font-size:11px;opacity:.9;line-height:1.6">Référence <b style="color:{OR};font-family:monospace">{ref}</b><br>Édité le {_jour(loc)} à {loc:%H:%M}</td>
    </tr></table>
    <div style="font-size:32px;font-weight:900;letter-spacing:-.5px;margin-top:22px">Rapport de <span style="color:{OR}">maintenance</span></div>
    <div style="font-size:13px;opacity:.85;margin-top:4px">{_e(periode)} · interventions, délais et performance des équipes</div>
    <div style="margin-top:16px">{puce(len(incidents), 'incident(s)')}{puce(len(ouverts), 'ouvert(s)')}{puce(len(ouverts_hd), 'hors délai')}{puce(len(techs), 'intervenant(s)')}</div>
  </div>
  <div style="height:5px;background:{OR}"></div>
  <div style="padding:4px 26px 26px;border:1px solid {BORD};border-top:none;border-radius:0 0 14px 14px">

  {_section(1, "Synthèse de la période", "Les indicateurs clés en un coup d'œil")}
  {_kpis([("📋", "Incidents", len(incidents), f"{len(actifs)} hors annulés", NAVY),
          ("🔧", "En cours", len(ouverts), f"{len(crit_ouverts)} critique(s) · {len(non_assignes)} non assigné(s)", "#EA580C"),
          ("✅", "Résolus", len(resolus), f"{taux_res}% des incidents", "#16A34A"),
          ("⏱️", "Délai moyen", _duree(duree_moy), "déclaration → résolution", "#7C3AED")])}
  {_jauges([("Taux de résolution", taux_res, f"{len(resolus)} sur {len(actifs)} incident(s)", "#16A34A"),
            ("Respect du SLA", taux_sla, "aucun incident résolu" if taux_sla is None else f"{len(resolus) - len(resolus_hd)} résolu(s) dans les délais",
             "#94A3B8" if taux_sla is None else "#16A34A" if taux_sla >= 80 else OR if taux_sla >= 60 else "#DC2626"),
            ("Ouverts hors délai", _pct(len(ouverts_hd), len(ouverts)), f"{len(ouverts_hd)} sur {len(ouverts)} incident(s) ouvert(s)", "#DC2626")])}
  <div style="font-size:11px;color:{GRIS};margin-top:6px">Délais SLA paramétrés : {_e(sla_txt)}</div>

  {_section(2, "Points d'attention", "Ce qui demande une action rapide")}
  {bloc_alertes}

  {_section(3, "Analyse des incidents", "Répartitions et tendance sur la période")}
  {_deux(_carte("Par statut", _barres(par_statut)), _carte("Par priorité", _barres(par_prio)))}
  {_deux(_carte("Par catégorie", _barres(par_cat)), _carte("Lieux les plus touchés", _barres(par_lieu)))}
  <div style="margin-top:6px">{_carte("Évolution — déclarés / résolus", bloc_evol)}</div>

  {_section(4, "Performance des intervenants", "Charge, résolution et respect des délais")}
  {_tableau(["Intervenant", "Assignés", "En cours", "Résolus", "Taux", "Délai moyen", "Dans le SLA"], lignes_tech) if lignes_tech
    else "<div style='color:#94A3B8;font-size:12px;padding:12px 0;text-align:center'>Aucun incident assigné sur la période.</div>"}

  {_section(5, f"Incidents ouverts ({len(ouverts)})", "Classés par priorité puis par ancienneté")}
  {_tableau(["N°", "Incident", "Catégorie", "Priorité", "Statut", "Assigné à", "Déclaré", "Âge", "SLA"], lignes_ouv) if lignes_ouv
    else "<div style='background:#F0FDF4;border:1px solid #BBF7D0;border-radius:12px;padding:13px 15px;color:#166534;font-weight:700'>🎉 Aucun incident ouvert sur la période.</div>"}
  {f"<div style='font-size:11px;color:{GRIS};margin-top:6px'>… et {len(ouverts_tries) - 40} autre(s).</div>" if len(ouverts_tries) > 40 else ""}
"""
    if lignes_res:
        html += _section(num, "Dernières résolutions", "Les interventions terminées le plus récemment")
        html += _tableau(["N°", "Incident", "Intervenant", "Résolu le", "Durée", "SLA"], lignes_res)
        num += 1
    html += _section(num, "Validation", "Visa des responsables")
    html += ("<table role='presentation' width='100%' cellspacing='0' cellpadding='0' style='margin:0 -6px'><tr>"
             + "".join(f"<td width='50%' style='padding:6px'><div style='border:1px dashed #CBD5E1;border-radius:12px;padding:12px 14px;height:80px'>"
                       f"<div style='font-size:11px;text-transform:uppercase;letter-spacing:.6px;color:{NAVY};font-weight:800'>{t}</div>"
                       f"<div style='font-size:10.5px;color:#94A3B8;margin-top:44px'>Nom, date et signature</div></div></td>"
                       for t in ("Responsable maintenance", "Camp Boss / Direction")) + "</tr></table>")
    html += (f"<div style='margin-top:20px;padding-top:12px;border-top:1px solid {BORD};font-size:10.5px;color:#94A3B8'>"
             f"<b style='color:{NAVY}'>Roxgold SiteLife</b> · Rapport de maintenance · {ref} · généré automatiquement le {loc:%d/%m/%Y à %H:%M}</div>"
             "</div></div>")
    return html


def resume_html(qs=None):
    """Résumé court pour la synthèse générale (mêmes règles SLA que le rapport complet)."""
    actualiser_sla_si_necessaire()
    qs = qs if qs is not None else Incident.objects.all()
    maintenant = timezone.now()
    heures = get_sla_heures()
    ouverts = list(qs.filter(statut__in=OUVERTS))
    hd = [i for i in ouverts if hors_delai(i, maintenant, heures)]
    il_y_a_7 = maintenant - datetime.timedelta(days=7)
    nouveaux = qs.filter(date_creation__gte=il_y_a_7).count()
    resolus = qs.filter(date_resolution__gte=il_y_a_7).count()
    return _kpis([("🔧", "Ouverts", len(ouverts), f"{sum(1 for i in ouverts if i.priorite == 'critique')} critique(s)", NAVY),
                  ("⏰", "Hors délai SLA", len(hd), "incidents ouverts", "#DC2626" if hd else "#16A34A"),
                  ("📥", "Nouveaux (7 j)", nouveaux, "déclarés", "#EA580C"),
                  ("✅", "Résolus (7 j)", resolus, "terminés", "#16A34A")])
