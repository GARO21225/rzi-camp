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
