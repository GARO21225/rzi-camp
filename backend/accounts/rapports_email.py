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
    "residences":  "🏠 Résidences & occupation",
    "maintenance": "🛠️ Maintenance & incidents",
    "mobilite":    "✈️ Mobilité (départs / retours)",
    "boutique":    "🛒 Boutique & stock",
}
OPTIONS_DEFAUT = {"horizon_jours": 1, "seuil_stock": 5, "details": False}


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
    return o


def _e(x):
    return _h.escape(str(x if x is not None else ""))


def _liste(items):
    if not items:
        return ""
    return "<ul style='margin:4px 0 0;padding-left:18px;font-size:12.5px;color:#334155'>" + "".join(f"<li>{_e(i)}</li>" for i in items[:30]) + (f"<li>… +{len(items)-30}</li>" if len(items) > 30 else "") + "</ul>"


def _titre(t):
    return f"<h3 style='color:#0F2A5C;font-size:14px;margin:18px 0 4px'>{t}</h3>"


def _sec_residences(o, today):
    from residences.models import Batiment, Personnel
    total = Batiment.objects.count()
    occ = Batiment.objects.filter(statut="Occupé").count()
    libre = Batiment.objects.filter(statut="Libre").count()
    taux = round(occ / total * 100, 1) if total else 0
    actifs = Personnel.objects.filter(actif=True).count()
    corps = f"<p>{occ}/{total} chambres occupées ({taux}%) — {libre} libres — {actifs} personnel actif</p>"
    if o["details"]:
        partants = Batiment.objects.filter(statut="Occupé", date_depart__gte=today, date_depart__lte=today + datetime.timedelta(days=o["horizon_jours"]))
        corps += f"<p style='margin:6px 0 0'>Départs de résidence dans {o['horizon_jours']} j :</p>" + (_liste([f"{b.residence} {b.bloc or ''} — {b.occupant or '?'} (le {b.date_depart:%d/%m})" for b in partants]) or "<p style='color:#94a3b8'>Aucun.</p>")
    return _titre("🏠 Résidences") + corps


def _sec_maintenance(o, today):
    from maintenance.models import Incident
    ouverts = Incident.objects.exclude(statut__in=["resolu", "cloture", "annule"])
    sla = ouverts.filter(sla_depasse=True)
    corps = f"<p>{ouverts.count()} incident(s) ouvert(s)" + (f" dont <b>{sla.count()} en dépassement SLA ⚠️</b>" if sla.exists() else "") + "</p>"
    if o["details"]:
        corps += _liste([f"[{i.priorite}] {i.titre} — {i.residence}{' ⚠️ SLA' if i.sla_depasse else ''}" for i in ouverts.order_by("-sla_depasse", "-date_creation")[:30]])
    return _titre("🛠️ Maintenance") + corps


def _sec_mobilite(o, today):
    from voyages.models import Voyage
    fin = today + datetime.timedelta(days=o["horizon_jours"] - 1)
    deps = Voyage.objects.filter(date_depart__gte=today, date_depart__lte=fin).exclude(statut__in=["annule", "retour"])
    rets = Voyage.objects.filter(date_retour_prevue__gte=today, date_retour_prevue__lte=fin).exclude(statut__in=["annule", "retour"])
    attente = Voyage.objects.filter(statut_validation="en_attente").count()
    horizon = "aujourd'hui" if o["horizon_jours"] == 1 else f"sur {o['horizon_jours']} jours"
    corps = f"<p>{deps.count()} départ(s) {horizon} · {rets.count()} retour(s) attendu(s){f' · <b>{attente} en attente de validation</b>' if attente else ''}</p>"
    if o["details"]:
        nom = lambda v: f"{v.personnel.nom} {v.personnel.prenom}" if v.personnel_id else "?"
        corps += "<p style='margin:6px 0 0'>Départs :</p>" + (_liste([f"{nom(v)} — {v.origine} → {v.destination} ({v.date_depart:%d/%m})" for v in deps.select_related("personnel")]) or "<p style='color:#94a3b8'>Aucun.</p>")
        corps += "<p style='margin:6px 0 0'>Retours :</p>" + (_liste([f"{nom(v)} — {v.destination} → {v.origine} ({v.date_retour_prevue:%d/%m})" for v in rets.select_related("personnel")]) or "<p style='color:#94a3b8'>Aucun.</p>")
    return _titre("✈️ Mobilité") + corps


def _sec_boutique(o, today):
    from restauration.models import ArticleBoutique
    base = ArticleBoutique.objects.filter(actif=True)
    epuise = base.filter(stock=0)
    faible = base.filter(stock__gt=0, stock__lte=o["seuil_stock"])
    corps = f"<p>{epuise.count()} article(s) épuisé(s) · {faible.count()} en stock faible (≤ {o['seuil_stock']})</p>"
    if o["details"]:
        corps += _liste([f"{a.nom} — épuisé" for a in epuise] + [f"{a.nom} — {a.stock} {a.unite}" for a in faible])
    return _titre("🛒 Boutique") + corps


SECTIONS = {"residences": _sec_residences, "maintenance": _sec_maintenance, "mobilite": _sec_mobilite, "boutique": _sec_boutique}


def generer_contenu_rapport(nom, type_rapport="synthese", options=None):
    o = options_effectives(options)
    today = timezone.localtime(timezone.now()).date()
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
