"""
Vide les données de TEST pour démarrer la phase pilote, en gardant la configuration du camp
et le(s) compte(s) admin désigné(s).

    # 1) Essai à blanc (ne supprime RIEN) : liste ce qui serait vidé et les comptes existants
    python manage.py purger_donnees_test --garder MON_LOGIN

    # 2) Exécution réelle (après ./deploy/backup.sh !)
    python manage.py purger_donnees_test --garder MON_LOGIN --confirmer

GARDÉ (configuration) : chambres et plan SIG (remises « Libre », sans occupant), points d'intérêt,
chemins, départements, entreprises, itinéraires + étapes, types de véhicules, flotte, paramètres,
rôles personnalisés, rapports planifiés, restaurants, questions d'avis, catalogue boutique
(sauf --vider-boutique), contenus d'induction (règles, quiz, infrastructures, formations, sites/zones),
catégories de plaintes, groupes de diffusion, clés VAPID.

VIDÉ (exploitation / test) : tous les comptes sauf --garder, le personnel (sauf celui lié à un compte
gardé), occupations et historiques, résidents principaux, demandes, plaintes, contrôles de chambre,
inductions passées, EPI remis, rotations / voyages / suivi GPS, incidents de maintenance, événements,
notifications, alertes, repas, QR repas, ventes boutique, bons de caisse, menus, avis, journaux
d'audit, codes OTP, SMS, et tout l'historique des modifications (tables Historical*).

Tout se fait dans UNE transaction : en cas d'erreur, rien n'est supprimé.
"""
from django.apps import apps
from django.contrib.auth.models import User
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.db.models import Q

# Chambre à libérer : statut autre que « Libre », ou encore un occupant / une fiche liée
CHAMBRE_NON_LIBRE = ~Q(statut="Libre") | Q(personnel__isnull=False) | Q(occupant__gt="")

# Ordre = enfants avant parents (évite les blocages PROTECT) ; les cascades font le reste.
A_VIDER = [
    # Suivi GPS et convois
    "voyages.DeposeArret", "voyages.RamasseArret", "voyages.ArretConvoi", "voyages.PositionConvoi",
    "voyages.SuiviConvoi", "voyages.EvenementMonteeDescente", "voyages.EtapeVoyage", "voyages.Voyage",
    "voyages.Rotation",
    # Maintenance
    "maintenance.CommentaireIncident", "maintenance.Incident",
    # Restauration / boutique (le catalogue et les restaurants restent)
    "restauration.ReponseAvis", "restauration.AvisRestauration", "restauration.RemboursementBon",
    "restauration.BonCaisse", "restauration.ConsommationBoutique", "restauration.RepasLog",
    "restauration.QRToken", "restauration.MenuJour", "restauration.AuditLog",
    # Événements / notifications
    "evenements.QREvenement", "evenements.Notification", "evenements.SimpleNotification",
    "evenements.AlerteCampus", "evenements.Evenement",
    # Résidences / personnel
    "residences.ControleChambre", "residences.InductionCampRecord", "residences.InductionCampExemption",
    "residences.InductionRecord", "residences.Plainte", "residences.Demande", "residences.ResidentPrincipal",
    "residences.OccupationHistory", "residences.EquipementEPI",
    # Module induction QHSE : dossiers individuels (les formations / quiz / sites restent)
    "induction.WorkflowEvent", "induction.InductionWorkflow", "induction.AccessLog", "induction.AccessBadge",
    "induction.MedicalCheck", "induction.QuizAnswer", "induction.QuizAttempt", "induction.EmployeeTraining",
    "induction.EmployeeDocument", "induction.EmergencyContact", "induction.Employee",
    # Comptes : codes et SMS
    "accounts.CodeOTP", "accounts.SMSMessage",
]

A_GARDER = {
    "accounts.Profile", "accounts.RoleCustom", "accounts.RapportPlanifie", "accounts.Parametre",
    "residences.Departement", "residences.Entreprise", "residences.Personnel", "residences.Batiment",
    "residences.PointInteret", "residences.CheminCirculation", "residences.PlainteCategorie",
    "residences.InductionCampConfig", "residences.InductionInfra", "residences.InductionRegle",
    "residences.InductionQuizQuestion",
    "voyages.ItineraireModele", "voyages.EtapeItineraireModele", "voyages.TypeVehicule", "voyages.VehiculeFlotte",
    "evenements.GroupeDiffusion", "evenements.VapidCle", "evenements.PushSubscription",
    "evenements.AppareilPushNatif",
    "restauration.Restaurant", "restauration.SuperviseurRestaurant", "restauration.QuestionAvis",
    "restauration.ArticleBoutique",
    "induction.Site", "induction.Camp", "induction.Zone", "induction.Contractor", "induction.DocumentType",
    "induction.Training", "induction.TrainingModule", "induction.QuizQuestion", "induction.QuizChoice",
}
APPS_PROJET = ["accounts", "residences", "voyages", "maintenance", "evenements", "restauration", "induction"]


class Command(BaseCommand):
    help = "Vide les données de test (phase pilote) en gardant la configuration du camp et le compte admin."

    def add_arguments(self, parser):
        parser.add_argument("--garder", default="",
                            help="Login(s) des comptes à conserver, séparés par des virgules (au moins un admin).")
        parser.add_argument("--chambres-seulement", action="store_true",
                            help="Libère seulement toutes les chambres (occupants, historiques, résidents principaux).")
        parser.add_argument("--confirmer", action="store_true", help="Exécute réellement la purge (sinon : essai à blanc).")
        parser.add_argument("--vider-boutique", action="store_true",
                            help="Supprime aussi le catalogue Bar & Boutique (articles de démonstration et leurs prix).")

    def _modeles(self):
        """Chaque modèle du projet doit être classé : un nouveau modèle non classé bloque la purge
        (plutôt que d'être oublié en silence ou supprimé par erreur)."""
        classes = set(A_VIDER) | A_GARDER
        non_classes = []
        for app in APPS_PROJET:
            for m in apps.get_app_config(app).get_models():
                label = f"{m._meta.app_label}.{m.__name__}"
                if m.__name__.startswith("Historical"):
                    continue
                if label not in classes:
                    non_classes.append(label)
        if non_classes:
            raise CommandError("Modèles non classés dans purger_donnees_test (à ajouter à A_VIDER ou A_GARDER) : "
                               + ", ".join(non_classes))
        historiques = [m for app in APPS_PROJET for m in apps.get_app_config(app).get_models()
                       if m.__name__.startswith("Historical")]
        return [apps.get_model(l) for l in A_VIDER], historiques

    def _liberer_chambres(self):
        """Libère toutes les chambres, dans sa PROPRE transaction : un échec ailleurs ne l'annule plus."""
        from residences.models import Batiment, ResidentPrincipal, OccupationHistory
        with transaction.atomic():
            ResidentPrincipal.objects.all().delete()          # PROTECT vers Batiment : avant tout
            OccupationHistory.objects.all().delete()
            n = Batiment.objects.filter(CHAMBRE_NON_LIBRE).count()
            Batiment.objects.update(statut="Libre", personnel=None, occupant="", societe="",
                                    date_arrivee=None, date_depart=None)
        reste = Batiment.objects.filter(CHAMBRE_NON_LIBRE).count()
        self.stdout.write(self.style.SUCCESS(f"  Chambres libérées : {n}  (encore occupées : {reste})"))
        return reste

    def handle(self, *args, **o):
        if o["chambres_seulement"]:
            if not o["confirmer"]:
                from residences.models import Batiment
                self.stdout.write(f"Chambres non libres : {Batiment.objects.filter(CHAMBRE_NON_LIBRE).count()} "
                                  f"sur {Batiment.objects.count()}. Essai à blanc : relancez avec --confirmer.")
                return
            self._liberer_chambres()
            return
        garder = [g.strip() for g in o["garder"].split(",") if g.strip()]
        if not garder:
            raise CommandError("Indiquez --garder VOTRE_LOGIN (compte admin à conserver).")
        gardes = list(User.objects.filter(username__in=garder))
        manquants = set(garder) - {u.username for u in gardes}
        self.stdout.write("Comptes existants (★ = admin) :")
        for u in User.objects.order_by("username"):
            admin = u.is_superuser or u.is_staff or getattr(getattr(u, "profile", None), "role", "") == "admin"
            self.stdout.write(f"  {'★' if admin else ' '} {u.username:<24} {'GARDÉ' if u.username in garder else 'supprimé'}")
        if manquants:
            raise CommandError(f"Compte(s) introuvable(s) : {', '.join(sorted(manquants))} — vérifiez le login.")
        if not any(u.is_superuser or u.is_staff or getattr(getattr(u, "profile", None), "role", "") == "admin" for u in gardes):
            raise CommandError("Aucun compte ADMIN parmi --garder : vous ne pourriez plus vous connecter. Purge refusée.")

        a_vider, historiques = self._modeles()
        if o["vider_boutique"]:
            a_vider.append(apps.get_model("restauration.ArticleBoutique"))
        from residences.models import Personnel, Batiment
        perso_gardes = Personnel.objects.filter(user__in=gardes)

        self.stdout.write("\nÀ vider :")
        for m in a_vider:
            n = m._base_manager.count()
            if n:
                self.stdout.write(f"  {str(m._meta.verbose_name_plural):<45} {n:>7}")
        n_hist = sum(m._base_manager.count() for m in historiques)
        self.stdout.write(f"  {'historique des modifications':<45} {n_hist:>7}")
        self.stdout.write(f"  {'personnel (hors comptes gardés)':<45} {Personnel.objects.exclude(pk__in=perso_gardes).count():>7}")
        self.stdout.write(f"  {'comptes utilisateurs (hors --garder)':<45} {User.objects.exclude(pk__in=[u.pk for u in gardes]).count():>7}")
        occupees = Batiment.objects.filter(CHAMBRE_NON_LIBRE).count()
        self.stdout.write(f"  {'chambres remises « Libre » sans occupant':<45} {occupees:>7}  (sur {Batiment.objects.count()}, plan SIG conservé)")

        if not o["confirmer"]:
            self.stdout.write(self.style.WARNING(
                "\nEssai à blanc : RIEN n'a été supprimé. Faites une sauvegarde (./deploy/backup.sh), "
                "puis relancez avec --confirmer."))
            return

        # Chaque étape dans sa propre transaction : sur une base de production (tables ajoutées à la
        # main, contraintes en plus), UNE suppression refusée annulait TOUT, chambres comprises.
        self.stdout.write("\nExécution :")
        reste = self._liberer_chambres()
        echecs = []

        def etape(libelle, fn):
            try:
                with transaction.atomic():
                    fn()
            except Exception as e:
                echecs.append(libelle)
                self.stdout.write(self.style.ERROR(f"  ÉCHEC {libelle} : {type(e).__name__}: {e}"))

        for m in a_vider:
            etape(str(m._meta.verbose_name_plural), lambda m=m: m._base_manager.all().delete())
        etape("personnel", lambda: Personnel.objects.exclude(pk__in=perso_gardes).delete())
        etape("comptes utilisateurs", lambda: User.objects.exclude(pk__in=[u.pk for u in gardes]).delete())
        for m in historiques:
            etape(str(m._meta.verbose_name_plural), lambda m=m: m._base_manager.all().delete())
        # Les échecs ont pu venir d'un ordre défavorable : un second passage règle la plupart des cas.
        if echecs:
            self.stdout.write("  Second passage pour les étapes en échec…")
            premiers, echecs[:] = list(echecs), []
            for m in a_vider + historiques:
                if str(m._meta.verbose_name_plural) in premiers:
                    etape(str(m._meta.verbose_name_plural), lambda m=m: m._base_manager.all().delete())
            if "personnel" in premiers:
                etape("personnel", lambda: Personnel.objects.exclude(pk__in=perso_gardes).delete())
            if "comptes utilisateurs" in premiers:
                etape("comptes utilisateurs", lambda: User.objects.exclude(pk__in=[u.pk for u in gardes]).delete())
            reste = self._liberer_chambres()

        if "comptes utilisateurs" in echecs:
            # Comptes impossibles à supprimer (table externe qui les référence) : au minimum, ils ne
            # doivent plus pouvoir se connecter (comptes de test aux mots de passe connus).
            n = 0
            for u in User.objects.exclude(pk__in=[u.pk for u in gardes]):
                u.is_active = False
                u.set_unusable_password()
                u.save(update_fields=["is_active", "password"])
                n += 1
            self.stdout.write(self.style.WARNING(f"  {n} compte(s) non supprimable(s) DÉSACTIVÉ(S) (connexion impossible)."))

        if echecs or reste:
            self.stdout.write(self.style.WARNING(
                f"\nPurge PARTIELLE : {', '.join(echecs) or 'chambres'} non vidé(s). Envoyez ce message d'erreur."))
        else:
            self.stdout.write(self.style.SUCCESS(
                f"\nPurge terminée. Comptes conservés : {', '.join(u.username for u in gardes)}. "
                "Configuration du camp intacte, toutes les chambres libres."))
