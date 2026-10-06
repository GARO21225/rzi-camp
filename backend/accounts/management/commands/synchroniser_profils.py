from django.core.management.base import BaseCommand

from accounts.profils import synchroniser_profils


class Command(BaseCommand):
    help = "Aligne Personnel.profil et Profile.role pour tous les comptes (voir accounts/profils.py)."

    def add_arguments(self, parser):
        parser.add_argument("--dry-run", action="store_true", help="Affiche sans modifier")

    def handle(self, *args, **opts):
        r = synchroniser_profils(appliquer=not opts["dry_run"])
        for d in r["details"]:
            self.stdout.write(d)
        for i in r["ignores"]:
            self.stdout.write(self.style.WARNING(i))
        self.stdout.write(f"rôles mis à jour: {r['role_mis_a_jour']} · profils mis à jour: {r['profil_mis_a_jour']} · inchangés: {r['inchanges']}")
