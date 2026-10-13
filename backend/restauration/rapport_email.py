"""Rendu HTML « email » du tableau de bord restauration — mêmes blocs, mêmes couleurs que la page
Restauration → Tableau de bord (bannière, KPI avec évolution, repas par jour empilés, heatmap,
restaurants, entités, superviseurs, satisfaction, alertes). Tableaux + styles inline uniquement
(les <svg>/<script>/CSS externes sont bloqués par les clients mail)."""
import datetime
import html as _h

NAVY, OR = "#0F2A5C", "#C9972B"
COUL_REPAS = {"petit_dejeuner": "#F97316", "dejeuner": "#2563EB", "diner": "#7C3AED"}
LIB_REPAS = {"petit_dejeuner": "Petit-déjeuner", "dejeuner": "Déjeuner", "diner": "Dîner"}
JOURS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"]


def _e(x):
    return _h.escape(str(x if x is not None else ""))


def _carte(titre, contenu, bord="#E2E8F0", fond="#FFFFFF"):
    return (f"<table role='presentation' width='100%' cellspacing='0' cellpadding='0' style='margin:12px 0;border:1px solid {bord};border-radius:12px;background:{fond}'>"
            f"<tr><td style='padding:14px 16px'><div style='font-size:13px;font-weight:800;color:{NAVY};margin-bottom:8px'>{titre}</div>{contenu}</td></tr></table>")


def _delta(actuel, precedent):
    if not precedent:
        return "<span style='font-size:11px;color:#94A3B8'>pas de période précédente</span>"
    p = round((actuel - precedent) / precedent * 100)
    if p == 0:
        return "<span style='font-size:11px;color:#64748B'>= stable</span>"
    c, f = ("#16A34A", "#DCFCE7") if p > 0 else ("#DC2626", "#FEE2E2")
    return f"<span style='font-size:11px;font-weight:800;color:{c};background:{f};border-radius:99px;padding:2px 8px'>{'▲' if p > 0 else '▼'} {abs(p)} %</span>"


def _kpi(label, valeur, couleur, sous=""):
    return (f"<td valign='top' style='background:#F8FAFC;border:1px solid #E2E8F0;border-top:4px solid {couleur};border-radius:10px;padding:10px 12px;width:33%'>"
            f"<div style='font-size:10.5px;color:#64748B;text-transform:uppercase;letter-spacing:.6px;font-weight:700'>{_e(label)}</div>"
            f"<div style='font-size:26px;font-weight:900;color:{couleur};line-height:1.15'>{_e(valeur)}</div>"
            f"<div style='margin-top:3px'>{sous}</div></td>")


def _grille_kpis(kpis):
    lignes = ""
    for i in range(0, len(kpis), 3):
        morceau = kpis[i:i + 3]
        while len(morceau) < 3:
            morceau.append("<td></td>")
        lignes += "<tr>" + "".join(morceau) + "</tr>"
    return f"<table role='presentation' width='100%' cellspacing='6' cellpadding='0' style='border-collapse:separate;margin:4px -6px'>{lignes}</table>"


def _barres(lignes, couleur, max_n=10):
    lignes = [(l, n) for l, n in lignes if n][:max_n]
    if not lignes:
        return "<div style='font-size:12px;color:#94A3B8'>Aucune donnée</div>"
    mx = max(n for _, n in lignes)
    tot = sum(n for _, n in lignes)
    out = ""
    for l, n in lignes:
        out += (f"<tr><td style='font-size:12px;color:#334155;padding:3px 8px 3px 0;width:34%'>{_e(l)}</td>"
                f"<td style='padding:3px 0;width:44%'><div style='background:{couleur};height:12px;width:{max(3, round(n / mx * 100))}%;border-radius:4px'></div></td>"
                f"<td align='right' style='font-size:12px;font-weight:800;color:#0F172A;padding:3px 0 3px 8px;white-space:nowrap'>{n} <span style='color:#94A3B8;font-weight:400'>({round(n / tot * 100)}%)</span></td></tr>")
    return f"<table role='presentation' width='100%' cellspacing='0' cellpadding='0' style='table-layout:fixed'>{out}</table>"


def _jours_empiles(serie):
    serie = serie[-31:]
    mx = max((x["total"] for x in serie), default=0) or 1
    haut = 110
    cols = ""
    for x in serie:
        segs = ""
        for k in ("diner", "dejeuner", "petit_dejeuner"):   # du haut vers le bas
            h = round(x[k] / mx * haut)
            if h:
                segs += f"<div style='background:{COUL_REPAS[k]};height:{h}px;font-size:1px;line-height:1px'>&nbsp;</div>"
        vide = "<div style='height:2px;background:#E2E8F0'></div>"
        cols += (f"<td align='center' valign='bottom' style='padding:0 1px'>"
                 f"<div style='font-size:9.5px;font-weight:800;color:#0F172A'>{x['total'] or ''}</div>{segs or vide}"
                 f"<div style='font-size:8.5px;color:#64748B;margin-top:2px'>{x['date'][8:10]}/{x['date'][5:7]}</div></td>")
    legende = "".join(f"<span style='display:inline-block;width:10px;height:10px;border-radius:3px;background:{c};margin:0 4px -1px 10px'></span><span style='font-size:11px;color:#475569'>{LIB_REPAS[k]}</span>" for k, c in COUL_REPAS.items())
    return f"<table role='presentation' width='100%' cellspacing='0' cellpadding='0'><tr>{cols}</tr></table><div style='margin-top:8px'>{legende}</div>"


def _heatmap(serie):
    acc = [{"n": 0, "petit_dejeuner": 0, "dejeuner": 0, "diner": 0} for _ in range(7)]
    for x in serie:
        w = datetime.date.fromisoformat(x["date"]).weekday()
        acc[w]["n"] += 1
        for k in COUL_REPAS:
            acc[w][k] += x[k]
    val = [{k: (a[k] / a["n"] if a["n"] else 0) for k in COUL_REPAS} for a in acc]
    mx = max(1, max(v[k] for v in val for k in COUL_REPAS))
    ent = "".join(f"<th style='font-size:10.5px;color:#64748B;padding:2px'>{LIB_REPAS[k]}</th>" for k in COUL_REPAS)
    lignes = ""
    for i, v in enumerate(val):
        cases = ""
        for k in COUL_REPAS:
            o = v[k] / mx
            if v[k]:
                cases += f"<td align='center' style='background:rgba(15,42,92,{.10 + o * .85:.2f});color:{'#FFFFFF' if o > .5 else '#0F172A'};font-weight:800;font-size:12px;padding:7px 4px;border-radius:6px'>{v[k]:.0f}</td>"
            else:
                cases += "<td align='center' style='background:#F8FAFC;color:#CBD5E1;padding:7px 4px;border-radius:6px'>·</td>"
        lignes += f"<tr><td style='font-size:12px;font-weight:800;color:#475569;padding-right:6px'>{JOURS[i]}</td>{cases}</tr>"
    return f"<table role='presentation' width='100%' cellspacing='3' cellpadding='0' style='border-collapse:separate'><tr><th></th>{ent}</tr>{lignes}</table>"


def _restaurant(r):
    segs = "".join(f"<td style='background:{COUL_REPAS[k]};width:{round(r[k] / r['total'] * 100)}%;height:10px;font-size:1px'>&nbsp;</td>" for k in COUL_REPAS if r["total"] and r[k])
    vide = "<td style='background:#E2E8F0;height:10px'></td>"
    barre = f"<table role='presentation' width='100%' cellspacing='0' cellpadding='0' style='border-radius:5px;overflow:hidden;margin:6px 0'><tr>{segs or vide}</tr></table>"
    sup = ", ".join(r["superviseurs"]) if r["superviseurs"] else "<b style='color:#DC2626'>aucun superviseur</b>"
    return (f"<td valign='top' style='border:1px solid #E2E8F0;border-radius:10px;padding:10px 12px;background:#FFFFFF'>"
            f"<div style='font-size:13px;font-weight:800;color:{NAVY}'>🍽️ {_e(r['nom'])}</div>"
            f"<div style='font-size:24px;font-weight:900;color:{NAVY};line-height:1.2'>{r['total']} <span style='font-size:11px;color:#64748B;font-weight:600'>repas · {r['part']} %</span></div>"
            f"{barre}<div style='font-size:11px;color:#64748B'>🌅 {r['petit_dejeuner']} · ☀️ {r['dejeuner']} · 🌙 {r['diner']}</div>"
            f"<div style='font-size:11px;color:#475569;margin-top:4px'>👨‍🍳 {sup}</div></td>")


def html_dashboard(d, o, libelle_periode, quand):
    """d = sortie de restauration.rapport.agreger ; o = options effectives du rapport planifié."""
    sat = d["satisfaction"]
    prec = d["precedent"]
    bandeau = (f"<table role='presentation' width='100%' cellspacing='0' cellpadding='0' style='background:{NAVY};border-radius:14px'>"
               f"<tr><td style='padding:16px 18px'><div style='font-size:11px;letter-spacing:1.4px;color:#E3B23C;font-weight:800'>TABLEAU DE BORD RESTAURATION</div>"
               f"<div style='font-size:20px;font-weight:900;color:#FFFFFF;margin-top:2px'>{_e(libelle_periode)}</div>"
               f"<div style='font-size:12px;color:#BFD0F0;margin-top:2px'>{_e(quand)}</div></td>"
               f"<td align='right' style='padding:16px 18px'><div style='font-size:38px;font-weight:900;color:#FFFFFF;line-height:1'>{d['total']}</div>"
               f"<div style='font-size:11px;color:#BFD0F0'>repas servis</div></td></tr></table>")
    kpis = [
        _kpi("Repas servis", d["total"], NAVY, _delta(d["total"], prec["total"])),
        _kpi("Moyenne / jour", d["moyenne_par_jour"], "#2563EB", f"<span style='font-size:11px;color:#64748B'>{d['moyenne_jour_actif']} par jour actif</span>"),
        _kpi("Personnes distinctes", d["personnes_uniques"], "#16A34A", _delta(d["personnes_uniques"], prec.get("personnes_uniques"))),
        _kpi("Couverture", f"{d['couverture']} %" if d["couverture"] is not None else "—", OR, "<span style='font-size:11px;color:#64748B'>repas / (occupation × 3)</span>"),
        _kpi("Satisfaction", f"{sat['moyenne']}/5" if sat["moyenne"] else "—", "#F59E0B", f"<span style='font-size:11px;color:#64748B'>{sat['nb']} avis</span>"),
        _kpi("Pic", d["pic_jour"]["total"] if d["pic_jour"] else "—", "#7C3AED",
             f"<span style='font-size:11px;color:#64748B'>{d['pic_jour']['date'][8:10]}/{d['pic_jour']['date'][5:7]}</span>" if d["pic_jour"] else ""),
    ]
    out = bandeau + _grille_kpis(kpis)
    if d["alertes"]:
        lig = "".join(f"<div style='font-size:12.5px;color:{'#B91C1C' if a['niveau'] == 'rouge' else '#92400E'};margin:3px 0'>• {_e(a['texte'])}</div>" for a in d["alertes"])
        out += _carte(f"⚠️ À surveiller ({len(d['alertes'])})", lig, bord="#FCD34D", fond="#FFFBEB")
    if not d["total"]:
        return out + "<p style='font-size:12.5px;color:#64748B'>Aucun repas scanné sur la période.</p>"

    if o.get("resto_tendance", True) and d["nb_jours"] > 1:
        out += _carte("📈 Repas par jour", _jours_empiles(d["serie"]))
    if o.get("resto_par_restaurant", True) and d["restaurants"]:
        cartes = [_restaurant(r) for r in d["restaurants"]]
        lignes = ""
        for i in range(0, len(cartes), 2):
            duo = cartes[i:i + 2]
            if len(duo) < 2:
                duo.append("<td></td>")
            lignes += "<tr>" + "".join(duo) + "</tr>"
        out += _carte("🍽️ Par restaurant", f"<table role='presentation' width='100%' cellspacing='6' cellpadding='0' style='border-collapse:separate;margin:-6px'>{lignes}</table>")
    mix = []
    if o.get("resto_par_repas", True):
        mix.append(("Répartition par repas", _barres(d["par_repas"], OR)))
    if d["nb_jours"] > 1:
        mix.append(("🔥 Jour de la semaine × repas (moyenne / jour)", _heatmap(d["serie"])))
    for t, c in mix:
        out += _carte(t, c)
    if o.get("resto_par_entite", True):
        e = d["par_entite"]
        out += _carte("🏢 Par entité", _barres(e["types"], NAVY))
        out += _carte("Employés Roxgold — par département", _barres(e["departements"], "#2563EB"))
        out += _carte("Sous-traitants — par entreprise", _barres(e["soustraitants"], OR, 12))
        out += _carte("Visiteurs — par département", _barres(e["visiteurs"], "#7C3AED"))
    if o.get("resto_par_superviseur", True) and d["superviseurs"]:
        lig = "".join(
            f"<tr><td style='padding:5px 6px;font-size:12.5px;font-weight:700;border-bottom:1px solid #E2E8F0'>{_e(s['nom'])}</td>"
            f"<td style='padding:5px 6px;font-size:12px;color:#64748B;border-bottom:1px solid #E2E8F0'>{_e(', '.join(s['restaurants']) or '—')}</td>"
            f"<td align='right' style='padding:5px 6px;font-size:13px;font-weight:900;color:#7C3AED;border-bottom:1px solid #E2E8F0'>{s['scans']}</td></tr>"
            for s in d["superviseurs"][:12])
        out += _carte("👨‍🍳 Superviseurs", f"<table role='presentation' width='100%' cellspacing='0' cellpadding='0'>{lig}</table>")
    if o.get("resto_par_societe", True) and d["par_societe"]:
        out += _carte("🏭 Par société (top 10)", _barres(d["par_societe"], NAVY))
    if sat["nb"]:
        par = "".join(f"<div style='font-size:12px;color:#334155;margin:2px 0'>{_e(l)} : <b>{m}/5</b> <span style='color:#94A3B8'>({n} avis)</span></div>" for l, m, n in sat["par_repas"])
        bas = "".join(f"<div style='font-size:12px;color:#B91C1C;margin:3px 0'>⭐{a['note']} · {_e(a['repas'])} — {_e(a['commentaire'])}</div>" for a in sat["a_traiter"])
        out += _carte("⭐ Satisfaction des repas", f"<div style='font-size:24px;font-weight:900;color:#F59E0B'>{sat['moyenne']}/5 <span style='font-size:12px;color:#64748B;font-weight:600'>sur {sat['nb']} avis</span></div>{par}"
                      + (f"<div style='font-size:12px;font-weight:800;margin-top:8px;color:#B91C1C'>Avis à traiter</div>{bas}" if bas else ""))
    return out
