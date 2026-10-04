"""
Detecte les residents dont la date de depart (champ Batiment.date_depart,
saisie manuellement a l'affectation) est depassee sans qu'aucune decision
n'ait ete prise depuis : ni voyage/demande de depart cree au Centre de
Mobilite, ni nouvelle date de depart renseignee sur la chambre. Notifie
les admins pour qu'ils tranchent avec le resident :
  - il part -> creer une demande de voyage (itineraire Camp -> Abidjan)
  - il reste -> redefinir une nouvelle date de depart sur la chambre

Concu pour etre declenche par une entree crontab (meme principe que
envoyer_rapports_planifies), pas par un worker permanent. Idempotent :
un meme depart en retard n'est renotifie qu'une fois par jour meme si
la commande tourne plusieurs fois.

Exemple de crontab (une fois par jour, a 7h) :
    0 7 * * * cd /opt/stacks/rzi-camp && docker compose exec -T backend python manage.py verifier_departs_residence
"""
import datetime
from django.core.management.base import BaseCommand
from django.contrib.auth.models import User


class Command(BaseCommand):
    help = "Notifie les admins des departs residence dont la date est depassee sans decision."

    def handle(self, *args, **options):
        from residences.models import Batiment
        from voyages.models import Voyage
        from evenements.models import SimpleNotification

        today = datetime.date.today()
        en_retard = Batiment.objects.filter(
            statut="Occupé", personnel__isnull=False, date_depart__lt=today,
        ).select_related("personnel")

        admins = User.objects.filter(is_staff=True)
        notifies = 0

        for b in en_retard:
            # Deja pris en charge : un voyage/demande actif existe pour ce resident -
            # la decision a ete prise depuis le depart annonce, rien a demander.
            if Voyage.objects.filter(personnel=b.personnel, statut__in=["planifie", "en_voyage"]).exists():
                continue

            message = (
                f"{b.personnel.nom} {b.personnel.prenom} ({b.residence}) devait partir le "
                f"{b.date_depart.strftime('%d/%m/%Y')} — toujours logé, aucune décision prise depuis. "
                f"Pars-tu ? Si oui, envoyer une demande de voyage (Camp → Abidjan) au Centre de Mobilité. "
                f"Si non, redéfinir sa nouvelle date de départ sur la chambre."
            )

            deja_envoyee_aujourdhui = SimpleNotification.objects.filter(
                type_notif="alerte", date_envoi__date=today, message=message,
            ).exists()
            if deja_envoyee_aujourdhui:
                continue

            for admin in admins:
                SimpleNotification.objects.create(
                    user=admin, titre="🏠 Départ résidence dépassé — décision requise",
                    message=message, type_notif="alerte",
                )
            notifies += 1

        self.stdout.write(self.style.SUCCESS(f"{notifies} départ(s) en retard notifié(s) aux admins."))
