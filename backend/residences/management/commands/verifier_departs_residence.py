"""
Suit la date de depart annoncee d'un resident (champ Batiment.date_depart,
saisie manuellement a l'affectation) et pousse la decision au bon moment,
au lieu de laisser un resident logé indefiniment sans que personne ne
tranche :

  - J-1 (veille du depart) : relance le RESIDENT lui-meme (SimpleNotification
    sur son compte) pour qu'il confirme depuis l'app, via
    BatimentViewSet.confirmer_depart :
      - il part  -> une demande de voyage (Camp -> Abidjan) est creee,
        meme circuit standard que Demandes (validation admin puis
        "A organiser" au Centre de Mobilite, aucun contournement).
      - il reste -> il redefinit lui-meme sa nouvelle date de depart.
    L'admin est aussi informe (notification "info", non urgente) pour
    pouvoir agir a sa place si besoin (cf. demande d'Edgar : "ces
    manoeuvres peuvent etre effectuees par l'admin egalement").

  - Date depassee sans reponse : notifie les ADMINS en alerte (urgent),
    comme avant - filet de secours si le resident n'a pas repondu a la
    relance J-1.

Dans les deux cas, un resident deja pris en charge (voyage actif OU
demande de voyage deja soumise) n'est jamais renotifie - la decision a
deja ete prise ou est deja en cours de traitement.

Concu pour etre declenche par une entree crontab (meme principe que
envoyer_rapports_planifies), pas par un worker permanent. Idempotent :
une meme relance/alerte n'est renvoyee qu'une fois par jour meme si la
commande tourne plusieurs fois.

Exemple de crontab (une fois par jour, a 7h) :
    0 7 * * * cd /opt/stacks/rzi-camp && docker compose exec -T backend python manage.py verifier_departs_residence
"""
import datetime
from django.core.management.base import BaseCommand
from django.contrib.auth.models import User


class Command(BaseCommand):
    help = "Relance le résident à J-1 de son départ annoncé, puis alerte les admins si la date est dépassée sans décision."

    def _deja_pris_en_charge(self, personnel, Voyage, Demande):
        if Voyage.objects.filter(personnel=personnel, statut__in=["planifie", "en_voyage"]).exists():
            return True
        if Demande.objects.filter(
            demandeur=personnel.user, type_demande="voyage", statut__in=["en_attente", "validee", "proposition"],
        ).exists():
            return True
        return False

    def _deja_envoyee_aujourdhui(self, SimpleNotification, today, **kwargs):
        return SimpleNotification.objects.filter(date_envoi__date=today, **kwargs).exists()

    def handle(self, *args, **options):
        from residences.models import Batiment, Demande
        from voyages.models import Voyage
        from evenements.models import SimpleNotification

        today = datetime.date.today()
        demain = today + datetime.timedelta(days=1)
        admins = User.objects.filter(is_staff=True)
        relances, alertes = 0, 0

        # ── J-1 : relance le resident, info l'admin ──
        a_relancer = Batiment.objects.filter(
            statut="Occupé", personnel__isnull=False, date_depart=demain,
        ).select_related("personnel")
        for b in a_relancer:
            if self._deja_pris_en_charge(b.personnel, Voyage, Demande):
                continue
            message = (
                f"Vous deviez partir demain ({b.date_depart.strftime('%d/%m/%Y')}) — "
                f"confirmez-vous votre départ ? Rendez-vous sur Résidences pour répondre : "
                f"départ confirmé (demande de voyage Camp → Abidjan) ou nouvelle date."
            )
            if b.personnel.user_id and not self._deja_envoyee_aujourdhui(
                SimpleNotification, today, user_id=b.personnel.user_id, type_notif="demande", message=message,
            ):
                SimpleNotification.objects.create(
                    user_id=b.personnel.user_id, personnel=b.personnel,
                    titre="🧳 Confirmez-vous votre départ demain ?", message=message, type_notif="demande",
                )
                relances += 1
            message_admin = (
                f"{b.personnel.nom} {b.personnel.prenom} ({b.residence}) part demain "
                f"({b.date_depart.strftime('%d/%m/%Y')}) — relance envoyée au résident. "
                f"Vous pouvez aussi confirmer ou reporter à sa place depuis Résidences."
            )
            if not self._deja_envoyee_aujourdhui(
                SimpleNotification, today, type_notif="info", message=message_admin,
            ):
                for admin in admins:
                    SimpleNotification.objects.create(
                        user=admin, titre="🧳 Départ prévu demain", message=message_admin, type_notif="info",
                    )

        # ── Date depassee sans reponse : alerte admin (filet de secours) ──
        en_retard = Batiment.objects.filter(
            statut="Occupé", personnel__isnull=False, date_depart__lt=today,
        ).select_related("personnel")
        for b in en_retard:
            if self._deja_pris_en_charge(b.personnel, Voyage, Demande):
                continue
            message = (
                f"{b.personnel.nom} {b.personnel.prenom} ({b.residence}) devait partir le "
                f"{b.date_depart.strftime('%d/%m/%Y')} — toujours logé, aucune décision prise depuis "
                f"(relance J-1 restée sans réponse). Confirmez ou reportez à sa place depuis Résidences."
            )
            if self._deja_envoyee_aujourdhui(SimpleNotification, today, type_notif="alerte", message=message):
                continue
            for admin in admins:
                SimpleNotification.objects.create(
                    user=admin, titre="🏠 Départ résidence dépassé — décision requise",
                    message=message, type_notif="alerte",
                )
            alertes += 1

        self.stdout.write(self.style.SUCCESS(
            f"{relances} relance(s) J-1 envoyée(s) aux résidents, {alertes} alerte(s) admin pour départ dépassé."
        ))
