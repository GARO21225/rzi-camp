"""
Envoie les rapports planifiés dus (idempotent : une fois par jour et par rapport).
Optionnel : le backend les envoie déjà tout seul (hook paresseux) ; un cron reste
possible pour garantir l'envoi même sans aucune connexion :
    5 * * * * cd /opt/stacks/rzi-camp && docker compose exec -T backend python manage.py envoyer_rapports_planifies
"""
from django.core.management.base import BaseCommand
from accounts.rapports_email import envoyer_rapports_dus


class Command(BaseCommand):
    help = "Envoie par email les rapports planifiés dus."

    def handle(self, *args, **options):
        envoyes, erreurs = envoyer_rapports_dus()
        for n in envoyes:
            self.stdout.write(self.style.SUCCESS(f"Envoyé : {n}"))
        for n, e in erreurs:
            self.stdout.write(self.style.ERROR(f"Échec pour {n} : {e}"))
        self.stdout.write(f"{len(envoyes)} envoyé(s), {len(erreurs)} échec(s).")
