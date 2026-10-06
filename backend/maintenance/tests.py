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
