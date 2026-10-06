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


class BarProfilsTests(TestCase):
    """Trois vues du bar : admin (tout), gérant (caisse + stock), client (sa carte, ses achats, son bon)."""

    def setUp(self):
        from rest_framework.test import APIClient
        from residences.models import Personnel
        from .models import ArticleBoutique, BonCaisse, ConsommationBoutique
        self.admin = User.objects.create_user("admin", password="x", is_staff=True)
        self.gerant = User.objects.create_user("bar", password="x")
        Profile.objects.update_or_create(user=self.gerant, defaults={"role": "boutique"})
        self.client_u = User.objects.create_user("edgar", password="x")
        Profile.objects.update_or_create(user=self.client_u, defaults={"role": "agent"})
        # Recharge depuis la base : comme dans une vraie requête, le rôle est lu à jour
        self.gerant = User.objects.get(pk=self.gerant.pk)
        self.client_u = User.objects.get(pk=self.client_u.pk)
        autre = User.objects.create_user("autre", password="x")
        self.p_client = Personnel.objects.create(nom="K", prenom="Edgar", societe="R", user=self.client_u)
        self.p_autre = Personnel.objects.create(nom="Y", prenom="Serge", societe="R", user=autre)
        self.art = ArticleBoutique.objects.create(nom="Coca", prix=500, stock=10)
        an = timezone.now().year
        BonCaisse.objects.create(personnel=self.p_client, annee=an)
        BonCaisse.objects.create(personnel=self.p_autre, annee=an)
        ConsommationBoutique.objects.create(article=self.art, personnel=self.p_client, quantite=1, montant=500)
        ConsommationBoutique.objects.create(article=self.art, personnel=self.p_autre, quantite=2, montant=1000)
        self.c = APIClient()

    def en(self, u):
        self.c.force_authenticate(u)
        return self.c

    def test_client_ne_vend_pas_ne_modifie_pas_les_prix(self):
        c = self.en(self.client_u)
        self.assertEqual(c.post("/api/boutique/consommations/", {"article": self.art.id, "personnel": self.p_autre.id, "mode_paiement": "bon"}, format="json").status_code, 403)
        self.assertEqual(c.patch(f"/api/boutique/articles/{self.art.id}/", {"prix": 1}, format="json").status_code, 403)
        self.assertEqual(c.post(f"/api/boutique/articles/{self.art.id}/ajuster_stock/", {"operation": "set", "quantite": 0}, format="json").status_code, 403)
        self.assertEqual(c.get("/api/boutique/consommations/analyses/").status_code, 403)

    def test_client_ne_voit_que_ses_achats_et_son_bon(self):
        c = self.en(self.client_u)
        consos = c.get("/api/boutique/consommations/").data
        consos = consos.get("results", consos)
        self.assertEqual({x["personnel"] for x in consos}, {self.p_client.id})
        bons = c.get("/api/boutique/bons/").data
        bons = bons.get("results", bons)
        self.assertEqual([b["personnel"] for b in bons], [self.p_client.id])
        self.assertEqual(c.get("/api/boutique/bons/solde_personnel/", {"personnel_id": self.p_autre.id}).status_code, 403)
        self.assertEqual(c.get("/api/boutique/articles/").status_code, 200)  # la carte reste visible

    def test_gerant_gere_le_stock_mais_pas_les_prix_ni_les_analyses(self):
        c = self.en(self.gerant)
        r = c.post(f"/api/boutique/articles/{self.art.id}/ajuster_stock/", {"operation": "add", "quantite": 5, "raison": "livraison"}, format="json")
        self.assertEqual(r.status_code, 200, r.data)
        self.assertEqual(r.data["stock"], 15)
        self.assertEqual(c.patch(f"/api/boutique/articles/{self.art.id}/", {"prix": 1}, format="json").status_code, 403)
        self.assertEqual(c.get("/api/boutique/consommations/analyses/").status_code, 403)
        consos = c.get("/api/boutique/consommations/").data
        self.assertEqual(len(consos.get("results", consos)), 2)  # toutes les ventes
        self.assertEqual(c.delete(f"/api/boutique/consommations/{consos.get('results', consos)[0]['id']}/").status_code, 403)

    def test_admin_modifie_les_prix(self):
        self.assertEqual(self.en(self.admin).patch(f"/api/boutique/articles/{self.art.id}/", {"prix": 600}, format="json").status_code, 200)
