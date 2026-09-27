from django.test import TestCase
from django.contrib.auth.models import User
from django.utils import timezone
from rest_framework.test import APIRequestFactory, force_authenticate

from accounts.models import Profile
from .models import AuditLog
from .views import AuditLogViewSet


class AuditLogViewSetTests(TestCase):
    """
    Le point de bug trouve pendant l'audit : queryset = AuditLog.objects.all()
    etait defini comme attribut de classe mais list() (surchargee) ne s'en
    servait pas du tout - seules les entrees django-simple-history
    apparaissaient, ce qui donnait l'impression que les ajustements de
    stock (le seul type d'entree AuditLog manuelle existant) n'etaient
    jamais visibles. Ces tests couvrent : la fusion AuditLog + historique,
    la restriction admin-only, et les filtres (date/module/action/utilisateur).
    """

    def setUp(self):
        self.rf = APIRequestFactory()

        # Profile est cree automatiquement par le signal post_save sur User
        # (accounts/signals.py) - on met a jour le role plutot que d'en
        # recreer un (sinon IntegrityError: UNIQUE constraint sur user_id).
        self.admin_user = User.objects.create_user("admin1", "a@a.com", "pass", is_staff=True)
        Profile.objects.filter(user=self.admin_user).update(role="admin")

        self.agent_user = User.objects.create_user("agent1", "b@b.com", "pass")
        Profile.objects.filter(user=self.agent_user).update(role="agent")

        AuditLog.objects.create(
            utilisateur=self.admin_user, module="boutique", action="ajustement_stock",
            detail="Eau: 10 -> 8 (retrait, qté 2)", ip="127.0.0.1",
        )
        AuditLog.objects.create(
            utilisateur=self.agent_user, module="connexion", action="login_reussi",
            detail="via mot_de_passe", ip="10.0.0.5",
        )

    def _get(self, user, params=None):
        req = self.rf.get("/api/audit-log/", params or {})
        force_authenticate(req, user=user)
        view = AuditLogViewSet.as_view({"get": "list"})
        return view(req)

    def test_non_admin_recoit_403(self):
        resp = self._get(self.agent_user)
        self.assertEqual(resp.status_code, 403)

    def test_admin_voit_les_entrees_auditlog_manuelles(self):
        """Les entrees manuelles (AuditLog.objects.all()) doivent apparaitre
        dans la liste fusionnee - c'etait le bug precis a corriger."""
        resp = self._get(self.admin_user)
        self.assertEqual(resp.status_code, 200)
        modules = [r["module"] for r in resp.data["results"]]
        self.assertIn("boutique", modules)
        self.assertIn("connexion", modules)

    def test_admin_voit_les_actions_de_plusieurs_utilisateurs(self):
        """Confirme que ce n'est plus 'seulement l'admin' qui apparait -
        l'action de agent1 (login) doit etre visible par admin1."""
        resp = self._get(self.admin_user)
        noms = [r["utilisateur_nom"] for r in resp.data["results"]]
        self.assertIn("agent1", noms)

    def test_filtre_module(self):
        resp = self._get(self.admin_user, {"module": "connexion"})
        self.assertTrue(all(r["module"] == "connexion" for r in resp.data["results"]))
        self.assertTrue(len(resp.data["results"]) >= 1)

    def test_filtre_action_insensible_a_la_casse(self):
        resp = self._get(self.admin_user, {"action": "AJUSTEMENT"})
        self.assertTrue(all("ajustement" in (r["action"] or "").lower() for r in resp.data["results"]))
        self.assertTrue(len(resp.data["results"]) >= 1)

    def test_filtre_utilisateur(self):
        resp = self._get(self.admin_user, {"utilisateur": "agent1"})
        self.assertTrue(all("agent1" in (r["utilisateur_nom"] or "") for r in resp.data["results"]))
        self.assertTrue(len(resp.data["results"]) >= 1)

    def test_filtre_date_unique_aujourdhui(self):
        today = timezone.now().date().isoformat()
        resp = self._get(self.admin_user, {"date": today})
        self.assertEqual(resp.status_code, 200)
        self.assertTrue(len(resp.data["results"]) >= 2)

    def test_filtre_date_debut_fin_exclut_hors_plage(self):
        # Plage dans le futur : aucune des deux entrees (creees maintenant) ne doit matcher.
        demain = (timezone.now() + timezone.timedelta(days=1)).date().isoformat()
        apres_demain = (timezone.now() + timezone.timedelta(days=2)).date().isoformat()
        resp = self._get(self.admin_user, {"date_debut": demain, "date_fin": apres_demain})
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(len(resp.data["results"]), 0)
