from django.test import TestCase

# Create your tests here.


class MessageDossierTests(TestCase):
    """Échange déclarant <-> technicien assigné sur un incident : droits + notification."""

    def setUp(self):
        from django.contrib.auth.models import User
        from rest_framework.test import APIClient
        from accounts.models import Profile
        from .models import Incident
        self.agent = User.objects.create_user("edgar", password="x", first_name="Edgar")
        self.tech = User.objects.create_user("tech", password="x", first_name="Ali")
        Profile.objects.update_or_create(user=self.tech, defaults={"role": "technicien"})
        self.autre = User.objects.create_user("autre", password="x")
        self.inc = Incident.objects.create(titre="Fuite douche", description="fuite", categorie=Incident._meta.get_field("categorie").choices[0][0],
                                           residence="A2", auteur=self.agent, assigne_a=self.tech, statut="assigne")
        self.c = APIClient()

    def post(self, user, texte):
        from django.contrib.auth.models import User
        self.c.force_authenticate(User.objects.get(pk=user.pk))
        return self.c.post(f"/api/incidents/{self.inc.id}/commenter/", {"contenu": texte}, format="json")

    def test_agent_ecrit_au_technicien_qui_est_notifie(self):
        from evenements.models import SimpleNotification
        r = self.post(self.agent, "Je suis absent jusqu'à 17h")
        self.assertEqual(r.status_code, 200, r.data)
        self.assertEqual(self.inc.commentaires.get().contenu, "Je suis absent jusqu'à 17h")
        n = SimpleNotification.objects.get(user=self.tech)
        self.assertIn("Je suis absent", n.message)
        self.assertFalse(SimpleNotification.objects.filter(user=self.agent).exists())

    def test_technicien_repond_le_declarant_est_notifie(self):
        from evenements.models import SimpleNotification
        self.assertEqual(self.post(self.tech, "Je passe à 14h").status_code, 200)
        self.assertTrue(SimpleNotification.objects.filter(user=self.agent).exists())

    def test_personne_etrangere_au_dossier_refusee(self):
        self.assertEqual(self.post(self.autre, "spam").status_code, 404)
        self.assertFalse(self.inc.commentaires.exists())


class CloCheNotificationsSystemeTests(TestCase):
    """Les notifications système (SimpleNotification) doivent apparaître dans la cloche."""

    def test_compteur_inclut_les_notifications_systeme(self):
        from django.contrib.auth.models import User
        from rest_framework.test import APIClient
        from evenements.models import SimpleNotification
        u = User.objects.create_user("tech", password="x")
        for i in range(12):
            SimpleNotification.objects.create(user=u, titre=f"Message {i}", message="x")
        c = APIClient(); c.force_authenticate(u)
        d = c.get("/api/notifications/compteur/").data
        self.assertEqual(d["non_lues"], 12)
        self.assertEqual(len([n for n in d["notifications"] if n.get("source") == "system"]), 10)


class PorteeIncidentsSqlTests(TestCase):
    """Les endpoints SQL (liste / détail / stats) doivent respecter la portée : un non-admin ne voit que les siens."""

    def setUp(self):
        from django.contrib.auth.models import User
        from rest_framework.test import APIClient
        from .models import Incident
        cat = Incident._meta.get_field("categorie").choices[0][0]
        self.edgar = User.objects.create_user("edgar", password="x")
        self.dylan = User.objects.create_user("dylan", password="x")
        self.admin = User.objects.create_user("adm", password="x", is_staff=True)
        self.i_dylan = Incident.objects.create(titre="Prise HS", description="d", categorie=cat, residence="B1", auteur=self.dylan)
        self.i_edgar = Incident.objects.create(titre="Fuite", description="d", categorie=cat, residence="A2", auteur=self.edgar)
        self.c = APIClient()

    def test_non_admin_ne_voit_que_ses_incidents(self):
        self.c.force_authenticate(self.edgar)
        titres = [i["titre"] for i in self.c.get("/api/incidents/liste/").json()["results"]]
        self.assertEqual(titres, ["Fuite"])
        self.assertEqual(self.c.get(f"/api/incidents/{self.i_dylan.id}/detail/").status_code, 404)
        self.assertEqual(self.c.get(f"/api/incidents/{self.i_edgar.id}/detail/").status_code, 200)
        self.assertEqual(self.c.get("/api/incidents/stats-sql/").json()["total"], 1)

    def test_admin_voit_tout(self):
        self.c.force_authenticate(self.admin)
        self.assertEqual(self.c.get("/api/incidents/liste/").json()["count"], 2)
        self.assertEqual(self.c.get("/api/incidents/stats-sql/").json()["total"], 2)


class TechnicienTitulaireTests(TestCase):
    """Le technicien assigné doit être reconnu par l'écran (clé assigne_a)
    et pouvoir démarrer puis résoudre l'intervention."""

    def setUp(self):
        from django.contrib.auth.models import User
        from rest_framework.test import APIClient
        from accounts.models import Profile
        from .models import Incident
        self.agent = User.objects.create_user("agent2", password="x")
        self.tech = User.objects.create_user("tech2", password="x")
        Profile.objects.update_or_create(user=self.tech, defaults={"role": "technicien"})
        self.inc = Incident.objects.create(titre="Clim", description="panne", categorie="Climatisation",
                                           residence="B1", auteur=self.agent, assigne_a=self.tech, statut="assigne")
        self.c = APIClient(); self.c.force_authenticate(User.objects.get(pk=self.tech.pk))

    def test_liste_et_detail_exposent_assigne_a(self):
        r = self.c.get("/api/incidents/liste/")
        ligne = next(i for i in r.data["results"] if i["id"] == self.inc.id)
        self.assertEqual(ligne["assigne_a"], self.tech.id)
        self.assertEqual(self.c.get(f"/api/incidents/{self.inc.id}/detail/").data["assigne_a"], self.tech.id)

    def test_technicien_traite_sa_tache(self):
        self.assertEqual(self.c.post(f"/api/incidents/{self.inc.id}/commencer/", {}, format="json").status_code, 200)
        self.assertEqual(self.c.post(f"/api/incidents/{self.inc.id}/resoudre/", {"commentaire": "ok"}, format="json").status_code, 200)
        self.inc.refresh_from_db()
        self.assertEqual(self.inc.statut, "resolu")


class RapportSlaTests(TestCase):
    """SLA paramétré (ex. 72 h) : un incident ouvert depuis plus longtemps est
    « hors délai », même sans échéance enregistrée ; email = rapport complet."""

    def setUp(self):
        import datetime
        from django.utils import timezone
        from accounts.models import Parametre
        from .models import Incident
        for k in ("sla_critique_h", "sla_haute_h", "sla_moyenne_h", "sla_basse_h"):
            Parametre.objects.update_or_create(cle=k, defaults={"valeur": "72"})
        self.vieux = Incident.objects.create(titre="Fuite ancienne", description="x", categorie="Plomberie", residence="A2", statut="declare")
        Incident.objects.filter(pk=self.vieux.pk).update(date_creation=timezone.now() - datetime.timedelta(days=5),
                                                          sla_echeance=None, sla_depasse=False)
        self.recent = Incident.objects.create(titre="Prise", description="x", categorie="Electricite", residence="B1", statut="declare")

    def test_actualiser_sla_marque_le_dossier_ancien(self):
        from .rapport import actualiser_sla
        expires = actualiser_sla()
        self.vieux.refresh_from_db(); self.recent.refresh_from_db()
        self.assertTrue(self.vieux.sla_depasse)
        self.assertIsNotNone(self.vieux.sla_echeance)
        self.assertFalse(self.recent.sla_depasse)
        self.assertEqual([i.pk for i in expires], [self.vieux.pk])

    def test_rapport_signale_le_hors_delai_et_email_identique(self):
        from .rapport import rapport_html
        from accounts.rapports_email import generer_contenu_rapport
        html = rapport_html()
        self.assertIn("1 incident(s) ouvert(s) hors délai SLA", html)
        self.assertIn("Fuite ancienne", html)
        _, mail = generer_contenu_rapport("Maintenance", "maintenance", {})
        self.assertIn("1 incident(s) ouvert(s) hors délai SLA", mail)
        self.assertIn("Rapport de <span", mail)

    def test_endpoint_rapport(self):
        from django.contrib.auth.models import User
        from rest_framework.test import APIClient
        c = APIClient(); c.force_authenticate(User.objects.create_superuser("adm", "a@a.ci", "x"))
        r = c.get("/api/incidents/rapport/")
        self.assertEqual(r.status_code, 200)
        self.assertIn("hors délai", r.data["html"])
