"""
Tests du systeme SMS/OTP - premiers tests reels du projet (aucun
n'existait avant, confirme par l'audit prealable). Tous les fournisseurs
SMS sont MOCKES - aucun test ici n'envoie de vrai SMS ni n'appelle un
reseau externe (exigence explicite du prompt d'integration SMS).
"""
from unittest.mock import patch, MagicMock
from django.test import TestCase
from django.contrib.auth.models import User
from django.utils import timezone
from datetime import timedelta

from .models import Parametre, CodeOTP, SMSMessage
from .phone import normaliser, vers_international
from .sms import envoyer_sms
from .sms_providers import ProviderFactory


class PhoneNumberServiceTests(TestCase):
    """Normalisation des numeros ivoiriens - les 3 formats du prompt."""

    def test_format_local_inchange(self):
        self.assertEqual(normaliser("0701234567"), "0701234567")

    def test_format_avec_indicatif_plus(self):
        self.assertEqual(normaliser("+2250701234567"), "0701234567")

    def test_format_avec_indicatif_sans_plus(self):
        self.assertEqual(normaliser("2250701234567"), "0701234567")

    def test_neuf_chiffres_sans_zero(self):
        # Cas Excel: le 0 initial a disparu a l'import
        self.assertEqual(normaliser("701234567"), "0701234567")

    def test_espaces_tirets_points(self):
        self.assertEqual(normaliser("07 01 23 45 67"), "0701234567")
        self.assertEqual(normaliser("07-01-23-45-67"), "0701234567")

    def test_valeur_vide(self):
        self.assertEqual(normaliser(""), "")
        self.assertEqual(normaliser(None), "")

    def test_vers_international(self):
        self.assertEqual(vers_international("0701234567"), "+225701234567")


class ProviderFactoryTests(TestCase):
    def test_tous_les_fournisseurs_connus_sont_accessibles(self):
        for code in ["test", "orange", "africastalking", "meta", "prosms", "hsms"]:
            provider = ProviderFactory.get(code)
            self.assertIsNotNone(provider, f"fournisseur {code} introuvable")
            self.assertEqual(provider.code, code)

    def test_fournisseur_inconnu_renvoie_none(self):
        self.assertIsNone(ProviderFactory.get("inexistant"))

    def test_prosms_sans_config_echoue_proprement(self):
        """proSMS est maintenant reellement implemente (documentation
        officielle prosms.ci/documentation verifiee) - sans Client ID /
        Client Secret configures, il doit echouer proprement, pas
        pretendre reussir."""
        provider = ProviderFactory.get("prosms")
        ok, info = provider.envoyer("0701234567", "test")
        self.assertFalse(ok)
        self.assertIn("non configuré", info)

    @patch("requests.post")
    def test_prosms_envoi_reussi_mocke(self, mock_post):
        """Simule la reponse 200 exacte documentee par prosms.ci - jamais
        de vrai appel reseau dans les tests."""
        Parametre.objects.update_or_create(cle="sms_prosms_client_id", defaults={"valeur": "cid"})
        Parametre.objects.update_or_create(cle="sms_prosms_client_secret", defaults={"valeur": "csecret"})
        mock_post.return_value.status_code = 200
        mock_post.return_value.json.return_value = {
            "success": True,
            "data": {"campaign_id": 128, "recipients_count": 1, "sent": 1, "failed": 0, "credits_used": 1, "credits_remaining": 499},
        }
        provider = ProviderFactory.get("prosms")
        ok, info = provider.envoyer("0701234567", "test")
        self.assertTrue(ok)
        self.assertIn("campagne #128", info)
        # Verifie que le numero a bien ete converti au format international
        # attendu par l'API (+225...), pas laisse au format local.
        appel = mock_post.call_args
        self.assertEqual(appel.kwargs["json"]["recipients"], ["+225701234567"])
        self.assertEqual(appel.kwargs["headers"]["X-Client-ID"], "cid")

    @patch("requests.post")
    def test_prosms_credits_insuffisants_402(self, mock_post):
        Parametre.objects.update_or_create(cle="sms_prosms_client_id", defaults={"valeur": "cid"})
        Parametre.objects.update_or_create(cle="sms_prosms_client_secret", defaults={"valeur": "csecret"})
        mock_post.return_value.status_code = 402
        mock_post.return_value.json.return_value = {"data": {"required": 5, "available": 0}}
        provider = ProviderFactory.get("prosms")
        ok, info = provider.envoyer("0701234567", "test")
        self.assertFalse(ok)
        self.assertIn("crédits SMS insuffisants", info)

    def test_hsms_sans_config_echoue_proprement(self):
        """HSMS est maintenant reellement implemente (documentation
        officielle hsms.ci/api/documentation/ verifiee) - sans Token/
        Client ID/Client Secret configures, il doit echouer proprement."""
        provider = ProviderFactory.get("hsms")
        ok, info = provider.envoyer("0701234567", "test")
        self.assertFalse(ok)
        self.assertIn("non configuré", info)

    @patch("requests.post")
    def test_hsms_envoi_reussi_mocke(self, mock_post):
        """Simule la reponse exacte documentee par hsms.ci API v2 (/api/v2/sms/send/) -
        jamais de vrai appel reseau dans les tests."""
        Parametre.objects.update_or_create(cle="sms_hsms_token", defaults={"valeur": "tok123"})
        Parametre.objects.update_or_create(cle="sms_hsms_client_id", defaults={"valeur": "cid"})
        Parametre.objects.update_or_create(cle="sms_hsms_client_secret", defaults={"valeur": "csecret"})
        mock_post.return_value.status_code = 200
        mock_post.return_value.content = b'{"success": true}'
        mock_post.return_value.json.return_value = {
            "success": True, "message": "SMS queued for delivery",
            "tasks": {"225701234567": {"ticket": "tk-1"}},
            "total_queued": 1, "segments_per_message": 1, "encoding": "gsm",
        }
        provider = ProviderFactory.get("hsms")
        ok, info = provider.envoyer("0701234567", "test")
        self.assertTrue(ok)
        # Verifie l'endpoint v2 et le format telephone exact attendu par HSMS (indicatif SANS le "+")
        appel = mock_post.call_args
        self.assertEqual(appel.args[0], "https://hsms.ci/api/v2/sms/send/")
        self.assertEqual(appel.kwargs["json"]["telephone"], "225701234567")
        self.assertEqual(appel.kwargs["json"]["clientid"], "cid")
        self.assertEqual(appel.kwargs["json"]["clientsecret"], "csecret")
        self.assertEqual(appel.kwargs["headers"]["Authorization"], "Bearer tok123")
        self.assertIn("tk-1", info)

    @patch("requests.post")
    def test_hsms_solde_insuffisant_400(self, mock_post):
        Parametre.objects.update_or_create(cle="sms_hsms_token", defaults={"valeur": "tok123"})
        Parametre.objects.update_or_create(cle="sms_hsms_client_id", defaults={"valeur": "cid"})
        Parametre.objects.update_or_create(cle="sms_hsms_client_secret", defaults={"valeur": "csecret"})
        mock_post.return_value.status_code = 400
        mock_post.return_value.content = b'{}'
        mock_post.return_value.json.return_value = {"success": False, "message": "Solde insuffisant"}
        provider = ProviderFactory.get("hsms")
        ok, info = provider.envoyer("0701234567", "test")
        self.assertFalse(ok)
        self.assertIn("Solde insuffisant", info)

    @patch("requests.post")
    def test_hsms_token_expire_renouvele_automatiquement(self, mock_post):
        """Si le token statique est rejete (401) et que email/mot de passe
        sont configures, le provider doit obtenir un nouveau token via
        /api/v2/sms/token/ et reessayer l'envoi avec celui-ci."""
        Parametre.objects.update_or_create(cle="sms_hsms_token", defaults={"valeur": "tok-perime"})
        Parametre.objects.update_or_create(cle="sms_hsms_client_id", defaults={"valeur": "cid"})
        Parametre.objects.update_or_create(cle="sms_hsms_client_secret", defaults={"valeur": "csecret"})
        Parametre.objects.update_or_create(cle="sms_hsms_email", defaults={"valeur": "user@example.com"})
        Parametre.objects.update_or_create(cle="sms_hsms_password", defaults={"valeur": "secret"})

        reponse_401 = MagicMock(status_code=401, content=b'{}')
        reponse_401.json.return_value = {"success": False, "message": "Jeton invalide"}
        reponse_token = MagicMock(status_code=200, content=b'{"token":"tok-neuf"}')
        reponse_token.json.return_value = {"success": True, "token": "tok-neuf"}
        reponse_ok = MagicMock(status_code=200, content=b'{"success": true}')
        reponse_ok.json.return_value = {"success": True, "tasks": {"225701234567": {"ticket": "tk-2"}}}

        mock_post.side_effect = [reponse_401, reponse_token, reponse_ok]
        provider = ProviderFactory.get("hsms")
        ok, info = provider.envoyer("0701234567", "test")
        self.assertTrue(ok)
        # 3 appels : envoi (rejeté) -> obtention token -> envoi (accepté)
        self.assertEqual(mock_post.call_count, 3)
        self.assertEqual(mock_post.call_args_list[1].args[0], "https://hsms.ci/api/v2/sms/token/")
        self.assertEqual(mock_post.call_args_list[1].kwargs["json"], {"email": "user@example.com", "password": "secret"})
        self.assertEqual(mock_post.call_args_list[2].kwargs["headers"]["Authorization"], "Bearer tok-neuf")
        # Le nouveau token doit être mis en cache
        self.assertEqual(Parametre.get("sms_hsms_token"), "tok-neuf")

    @patch("requests.post")
    def test_hsms_solde_v2(self, mock_post):
        Parametre.objects.update_or_create(cle="sms_hsms_token", defaults={"valeur": "tok123"})
        Parametre.objects.update_or_create(cle="sms_hsms_client_id", defaults={"valeur": "cid"})
        Parametre.objects.update_or_create(cle="sms_hsms_client_secret", defaults={"valeur": "csecret"})
        mock_post.return_value.status_code = 200
        mock_post.return_value.json.return_value = {"success": True, "balance": 1500, "app_name": "MyApp"}
        provider = ProviderFactory.get("hsms")
        solde = provider.get_balance()
        self.assertEqual(solde, 1500)
        appel = mock_post.call_args
        self.assertEqual(appel.args[0], "https://hsms.ci/api/v2/sms/check-balance/")


class EnvoyerSMSTests(TestCase):
    """Le point d'entree unique envoyer_sms() - signature et comportement inchanges."""

    def setUp(self):
        Parametre.objects.update_or_create(cle="sms_provider", defaults={"valeur": "test"})

    def test_mode_test_reussit_sans_reseau(self):
        ok, info = envoyer_sms("0701234567", "message de test")
        self.assertTrue(ok)
        self.assertEqual(info, "mode_test")

    def test_normalise_le_numero_avant_envoi(self):
        ok, info = envoyer_sms("+2250701234567", "test")
        self.assertTrue(ok)
        msg = SMSMessage.objects.latest("date_creation")
        self.assertEqual(msg.destinataire, "0701234567")

    def test_historique_trace_correctement(self):
        envoyer_sms("0701234567", "test", type_message="otp")
        msg = SMSMessage.objects.latest("date_creation")
        self.assertEqual(msg.type_message, "otp")
        self.assertEqual(msg.statut, "sent")
        self.assertEqual(msg.fournisseur, "test")

    def test_fournisseur_inconnu_echoue_proprement(self):
        Parametre.objects.update_or_create(cle="sms_provider", defaults={"valeur": "bidule"})
        ok, info = envoyer_sms("0701234567", "test")
        self.assertFalse(ok)
        self.assertIn("inconnu", info)

    @patch("accounts.sms_providers.orange.OrangeProvider.envoyer")
    def test_provider_selection_bascule_correctement(self, mock_envoyer):
        """Changer sms_provider change bien le fournisseur appele, sans toucher au code appelant."""
        mock_envoyer.return_value = (True, "envoyé via Orange SMS API")
        Parametre.objects.update_or_create(cle="sms_provider", defaults={"valeur": "orange"})
        ok, info = envoyer_sms("0701234567", "test")
        self.assertTrue(ok)
        mock_envoyer.assert_called_once()

    def test_whatsapp_sans_meta_configure_echoue_proprement(self):
        """Twilio retire du projet - sans whatsapp_provider=meta, le canal WhatsApp doit echouer proprement, jamais silencieusement."""
        Parametre.objects.update_or_create(cle="sms_provider", defaults={"valeur": "orange"})
        Parametre.objects.update_or_create(cle="whatsapp_provider", defaults={"valeur": "auto"})
        ok, info = envoyer_sms("0701234567", "test", canal="whatsapp")
        self.assertFalse(ok)
        self.assertIn("non configuré", info)

    @patch("accounts.sms_providers.meta_whatsapp.MetaWhatsAppProvider.envoyer")
    def test_whatsapp_meta_bascule_correctement(self, mock_envoyer):
        mock_envoyer.return_value = (True, "envoyé via l'API Meta WhatsApp")
        Parametre.objects.update_or_create(cle="whatsapp_provider", defaults={"valeur": "meta"})
        ok, info = envoyer_sms("0701234567", "test", canal="whatsapp")
        self.assertTrue(ok)
        mock_envoyer.assert_called_once()


class OTPFlowTests(TestCase):
    """Le systeme OTP existant - transport SMS change, logique OTP elle-meme non touchee."""

    def setUp(self):
        Parametre.objects.update_or_create(cle="sms_provider", defaults={"valeur": "test"})
        self.user = User.objects.create_user("agent_otp", "a@a.com", "pass")
        from residences.models import Personnel
        self.personnel = Personnel.objects.create(
            nom="Test", prenom="OTP", societe="ROXGOLD", numero="OTPX1",
            telephone="0701234567", type_personnel="roxgold", user=self.user,
        )

    def test_demander_otp_accepte_numero_avec_indicatif(self):
        """Le bug trouve pendant l'audit : le numero avec indicatif doit
        maintenant matcher le format local stocke en base."""
        from rest_framework.test import APIRequestFactory
        from .views import demander_otp
        rf = APIRequestFactory()
        req = rf.post("/api/auth/otp/demander/", {"telephone": "+2250701234567"}, format="json")
        resp = demander_otp(req)
        self.assertEqual(resp.status_code, 200)
        self.assertTrue(CodeOTP.objects.filter(telephone="0701234567").exists())

    def test_rate_limit_otp_toujours_actif(self):
        from rest_framework.test import APIRequestFactory
        from .views import demander_otp
        rf = APIRequestFactory()
        for _ in range(3):
            CodeOTP.objects.create(telephone="0701234567", code="123456", expire_le=timezone.now() + timedelta(minutes=5))
        req = rf.post("/api/auth/otp/demander/", {"telephone": "0701234567"}, format="json")
        resp = demander_otp(req)
        self.assertEqual(resp.status_code, 429)

    def test_otp_expiration_toujours_active(self):
        otp = CodeOTP.objects.create(
            telephone="0701234567", code="123456",
            expire_le=timezone.now() - timedelta(minutes=1),
        )
        self.assertFalse(otp.est_valide())

    def test_otp_max_tentatives_toujours_actif(self):
        otp = CodeOTP.objects.create(
            telephone="0701234567", code="123456",
            expire_le=timezone.now() + timedelta(minutes=5), tentatives=5,
        )
        self.assertFalse(otp.est_valide())
