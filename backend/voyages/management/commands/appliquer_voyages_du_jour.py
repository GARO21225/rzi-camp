from django.core.management.base import BaseCommand

from voyages.automatisation import appliquer_voyages_du_jour


class Command(BaseCommand):
    help = "Libère / reloge automatiquement les résidents selon la date de leurs trajets de convoi."

    def handle(self, *args, **opts):
        r = appliquer_voyages_du_jour()
        self.stdout.write(f"départs: {r['departs']} · arrivées: {r['arrivees']} · conflits: {len(r['conflits'])}")
