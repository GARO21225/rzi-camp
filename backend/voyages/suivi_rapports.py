"""
Rapport de trajet d'un convoi suivi (Ma conduite) : chronologie, distance, durée, complétude des
données GPS, exports CSV et PDF. Tout est calculé côté SERVEUR à partir des positions et
événements enregistrés — jamais depuis des valeurs fournies par le navigateur.
"""
import csv
import io
import math

from django.utils import timezone

PRECISION_MAX_M = 200          # au-delà, le point est jugé trop imprécis pour la distance
TROU_MAX_S = 300               # > 5 min sans point = trou dans la trace
SAUT_MAX_KMH = 220             # segment « impossible » (saut GPS) ignoré dans la distance


def haversine_km(a, b):
    la1, lo1, la2, lo2 = map(math.radians, (a[0], a[1], b[0], b[1]))
    h = math.sin((la2 - la1) / 2) ** 2 + math.cos(la1) * math.cos(la2) * math.sin((lo2 - lo1) / 2) ** 2
    return 2 * 6371.0088 * math.asin(math.sqrt(h))


def distance_trace_km(points):
    """points = [(lat, lng, datetime, precision_m)] triés par date. Distance ESTIMÉE (somme des segments)."""
    total, prec = 0.0, None
    for lat, lng, t, pr in points:
        if pr is not None and pr > PRECISION_MAX_M:
            continue
        if prec is not None:
            d = haversine_km((prec[0], prec[1]), (lat, lng))
            dt = max((t - prec[2]).total_seconds(), 1)
            if d / (dt / 3600) <= SAUT_MAX_KMH:
                total += d
        prec = (lat, lng, t)
    return round(total, 2)


def completude(points, debut, fin):
    """('aucune'|'partielle'|'complete', détail) selon le nombre de points et le plus long trou."""
    if not points:
        return "aucune", "Aucune position GPS enregistrée."
    instants = [debut] + [p[2] for p in points] + [fin]
    trou = max((b - a).total_seconds() for a, b in zip(instants, instants[1:]))
    if trou > TROU_MAX_S:
        return "partielle", f"Trou maximal de {int(trou // 60)} min sans position : distance sous-estimée."
    return "complete", "Trace continue (aucun trou de plus de 5 min)."


def lire_points(suivi):
    return [(p.latitude, p.longitude, p.date_heure, p.precision_m)
            for p in suivi.positions.order_by("date_heure", "id")]


def chronologie(suivi):
    ev = [{"type": "depart", "heure": suivi.depart_at, "lieu": "", "detail": f"Départ — {suivi.nb_passagers_depart} passager(s)",
           "latitude": suivi.depart_latitude, "longitude": suivi.depart_longitude}]
    for a in suivi.arrets.prefetch_related("deposes__voyage__personnel").order_by("debut"):
        deposes = [f"{d.voyage.personnel.prenom} {d.voyage.personnel.nom}".strip() for d in a.deposes.all() if d.voyage.personnel]
        detail = a.note or ""
        if deposes:
            detail = (detail + " · " if detail else "") + "déposés : " + ", ".join(deposes)
        ev.append({"type": f"arret_{a.type_arret}", "libelle": a.get_type_arret_display(), "heure": a.debut, "lieu": a.lieu,
                   "detail": detail, "latitude": a.latitude, "longitude": a.longitude})
        if a.fin:
            ev.append({"type": "reprise", "libelle": "Reprise de la route", "heure": a.fin, "lieu": a.lieu,
                       "detail": f"Arrêt de {int((a.fin - a.debut).total_seconds() // 60)} min", "latitude": a.latitude, "longitude": a.longitude})
    if suivi.arrivee_at:
        ev.append({"type": "arrivee", "libelle": "Arrivée à destination", "heure": suivi.arrivee_at, "lieu": suivi.rotation.destination or "",
                   "detail": "", "latitude": suivi.latitude, "longitude": suivi.longitude})
    ev.sort(key=lambda e: e["heure"])
    return ev


def donnees_rapport(rotation):
    suivi = rotation.suivi
    fin = suivi.arrivee_at or timezone.now()
    points = lire_points(suivi)
    comp, comp_detail = completude(points, suivi.depart_at, fin)
    provisoire = suivi.statut != "arrive"
    distance = suivi.distance_km if (not provisoire and suivi.distance_km is not None) else distance_trace_km(points)
    duree = suivi.duree_s if (not provisoire and suivi.duree_s is not None) else int((fin - suivi.depart_at).total_seconds())
    return {
        "provisoire": provisoire,
        "rotation_id": rotation.rotation_id,
        "statut": suivi.statut,
        "chauffeur": rotation.conducteur or (f"{rotation.conducteur_personnel.prenom} {rotation.conducteur_personnel.nom}" if rotation.conducteur_personnel else ""),
        "vehicule": rotation.vehicule, "vehicule_matricule": rotation.vehicule_matricule,
        "mission": {"origine": rotation.origine, "destination": rotation.destination, "date": str(rotation.date_depart), "motif": getattr(rotation, "motif", "") or ""},
        "depart": {"heure": suivi.depart_at, "latitude": suivi.depart_latitude, "longitude": suivi.depart_longitude},
        "arrivee": {"heure": suivi.arrivee_at, "latitude": suivi.latitude if suivi.arrivee_at else None, "longitude": suivi.longitude if suivi.arrivee_at else None},
        "duree_s": duree,
        "distance_km": distance,
        "distance_estimee": True,
        "nb_positions": len(points),
        "completude": comp, "completude_detail": comp_detail,
        "nb_passagers_depart": suivi.nb_passagers_depart,
        "chronologie": chronologie(suivi),
        "trace": [[p[0], p[1]] for p in points],
        "genere_le": timezone.now(),
    }


def _hms(s):
    s = int(s or 0)
    return f"{s // 3600} h {s % 3600 // 60:02d} min"


def _loc(dt):
    return timezone.localtime(dt).strftime("%d/%m/%Y %H:%M:%S") if dt else ""


def export_csv(rotation):
    suivi = rotation.suivi
    sortie = io.StringIO()
    w = csv.writer(sortie, delimiter=";")
    w.writerow(["type", "horodatage", "latitude", "longitude", "precision_m", "vitesse_kmh", "evenement", "lieu", "detail", "provisoire"])
    prov = "oui" if suivi.statut != "arrive" else "non"
    for p in suivi.positions.order_by("date_heure", "id"):
        w.writerow(["position", _loc(p.date_heure), p.latitude, p.longitude,
                    "" if p.precision_m is None else round(p.precision_m, 1),
                    "" if p.vitesse_kmh is None else round(p.vitesse_kmh, 1), "", "", "", prov])
    for e in chronologie(suivi):
        w.writerow(["evenement", _loc(e["heure"]), e.get("latitude") or "", e.get("longitude") or "", "", "",
                    e.get("libelle") or e["type"], e.get("lieu", ""), e.get("detail", ""), prov])
    return "﻿" + sortie.getvalue()


def export_pdf(rotation):
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import getSampleStyleSheet
    from reportlab.lib.units import mm
    from reportlab.graphics.shapes import Drawing, PolyLine, Circle, Rect, String
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle

    d = donnees_rapport(rotation)
    st = getSampleStyleSheet()
    tampon = io.BytesIO()
    doc = SimpleDocTemplate(tampon, pagesize=A4, leftMargin=15 * mm, rightMargin=15 * mm, topMargin=15 * mm, bottomMargin=15 * mm,
                            title=f"Rapport de trajet {rotation.rotation_id}")
    el = [Paragraph(f"Rapport de trajet — convoi {rotation.rotation_id}", st["Title"])]
    if d["provisoire"]:
        el.append(Paragraph("<font color='#B45309'><b>DONNÉES PROVISOIRES — le trajet n'est pas terminé.</b></font>", st["Normal"]))
    el.append(Spacer(1, 6))
    m = d["mission"]
    info = [
        ["Chauffeur", d["chauffeur"] or "—", "Véhicule", f"{d['vehicule']} {d['vehicule_matricule']}".strip() or "—"],
        ["Mission", f"{m['origine'] or '—'} → {m['destination'] or '—'}", "Date prévue", m["date"]],
        ["Départ", _loc(d["depart"]["heure"]), "Arrivée", _loc(d["arrivee"]["heure"]) or "en cours"],
        ["Durée", _hms(d["duree_s"]), "Distance (estimation)", f"{d['distance_km']} km"],
        ["Passagers au départ", str(d["nb_passagers_depart"]), "Positions GPS", str(d["nb_positions"])],
    ]
    t = Table(info, colWidths=[32 * mm, 55 * mm, 38 * mm, 55 * mm])
    t.setStyle(TableStyle([("GRID", (0, 0), (-1, -1), .4, colors.HexColor("#CBD5E1")), ("FONTSIZE", (0, 0), (-1, -1), 8.5),
                           ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#F1F5F9")), ("BACKGROUND", (2, 0), (2, -1), colors.HexColor("#F1F5F9"))]))
    el += [t, Spacer(1, 4), Paragraph(f"Complétude GPS : <b>{d['completude']}</b> — {d['completude_detail']}", st["Normal"]), Spacer(1, 8)]

    trace = d["trace"]
    if len(trace) >= 2:
        W, H = 175 * mm, 85 * mm
        lats, lngs = [p[0] for p in trace], [p[1] for p in trace]
        la0, la1, lo0, lo1 = min(lats), max(lats), min(lngs), max(lngs)
        k = math.cos(math.radians((la0 + la1) / 2))
        sx = (W - 20) / max((lo1 - lo0) * k, 1e-6)
        sy = (H - 20) / max(la1 - la0, 1e-6)
        s = min(sx, sy)
        proj = lambda p: (10 + (p[1] - lo0) * k * s, 10 + (p[0] - la0) * s)
        dessin = Drawing(W, H)
        dessin.add(Rect(0, 0, W, H, strokeColor=colors.HexColor("#CBD5E1"), fillColor=colors.HexColor("#F8FAFC")))
        pts = [c for p in trace for c in proj(p)]
        dessin.add(PolyLine(pts, strokeColor=colors.HexColor("#16A34A"), strokeWidth=2))
        x, y = proj(trace[0]); dessin.add(Circle(x, y, 4, fillColor=colors.HexColor("#2563EB"), strokeColor=colors.white)); dessin.add(String(x + 6, y + 4, "Départ", fontSize=8))
        x, y = proj(trace[-1]); dessin.add(Circle(x, y, 4, fillColor=colors.HexColor("#DC2626"), strokeColor=colors.white)); dessin.add(String(x + 6, y + 4, "Arrivée" if not d["provisoire"] else "Dernière position", fontSize=8))
        dessin.add(String(6, H - 10, "Tracé GPS (schéma, sans fond de carte)", fontSize=7, fillColor=colors.grey))
        el += [dessin, Spacer(1, 8)]
    else:
        el += [Paragraph("Tracé indisponible : moins de 2 positions GPS enregistrées.", st["Italic"]), Spacer(1, 8)]

    lignes = [["Heure", "Événement", "Lieu", "Détail"]]
    for e in d["chronologie"]:
        lignes.append([_loc(e["heure"]), Paragraph(e.get("libelle") or "Départ", st["BodyText"]), Paragraph(e.get("lieu") or "", st["BodyText"]), Paragraph(e.get("detail") or "", st["BodyText"])])
    tc = Table(lignes, colWidths=[34 * mm, 40 * mm, 38 * mm, 68 * mm], repeatRows=1)
    tc.setStyle(TableStyle([("GRID", (0, 0), (-1, -1), .4, colors.HexColor("#CBD5E1")), ("FONTSIZE", (0, 0), (-1, -1), 8),
                            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0F2A5C")), ("TEXTCOLOR", (0, 0), (-1, 0), colors.white), ("VALIGN", (0, 0), (-1, -1), "TOP")]))
    el += [Paragraph("Chronologie (départ, arrêts, incidents, arrivée)", st["Heading3"]), tc, Spacer(1, 8),
           Paragraph(f"Rapport généré le {_loc(d['genere_le'])} à partir des données enregistrées par le serveur. "
                     "La distance est une estimation calculée sur les positions GPS reçues.", st["Italic"])]
    doc.build(el)
    return tampon.getvalue()
