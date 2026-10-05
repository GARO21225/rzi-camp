import datetime

from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient

from residences.models import Personnel
from evenements.models import SimpleNotification
from .models import Rotation, Voyage, SuiviConvoi, ArretConvoi, EvenementMonteeDescente


class SuiviConvoiTests(TestCase):
    """Parcours complet du suivi en direct : partir -> positions -> arrêt/dépose -> reprendre -> arriver."""

    def setUp(self):
        self.admin = User.objects.create_user("admin", password="x", is_staff=True)
        self.chauffeur_user = User.objects.create_user("chauffeur", password="x")
        self.autre_user = User.objects.create_user("autre", password="x")
        self.chauffeur = Personnel.objects.create(nom="Traoré", prenom="Moussa", societe="ROXGOLD", user=self.chauffeur_user)
        today = datetime.date.today()
        self.rotation = Rotation.objects.create(
            rotation_id="ROT-T1", vehicule="BUS-01", vehicule_matricule="1234AB01",
            conducteur="Moussa Traoré", conducteur_personnel=self.chauffeur,
            origine="Camp Roxgold Sango", destination="Abidjan",
            date_depart=today, date_retour_prevue=today + datetime.timedelta(days=14),
        )
        self.voyages = []
        for i in range(3):
            p = Personnel.objects.create(nom=f"Passager{i}", prenom="P", societe="ROXGOLD")
            self.voyages.append(Voyage.objects.create(
                personnel=p, rotation_id="ROT-T1", destination="Abidjan",
                date_depart=today, date_retour_prevue=today + datetime.timedelta(days=14),
            ))
        self.c = APIClient()

    def url(self, action=""):
        return f"/api/suivi-convois/ROT-T1/{action + '/' if action else ''}"

    def test_parcours_complet(self):
        self.c.force_authenticate(self.chauffeur_user)
        r = self.c.get("/api/suivi-convois/mes_convois/")
        self.assertEqual(r.status_code, 200)
        self.assertEqual([x["rotation_id"] for x in r.data], ["ROT-T1"])

        # Une position avant le départ est refusée
        self.assertEqual(self.c.post(self.url("position"), {"latitude": 9.1, "longitude": -5.1}, format="json").status_code, 400)

        r = self.c.post(self.url("partir"), {"latitude": 9.10, "longitude": -5.10}, format="json")
        self.assertEqual(r.status_code, 201, r.data)
        self.assertEqual(r.data["suivi"]["nb_a_bord"], 3)
        self.assertTrue(all(v.statut == "en_voyage" for v in Voyage.objects.filter(rotation_id="ROT-T1")))
        self.assertEqual(self.c.post(self.url("partir"), {}, format="json").status_code, 400)

        r = self.c.post(self.url("position"), {"latitude": 8.9, "longitude": -5.0, "vitesse_kmh": 72}, format="json")
        self.assertEqual(r.status_code, 200)

        r = self.c.post(self.url("arret"), {
            "type": "depose", "lieu": "Yamoussoukro", "deposes": [self.voyages[0].id],
        }, format="json")
        self.assertEqual(r.status_code, 201, r.data)
        self.assertEqual(r.data["suivi"]["statut"], "arret")
        self.assertEqual(r.data["suivi"]["nb_a_bord"], 2)
        self.assertEqual(ArretConvoi.objects.get().nb_a_bord, 2)
        self.assertTrue(EvenementMonteeDescente.objects.filter(voyage=self.voyages[0], type_evenement="descente").exists())

        r = self.c.post(self.url("reprendre"), {}, format="json")
        self.assertEqual(r.data["suivi"]["statut"], "en_route")
        self.assertIsNotNone(ArretConvoi.objects.get().fin)

        r = self.c.post(self.url("arriver"), {"latitude": 5.35, "longitude": -4.0}, format="json")
        self.assertEqual(r.data["suivi"]["statut"], "arrive")

        # Admin notifié : départ + arrêt + arrivée
        self.assertEqual(SimpleNotification.objects.filter(user=self.admin).count(), 3)

        # Carte admin
        self.c.force_authenticate(self.admin)
        r = self.c.get("/api/suivi-convois/actifs/")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data[0]["suivi"]["nb_a_bord"], 2)
        self.assertGreaterEqual(len(r.data[0]["suivi"]["trace"]), 1)

    def test_acces_refuse_aux_non_conducteurs(self):
        self.c.force_authenticate(self.autre_user)
        self.assertEqual(self.c.post(self.url("partir"), {}, format="json").status_code, 403)
        self.assertEqual(self.c.get("/api/suivi-convois/actifs/").status_code, 403)
        self.assertEqual(self.c.get("/api/suivi-convois/mes_convois/").data, [])
        self.assertFalse(SuiviConvoi.objects.exists())

    def test_admin_peut_demarrer(self):
        self.c.force_authenticate(self.admin)
        self.assertEqual(self.c.post(self.url("partir"), {}, format="json").status_code, 201)
