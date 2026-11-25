"""
Libère les chambres « fantômes » : occupées par une personne dont la fiche a été SUPPRIMÉE.

Avant le correctif de PersonnelViewSet.destroy, supprimer une fiche retirait seulement le lien
(personnel_id) : la chambre gardait le statut et le nom affiché (« LE VIP BAHI », Occupé…).

Reconnu avec certitude grâce à l'historique : chambre sans fiche liée, avec un nom affiché, dont
le dernier enregistrement d'historique pointait vers une fiche qui n'existe plus, avec le même nom.
Une chambre où le nom a été saisi à la main (jamais liée à une fiche) n'est PAS touchée.

    python manage.py liberer_chambres_orphelines              # essai à blanc
    python manage.py liberer_chambres_orphelines --confirmer
"""
import datetime

from django.core.management.base import BaseCommand
from django.db import transaction


class Command(BaseCommand):
    help = "Libère les chambres encore occupées par une personne dont la fiche a été supprimée."

    def add_arguments(self, parser):
        parser.add_argument("--confirmer", action="store_true", help="Exécute (sinon : essai à blanc).")

    def handle(self, *args, **o):
        from residences.models import Batiment, Personnel, OccupationHistory
        existants = set(Personnel.objects.values_list("id", flat=True))
        orphelines = []
        for b in Batiment.objects.filter(personnel__isnull=True).exclude(occupant__isnull=True).exclude(occupant=""):
            h = b.history.filter(personnel_id__isnull=False).order_by("-history_date", "-history_id").first()
            if h and h.personnel_id not in existants and (h.occupant or "").strip() == (b.occupant or "").strip():
                orphelines.append(b)
        self.stdout.write(f"Chambres occupées par une fiche supprimée : {len(orphelines)}")
        for b in orphelines:
            self.stdout.write(f"  {b.residence:<8} {b.statut:<12} {b.occupant}")
        if not o["confirmer"]:
            self.stdout.write(self.style.WARNING("Essai à blanc : rien n'a été modifié. Relancez avec --confirmer."))
            return
        with transaction.atomic():
            OccupationHistory.objects.filter(batiment__in=orphelines, date_depart__isnull=True).update(
                date_depart=datetime.date.today(), motif_depart="Fiche personnel supprimée")
            for b in orphelines:
                b.statut, b.occupant, b.societe, b.date_arrivee, b.date_depart = "Libre", None, None, None, None
                b.save()
        self.stdout.write(self.style.SUCCESS(f"{len(orphelines)} chambre(s) libérée(s)."))
