"""
Envoie les rapports planifies dont l'heure est arrivee - concu pour etre
declenche par une entree crontab (ex: chaque heure), pas par un worker
permanent (Celery). Idempotent : chaque rapport ne part qu'une fois par
jour meme si la commande tourne plusieurs fois dans la meme heure.

Exemple de crontab (toutes les heures, a la minute 5) :
    5 * * * * cd /opt/stacks/rzi-camp && docker compose exec -T backend python manage.py envoyer_rapports_planifies
"""
from django.core.management.base import BaseCommand
from django.utils import timezone
from django.core.mail import send_mail
from django.conf import settings


class Command(BaseCommand):
    help = "Envoie par email les rapports planifies dont l'heure est arrivee aujourd'hui."

    def handle(self, *args, **options):
        from accounts.models import RapportPlanifie

        maintenant = timezone.localtime(timezone.now())
        rapports = RapportPlanifie.objects.filter(actif=True)
        envoyes = 0

        for r in rapports:
            if not r.est_du(maintenant):
                continue
            try:
                sujet, corps_html = generer_contenu_rapport(r.nom)
                send_mail(
                    subject=sujet,
                    message="",  # version texte brute non fournie, HTML uniquement
                    html_message=corps_html,
                    from_email=settings.DEFAULT_FROM_EMAIL,
                    recipient_list=r.destinataires,
                    fail_silently=False,
                )
                r.derniere_execution = maintenant
                r.save(update_fields=["derniere_execution"])
                envoyes += 1
                self.stdout.write(self.style.SUCCESS(f"Envoyé : {r.nom} -> {r.destinataires}"))
            except Exception as e:
                self.stdout.write(self.style.ERROR(f"Échec pour {r.nom} : {e}"))

        self.stdout.write(f"{envoyes} rapport(s) envoyé(s) sur {rapports.count()} planifié(s) actif(s).")


def generer_contenu_rapport(nom):
    """
    Genere un resume KPI concis (pas le rapport complet imprimable de
    RapportsPage.jsx, qui est genere cote client) - couvre les indicateurs
    les plus utiles pour un coup d'oeil quotidien/hebdomadaire par email.
    """
    from residences.models import Batiment, Personnel
    from maintenance.models import Incident
    from voyages.models import Voyage
    from restauration.models import ArticleBoutique

    today = timezone.localtime(timezone.now()).date()

    total_ch = Batiment.objects.count()
    occ_ch = Batiment.objects.filter(statut="Occupé").count()
    libre_ch = Batiment.objects.filter(statut="Libre").count()

    personnel_actif = Personnel.objects.filter(actif=True).count()

    incidents_ouverts = Incident.objects.exclude(statut__in=["resolu","cloture","annule"]).count()
    incidents_sla_depasse = Incident.objects.filter(sla_depasse=True).exclude(statut__in=["resolu","cloture","annule"]).count()

    voyages_du_jour = Voyage.objects.filter(date_depart=today).exclude(statut="annule").count()
    retours_du_jour = Voyage.objects.filter(date_retour_prevue=today).exclude(statut__in=["annule","retour"]).count()
    voyages_en_attente = Voyage.objects.filter(statut_validation="en_attente").count()

    stock_faible = ArticleBoutique.objects.filter(actif=True, stock__gt=0, stock__lte=5).count()
    stock_epuise = ArticleBoutique.objects.filter(actif=True, stock=0).count()

    taux_occ = round(occ_ch / total_ch * 100, 1) if total_ch else 0

    sujet = f"📊 {nom} — {today.strftime('%d/%m/%Y')}"
    corps_html = f"""
    <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto">
      <div style="background:#0F2A5C;color:#fff;padding:20px;border-radius:10px 10px 0 0">
        <h2 style="margin:0">{nom}</h2>
        <p style="margin:4px 0 0;opacity:.8">Roxgold SiteLife — {today.strftime('%A %d %B %Y')}</p>
      </div>
      <div style="border:1px solid #e2e8f0;border-top:none;border-radius:0 0 10px 10px;padding:20px">
        <h3 style="color:#0F2A5C;font-size:14px">🏠 Résidences</h3>
        <p>{occ_ch}/{total_ch} chambres occupées ({taux_occ}%) — {libre_ch} libres — {personnel_actif} personnel actif</p>

        <h3 style="color:#0F2A5C;font-size:14px">🛠️ Maintenance</h3>
        <p>{incidents_ouverts} incident(s) ouvert(s){f" dont {incidents_sla_depasse} en dépassement SLA ⚠️" if incidents_sla_depasse else ""}</p>

        <h3 style="color:#0F2A5C;font-size:14px">✈️ Mobilité</h3>
        <p>{voyages_du_jour} départ(s) aujourd'hui · {retours_du_jour} retour(s) attendu(s){f" · {voyages_en_attente} en attente de validation" if voyages_en_attente else ""}</p>

        <h3 style="color:#0F2A5C;font-size:14px">🛒 Boutique</h3>
        <p>{stock_epuise} article(s) épuisé(s){f" · {stock_faible} en stock faible" if stock_faible else ""}</p>

        <p style="color:#94a3b8;font-size:11px;margin-top:24px">Rapport généré automatiquement — Roxgold SiteLife</p>
      </div>
    </div>
    """
    return sujet, corps_html
