"""
Répare les cas où un personnel a déjà un Voyage validé/en cours
(statut_validation="valide", statut in planifie/en_voyage) alors que sa
chambre (Batiment.statut="Occupé") n'a jamais été libérée.

Cas réel ayant motivé cette commande : la validation d'une Demande de
type "voyage" (page "📝 Demandes") créait le Voyage mais ne touchait
jamais au Batiment — contrairement au Voyage créé depuis confirmer_depart
(relance Dashboard), qui le fait déjà. Les deux chemins ont été corrigés
pour l'avenir (DemandeViewSet.valider appelle maintenant
_cloturer_sejour_personnel), mais les enregistrements déjà coincés AVANT
ce correctif doivent être rattrapés une fois, manuellement : d'où cette
commande, à lancer une seule fois après déploiement.

NE touche PAS à ResidentPrincipal (droit persistant sur la chambre, qui
survit volontairement à un voyage — voir _cloturer_sejour_personnel).

Usage :
    docker compose exec -T backend python manage.py reparer_sejours_bloques
    docker compose exec -T backend python manage.py reparer_sejours_bloques --appliquer
(sans --appliquer : dry-run, affiche ce qui serait corrigé sans rien changer)
"""
import datetime
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = "Libère les chambres restées bloquées malgré un Voyage déjà validé."

    def add_arguments(self, parser):
        parser.add_argument("--appliquer", action="store_true", help="Applique réellement la correction (sinon dry-run).")

    def handle(self, *args, **options):
        from residences.models import Batiment
        from residences.views import _cloturer_sejour_personnel
        from voyages.models import Voyage

        appliquer = options["appliquer"]
        today = datetime.date.today()
        corriges = 0

        occupes = Batiment.objects.filter(statut="Occupé", personnel__isnull=False).select_related("personnel")
        for b in occupes:
            voyage = Voyage.objects.filter(
                personnel=b.personnel, statut_validation="valide", statut__in=["planifie", "en_voyage"],
            ).order_by("-date_depart").first()
            if not voyage:
                continue
            self.stdout.write(
                f"{'[APPLIQUÉ] ' if appliquer else '[DRY-RUN] '}"
                f"{b.personnel.nom} {b.personnel.prenom} — chambre {b.residence} encore Occupée "
                f"malgré le voyage #{voyage.id} (départ {voyage.date_depart}) déjà validé."
            )
            if appliquer:
                date_dep = voyage.date_depart or today
                if voyage.statut != "en_voyage":
                    voyage.partir(date_dep)
                _cloturer_sejour_personnel(b.personnel, date_dep)
            corriges += 1

        if corriges == 0:
            self.stdout.write(self.style.SUCCESS("Aucun cas bloqué trouvé — rien à faire."))
        elif appliquer:
            self.stdout.write(self.style.SUCCESS(f"{corriges} cas corrigé(s)."))
        else:
            self.stdout.write(self.style.WARNING(f"{corriges} cas détecté(s) — relancer avec --appliquer pour corriger."))
