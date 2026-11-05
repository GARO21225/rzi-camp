from django.core.cache import cache
from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient


class PulseTests(TestCase):
    def test_pulse_authentifie_et_signatures(self):
        u = User.objects.create_user("pu", password="x")
        c = APIClient()
        self.assertEqual(c.get("/api/pulse/").status_code, 401)
        c.force_authenticate(u)
        cache.clear()
        d = c.get("/api/pulse/").json()
        for k in ("notifs", "demandes", "incidents", "plaintes"):
            self.assertIn(k, d)
        from evenements.models import SimpleNotification
        SimpleNotification.objects.create(user=u, titre="x", message="y", type_notif="info")
        cache.clear()
        self.assertEqual(c.get("/api/pulse/").json()["notifs"]["non_lues"], 1)

    def test_message_sur_dossier_et_resto_changent_la_signature(self):
        from rzi_camp.pulse import _calculer
        from maintenance.models import Incident, CommentaireIncident
        u = User.objects.create_user("pu2", password="x")
        inc = Incident.objects.create(titre="t", description="d", categorie="Plomberie", residence="A2", auteur=u)
        avant = _calculer(u)
        self.assertIn("resto", avant)
        CommentaireIncident.objects.create(incident=inc, auteur=u, contenu="photo", type_comment="photo_avant")
        self.assertNotEqual(_calculer(u)["incidents"]["sig"], avant["incidents"]["sig"])
        Incident.objects.filter(pk=inc.pk).update(statut="annule")
        self.assertNotEqual(_calculer(u)["incidents"]["sig"], avant["incidents"]["sig"])


class ClocheNotificationsTests(TestCase):
    """« Tout lire » vide la cloche (compteur à 0, liste des non lues vide), lire une notification
    la retire, et une notification d'ÉVÉNEMENT fait aussi sonner (dernier_ev du pulse)."""

    def setUp(self):
        from residences.models import Personnel
        self.u = User.objects.create_user("cloche", password="x")
        self.p = Personnel.objects.create(nom="YAO", prenom="Kofi", societe="ROXGOLD", user=self.u)
        self.c = APIClient(); self.c.force_authenticate(self.u)
        cache.clear()

    def _non_lues(self):
        d = self.c.get("/api/notifications/compteur/").json()
        return d["non_lues"], [n for n in d["notifications"] if not n["lu"]]

    def test_tout_lire_et_lire_une(self):
        from evenements.models import SimpleNotification
        a = SimpleNotification.objects.create(user=self.u, titre="A", message="a", type_notif="info")
        SimpleNotification.objects.create(user=self.u, titre="B", message="b", type_notif="info")
        n, liste = self._non_lues()
        self.assertEqual((n, len(liste)), (2, 2))
        self.c.post("/api/notifications/lire/", {"id": f"s{a.id}"}, format="json")
        n, liste = self._non_lues()
        self.assertEqual((n, [x["evenement_titre"] for x in liste]), (1, ["B"]))
        self.c.post("/api/notifications/tout_lire/")
        self.assertEqual(self._non_lues(), (0, []))

    def test_notification_evenement_fait_sonner(self):
        import datetime
        from django.utils import timezone
        from evenements.models import Evenement, Notification
        from rzi_camp.pulse import _calculer
        avant = _calculer(self.u)["notifs"]
        e = Evenement.objects.create(titre="Réunion sécurité", date_debut=timezone.now() + datetime.timedelta(days=1))
        Notification.objects.create(evenement=e, personnel=self.p)
        apres = _calculer(self.u)["notifs"]
        self.assertGreater(apres["dernier_ev"], avant["dernier_ev"])
        self.assertEqual(apres["non_lues"], avant["non_lues"] + 1)
