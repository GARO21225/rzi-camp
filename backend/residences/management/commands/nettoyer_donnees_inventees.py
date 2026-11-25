"""
Retire UNIQUEMENT les données inventées par `seed_db` (données de démonstration), sans toucher
aux données réelles saisies par les utilisateurs.

    python manage.py nettoyer_donnees_inventees              # essai à blanc : liste, ne supprime rien
    python manage.py nettoyer_donnees_inventees --confirmer  # exécution

Retiré (reconnu à coup sûr) :
  - occupants fictifs des chambres : nom inventé par seed_db (« Toure S. », « Kone B. »…) ET aucune
    fiche personnel liée -> chambre remise « Libre », occupant / société / dates vidés ;
  - statut « Réservé » / « Maintenance » tiré au hasard par seed_db : seulement si l'historique de la
    chambre prouve que PERSONNE ne l'a jamais modifiée depuis sa création par le script ;
  - faux historique d'occupation (noms inventés, aucune fiche liée, enregistré par personne) ;
  - les 6 employés de démonstration (nom + prénom + numéro de téléphone exacts de seed_db) ;
  - les comptes de test agent / resto / technicien / menage (nom affiché exact de seed_db).

Jamais touché : le personnel réel, le compte « admin » (alerte si son mot de passe est encore
admin123), toute chambre modifiée par une personne, les réservations et maintenances réelles,
les voyages, demandes, incidents… Chaque étape a sa propre transaction ; la commande s'arrête
à la première erreur.
"""
from django.contrib.auth.models import User
from django.core.management.base import BaseCommand
from django.db import transaction

NOMS_INVENTES = ["Kouame A.", "Diallo M.", "Kone B.", "Toure S.", "Traore R.", "Bamba K.", "Coulibaly J.", "Ouattara F."]
NOMS_HISTORIQUE_INVENTES = ["Martin K.", "Koffi A.", "Sanogo B.", "Diaby M.", "Kouyate L.", "Yoro G.", "Soro E."]
PERSONNEL_DEMO = [  # (nom, prénom, numéro) exactement comme dans seed_db --demo
    ("ADAMA", "Kouyaté", "0701234567"), ("IGNACE", "Koné", "0709876543"), ("FATOU", "Diallo", "0705551234"),
    ("KOUASSI", "Bamba", "0702223344"), ("MARIE", "Touré", "0708887766"), ("IBRAHIM", "Sanogo", "0703334455"),
]
COMPTES_TEST = {  # login -> (prénom, nom) affichés par seed_db
    "agent": ("Agent", "Terrain"), "resto": ("Agent", "Restauration"),
    "technicien": ("Technicien", "Maintenance"), "menage": ("Agent", "Ménage"),
}


class Command(BaseCommand):
    help = "Retire uniquement les données inventées par seed_db (occupants fictifs, comptes et personnel de démo)."

    def add_arguments(self, parser):
        parser.add_argument("--confirmer", action="store_true", help="Exécute (sinon : essai à blanc).")

    def _jamais_modifiee(self, b):
        """Vrai si l'historique montre que seule la création par le script existe (aucune personne n'a
        modifié la chambre). Sans historique, on ne peut pas savoir : on ne touche pas."""
        h = b.history.all()
        return h.exists() and not h.filter(history_user__isnull=False).exists() and h.count() == 1

    def handle(self, *args, **o):
        from residences.models import Batiment, OccupationHistory, Personnel
        ok = o["confirmer"]

        occupants = list(Batiment.objects.filter(personnel__isnull=True, occupant__in=NOMS_INVENTES))
        statuts = [b for b in Batiment.objects.filter(statut__in=["Réservé", "Maintenance"], personnel__isnull=True)
                   .exclude(occupant__gt="") if self._jamais_modifiee(b)]
        statuts_doute = Batiment.objects.filter(statut__in=["Réservé", "Maintenance"]).exclude(
            pk__in=[b.pk for b in statuts]).count()
        historique = OccupationHistory.objects.filter(
            personnel__isnull=True, enregistre_par__isnull=True,
            occupant_nom__in=NOMS_INVENTES + NOMS_HISTORIQUE_INVENTES)
        # nom + prénom + numéro exacts (comparés en majuscules : la fiche les enregistre en MAJUSCULES)
        demo = {(n.upper(), p.upper(), num) for n, p, num in PERSONNEL_DEMO}
        ids = [p.pk for p in Personnel.objects.filter(numero__in=[d[2] for d in PERSONNEL_DEMO])
               if (p.nom.upper(), p.prenom.upper(), p.numero) in demo]
        perso = Personnel.objects.filter(pk__in=ids)
        comptes = [u for u in User.objects.filter(username__in=COMPTES_TEST, is_superuser=False, is_staff=False)
                   if (u.first_name, u.last_name) == COMPTES_TEST[u.username]]

        self.stdout.write("Données inventées trouvées :")
        self.stdout.write(f"  chambres avec un occupant fictif            {len(occupants):>5}  "
                          + ", ".join(f"{b.residence} ({b.occupant})" for b in occupants[:8]) + (" …" if len(occupants) > 8 else ""))
        self.stdout.write(f"  « Réservé »/« Maintenance » jamais touchés  {len(statuts):>5}  "
                          + ", ".join(b.residence for b in statuts[:12]) + (" …" if len(statuts) > 12 else ""))
        self.stdout.write(f"  faux historique d'occupation                {historique.count():>5}")
        self.stdout.write(f"  personnel de démonstration                  {perso.count():>5}  "
                          + ", ".join(f"{p.nom} {p.prenom}" for p in perso))
        self.stdout.write(f"  comptes de test                             {len(comptes):>5}  " + ", ".join(u.username for u in comptes))
        self.stdout.write(f"\nConservé : {Personnel.objects.exclude(pk__in=perso).count()} fiche(s) personnel réelles, "
                          f"{statuts_doute} chambre(s) « Réservé »/« Maintenance » modifiées par une personne (réelles), "
                          "tous les autres comptes, voyages, demandes, incidents…")
        admin = User.objects.filter(username="admin").first()
        if admin and admin.check_password("admin123"):
            self.stdout.write(self.style.ERROR("\n⚠ Le compte « admin » a encore le mot de passe de test admin123 : "
                                               "changez-le tout de suite (Mon compte → mot de passe)."))
        if not ok:
            self.stdout.write(self.style.WARNING("\nEssai à blanc : rien n'a été modifié. Relancez avec --confirmer."))
            return

        vide = dict(statut="Libre", occupant="", societe="", date_arrivee=None, date_depart=None)
        with transaction.atomic():
            Batiment.objects.filter(pk__in=[b.pk for b in occupants + statuts]).update(**vide)
        self.stdout.write(f"  ✓ {len(occupants) + len(statuts)} chambre(s) libérée(s)")
        with transaction.atomic():
            n = historique.delete()[0]
        self.stdout.write(f"  ✓ faux historique supprimé ({n} ligne(s))")
        with transaction.atomic():
            Batiment.objects.filter(personnel__in=perso).update(personnel=None, **vide)
            n = perso.count(); perso.delete()
        self.stdout.write(f"  ✓ {n} fiche(s) de démonstration supprimée(s)")
        for u in comptes:
            try:
                with transaction.atomic():
                    u.delete()
                self.stdout.write(f"  ✓ compte de test « {u.username} » supprimé")
            except Exception:
                u.is_active = False
                u.set_unusable_password()
                u.save(update_fields=["is_active", "password"])
                self.stdout.write(f"  ✓ compte de test « {u.username} » désactivé (lié à des données, non supprimable)")
        self.stdout.write(self.style.SUCCESS("\nNettoyage terminé : seules les données inventées ont été retirées."))
