from django.test import TestCase
from django.contrib.auth.models import User
from django.utils import timezone
from rest_framework.test import APIRequestFactory, force_authenticate

from residences.models import Personnel, Batiment
from .models import Evenement, Notification, SimpleNotification, AlerteCampus
from .views import EvenementViewSet


class EvenementNotificationTests(TestCase):
    def setUp(self):
        self.rf = APIRequestFactory()
        self.admin = User.objects.create_superuser("adm", "a@a.com", "pass")
        self.u = User.objects.create_user("arlete", "ar@a.com", "pass")
        self.p = Personnel.objects.create(nom="Arlete", prenom="X", societe="ROXGOLD", numero="EV1", telephone="1", type_personnel="roxgold", user=self.u)
        Batiment.objects.create(residence="E01", bloc="E", statut="Occupé", personnel=self.p)

    def _creer(self, **extra):
        data = {"titre": "Incendie", "description": "Évacuer", "type_event": "alerte",
                "date_debut": timezone.now().isoformat(), **extra}
        req = self.rf.post("/api/evenements/", data, format="json")
        force_authenticate(req, user=self.admin)
        return EvenementViewSet.as_view({"post": "create"})(req)

    def test_creation_notifie_les_residents_et_declenche_la_cloche(self):
        r = self._creer(notifier_residents=True)
        self.assertEqual(r.status_code, 201)
        self.assertEqual(r.data["residents_notifies"], 1)
        self.assertEqual(Notification.objects.filter(personnel=self.p).count(), 1)
        n = SimpleNotification.objects.get(user=self.u)
        self.assertEqual(n.type_notif, "alerte")   # événement d'alerte => notification urgente

    def test_creation_sans_notification_si_refus_explicite(self):
        r = self._creer(notifier_residents=False)
        self.assertEqual(r.status_code, 201)
        self.assertEqual(Notification.objects.count(), 0)

    def test_pulse_expose_la_signature_des_alertes_a_tous(self):
        from rzi_camp.pulse import _calculer
        autre = User.objects.create_user("sansfiche", "s@a.com", "pass")
        avant = _calculer(autre)["alertes"]["sig"]
        AlerteCampus.objects.create(message="Danger", type_alerte="danger", cree_par=self.admin)
        apres = _calculer(autre)["alertes"]["sig"]
        self.assertNotEqual(avant, apres)
