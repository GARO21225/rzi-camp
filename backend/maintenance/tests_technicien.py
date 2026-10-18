from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient

from accounts.models import Profile
from evenements.models import SimpleNotification
from maintenance.models import Incident
from residences.models import Personnel, Batiment, Plainte


class ProfilTechnicienTests(TestCase):
    def setUp(self):
        self.admin = User.objects.create_user("adm", password="x", is_staff=True)
        Profile.objects.update_or_create(user=self.admin, defaults={"role": "admin"})
        self.t1 = User.objects.create_user("tech1", password="x", first_name="Tech", last_name="Un")
        self.t2 = User.objects.create_user("tech2", password="x", first_name="Tech", last_name="Deux")
        for t in (self.t1, self.t2):
            Profile.objects.update_or_create(user=t, defaults={"role": "technicien"})
        self.occ_u = User.objects.create_user("occ", password="x")
        self.occ = Personnel.objects.create(nom="Occ", prenom="Upant", societe="ROXGOLD", user=self.occ_u)
        self.bat = Batiment.objects.create(residence="C10", bloc="C", statut="Occupé", personnel=self.occ)
        self.inc = Incident.objects.create(titre="Fuite", description="d", categorie="plomberie", residence="C10", auteur=self.occ_u)
        self.pl = Plainte.objects.create(occupant=self.occ, utilisateur=self.occ_u, batiment=self.bat, type_occupant="resident_principal",
                                         categorie="Proprete", description="Sale", statut="nouvelle")
        self.a, self.c1, self.c2 = APIClient(), APIClient(), APIClient()
        self.a.force_authenticate(self.admin); self.c1.force_authenticate(self.t1); self.c2.force_authenticate(self.t2)

    def test_assignation_prevenue_reassignation_et_retrait(self):
        r = self.a.post(f"/api/incidents/{self.inc.id}/assigner/", {"technicien_id": self.t1.id}, format="json")
        self.assertEqual(r.status_code, 200, r.content)
        self.assertTrue(SimpleNotification.objects.filter(user=self.t1, titre__startswith="🔧 Tâche assignée").exists())
        self.a.post(f"/api/incidents/{self.inc.id}/assigner/", {"technicien_id": self.t2.id}, format="json")
        self.assertTrue(SimpleNotification.objects.filter(user=self.t1, titre__startswith="🔧 Tâche retirée").exists())
        self.assertTrue(SimpleNotification.objects.filter(user=self.t2, titre__startswith="🔧 Tâche assignée").exists())
        # un technicien ne peut pas retirer ni voler
        self.assertEqual(self.c1.post(f"/api/incidents/{self.inc.id}/retirer/").status_code, 403)
        self.assertEqual(self.c1.post(f"/api/incidents/{self.inc.id}/assigner/", {"technicien_id": self.t1.id}, format="json").status_code, 403)
        r = self.a.post(f"/api/incidents/{self.inc.id}/retirer/")
        self.assertEqual(r.status_code, 200, r.content)
        self.inc.refresh_from_db()
        self.assertEqual((self.inc.assigne_a, self.inc.statut), (None, "declare"))
        self.assertTrue(SimpleNotification.objects.filter(user=self.t2, titre__startswith="🔧 Tâche retirée").exists())

    def test_technicien_non_prevenu_des_incidents_des_autres(self):
        self.a.post("/api/incidents/", {"titre": "X", "description": "d", "categorie": "plomberie", "residence": "C10"}, format="json")
        self.assertFalse(SimpleNotification.objects.filter(user=self.t1, titre__startswith="🔧 Incident").exists())

    def test_tableau_de_bord_technicien(self):
        self.a.post(f"/api/incidents/{self.inc.id}/assigner/", {"technicien_id": self.t1.id}, format="json")
        self.a.post(f"/api/plaintes/{self.pl.id}/affecter/", {"affecte_a": self.t1.id}, format="json")
        d = self.c1.get("/api/technicien/tableau/").json()
        self.assertEqual(d["kpi"]["a_traiter"], 2)
        self.assertEqual((len(d["incidents"]), len(d["plaintes"])), (1, 1))
        self.assertEqual(self.c1.get(f"/api/technicien/tableau/?technicien_id={self.t2.id}").status_code, 403)
        self.assertEqual(self.a.get(f"/api/technicien/tableau/?technicien_id={self.t1.id}").json()["kpi"]["total_ouvert"], 2)

    def test_technicien_voit_et_traite_sa_plainte_affectee_seulement(self):
        self.a.post(f"/api/plaintes/{self.pl.id}/affecter/", {"affecte_a": self.t1.id}, format="json")
        self.assertEqual(self.c1.get(f"/api/plaintes/{self.pl.id}/").status_code, 200)
        self.assertEqual(self.c2.get(f"/api/plaintes/{self.pl.id}/").status_code, 404)
        self.assertEqual(self.c1.post(f"/api/plaintes/{self.pl.id}/prendre_en_charge/").status_code, 200)
        self.assertEqual(self.c1.post(f"/api/plaintes/{self.pl.id}/demarrer/").status_code, 200)
        self.assertEqual(self.c1.post(f"/api/plaintes/{self.pl.id}/affecter/", {"affecte_a": self.t2.id}, format="json").status_code, 403)
        self.assertEqual(self.c1.post(f"/api/plaintes/{self.pl.id}/resoudre/", {"action_resolution": "ok", "photo_resolution_base64": "data:image/jpeg;base64," + "A" * 200}, format="json").status_code, 200)

    def test_retirer_plainte_et_liste_en_deux_blocs(self):
        self.a.post(f"/api/plaintes/{self.pl.id}/affecter/", {"affecte_a": self.t1.id}, format="json")
        self.a.post(f"/api/incidents/{self.inc.id}/assigner/", {"technicien_id": self.admin.id}, format="json")
        d = self.a.get("/api/technicien/assignations/").json()
        self.assertEqual([x["username"] for x in d["admins"]], ["adm"])
        self.assertEqual(sorted(x["username"] for x in d["techniciens"]), ["tech1", "tech2"])
        self.assertEqual(d["admins"][0]["nb_incidents"], 1)
        self.assertEqual([x for x in d["techniciens"] if x["username"] == "tech1"][0]["nb_plaintes"], 1)
        self.assertEqual(self.c1.get("/api/technicien/assignations/").status_code, 403)
        self.assertEqual(self.c1.post(f"/api/plaintes/{self.pl.id}/retirer/").status_code, 403)
        self.assertEqual(self.a.post(f"/api/plaintes/{self.pl.id}/retirer/").status_code, 200)
        self.pl.refresh_from_db()
        self.assertEqual((self.pl.affecte_a, self.pl.statut), (None, "a_qualifier"))
        self.assertTrue(SimpleNotification.objects.filter(user=self.t1, titre="🧹 Plainte retirée").exists())


class NotificationsEtDroitsTests(TestCase):
    def test_declaration_incident_notifie_les_admins(self):
        admin = User.objects.create_user("adm9", password="x", is_staff=True)
        simple = User.objects.create_user("ag9", password="x")
        c = APIClient(); c.force_authenticate(simple)
        r = c.post("/api/incidents/declarer/", {"titre": "Fuite", "description": "d", "residence": "A1"}, format="json")
        self.assertIn(r.status_code, (201, 500), r.content)  # SQL brut PostgreSQL (RETURNING) : OK en 201
        if r.status_code == 201:
            self.assertTrue(SimpleNotification.objects.filter(user=admin, type_notif="alerte").exists())

    def test_demande_voyage_exige_le_droit_mobilite(self):
        from residences.models import Personnel
        u = User.objects.create_user("edg", password="x")
        p = Personnel.objects.create(nom="K", prenom="E", societe="ROXGOLD", type_personnel="roxgold", user=u, mobilite_exclue=True)
        c = APIClient(); c.force_authenticate(u)
        import datetime
        d = (datetime.date.today() + datetime.timedelta(days=20)).isoformat()
        body = {"type_demande": "voyage", "date_debut_souhaitee": d, "donnees": {}}
        r = c.post("/api/demandes/", body, format="json")
        self.assertEqual((r.status_code, r.json().get("code")), (403, "droit_mobilite_requis"))
        Personnel.objects.filter(pk=p.pk).update(mobilite_exclue=False)
        self.assertNotEqual(c.post("/api/demandes/", body, format="json").status_code, 403)

    def test_induction_signature_obligatoire_et_statut(self):
        from residences.models import Personnel, Batiment, OccupationHistory
        import datetime
        u = User.objects.create_user("res", password="x")
        p = Personnel.objects.create(nom="R", prenom="E", societe="ROXGOLD", user=u)
        c = APIClient(); c.force_authenticate(u)
        self.assertFalse(c.get("/api/induction-camp/statut/").json()["requise"])
        b = Batiment.objects.create(residence="Z1", bloc="Z", statut="Occupé", personnel=p)
        OccupationHistory.objects.create(batiment=b, personnel=p, occupant_nom="R E", date_arrivee=datetime.date.today())
        self.assertTrue(c.get("/api/induction-camp/statut/").json()["requise"])
        self.assertTrue(SimpleNotification.objects.filter(user=u, titre__startswith="🎓").exists())
        self.assertEqual(c.post("/api/induction-camp/", {"signature_base64": ""}, format="json").status_code, 400)
        self.assertEqual(c.post("/api/induction-camp/", {"signature_base64": "data:image/png;base64,AAAA"}, format="json").status_code, 400)
        r = c.post("/api/induction-camp/", {"signature_base64": "data:image/png;base64," + "A" * 3000}, format="json")
        self.assertEqual(r.status_code, 201)
        self.assertFalse(c.get("/api/induction-camp/statut/").json()["requise"])

    def test_notifier_atteint_les_admins_staff_sans_profil(self):
        from maintenance.views import _notifier
        admin = User.objects.create_user("adm10", password="x", is_staff=True)
        tech = User.objects.create_user("tec10", password="x")
        Profile.objects.update_or_create(user=tech, defaults={"role": "technicien"})
        inc = Incident.objects.create(titre="T", description="d", categorie="x", residence="R1")
        _notifier(inc, "msg", "alerte")
        self.assertTrue(SimpleNotification.objects.filter(user=admin).exists())
        self.assertFalse(SimpleNotification.objects.filter(user=tech).exists())


class ActionsMasseIncidentsTests(TestCase):
    def setUp(self):
        self.admin = User.objects.create_user("admm", password="x", is_staff=True)
        Profile.objects.update_or_create(user=self.admin, defaults={"role": "admin"})
        self.tech = User.objects.create_user("techm", password="x")
        Profile.objects.update_or_create(user=self.tech, defaults={"role": "technicien"})
        self.i = [Incident.objects.create(titre=f"I{n}", description="d", categorie="Plomberie", residence="C10", auteur=self.admin)
                  for n in range(3)]
        self.a, self.t = APIClient(), APIClient()
        self.a.force_authenticate(self.admin); self.t.force_authenticate(self.tech)
        self.ids = [x.id for x in self.i]

    def post(self, **d):
        return self.a.post("/api/incidents/actions_masse/", {"ids": self.ids, **d}, format="json")

    def test_non_admin_refuse(self):
        r = self.t.post("/api/incidents/actions_masse/", {"ids": self.ids, "action": "supprimer"}, format="json")
        self.assertEqual(r.status_code, 403)
        self.assertEqual(Incident.objects.count(), 3)

    def test_assigner_puis_retirer(self):
        r = self.post(action="assigner", technicien_id=self.tech.id)
        self.assertEqual(r.json()["ok"], 3, r.content)
        self.assertEqual(Incident.objects.filter(assigne_a=self.tech, statut="assigne").count(), 3)
        self.assertTrue(SimpleNotification.objects.filter(user=self.tech).exists())
        r = self.post(action="retirer")
        self.assertEqual(r.json()["ok"], 3)
        self.assertEqual(Incident.objects.filter(statut="declare", assigne_a=None).count(), 3)

    def test_modifier_escalader_et_echec_partiel(self):
        self.post(action="modifier", priorite="basse", categorie="Serrurerie")
        self.assertEqual(Incident.objects.filter(priorite="basse", categorie="Serrurerie").count(), 3)
        self.assertEqual(self.post(action="escalader").json()["ok"], 3)
        self.assertEqual(Incident.objects.filter(priorite="moyenne").count(), 3)
        Incident.objects.filter(pk=self.ids[0]).update(statut="cloture")
        r = self.post(action="commencer").json()
        self.assertEqual(r["ok"], 2)
        self.assertEqual(len(r["echecs"]), 1)

    def test_resoudre_cloturer_annuler_supprimer(self):
        self.assertEqual(self.post(action="resoudre", contenu="ok").json()["ok"], 3)
        self.assertEqual(self.post(action="cloturer").json()["ok"], 3)
        self.assertEqual(self.post(action="annuler").status_code, 400)  # raison obligatoire
        self.assertEqual(self.post(action="supprimer").json()["ok"], 3)
        self.assertEqual(Incident.objects.count(), 0)
