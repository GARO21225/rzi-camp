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
            "tasks": {"2250701234567": {"ticket": "tk-1"}},
            "total_queued": 1, "segments_per_message": 1, "encoding": "gsm",
        }
        provider = ProviderFactory.get("hsms")
        ok, info = provider.envoyer("0701234567", "test")
        self.assertTrue(ok)
        # Verifie l'endpoint v2 et le format telephone exact attendu par HSMS (indicatif SANS le "+")
        appel = mock_post.call_args
        self.assertEqual(appel.args[0], "https://hsms.ci/api/v2/sms/send/")
        self.assertEqual(appel.kwargs["json"]["telephone"], "2250701234567")
        self.assertEqual(appel.kwargs["json"]["clientid"], "cid")
        self.assertEqual(appel.kwargs["json"]["clientsecret"], "csecret")
        self.assertEqual(appel.kwargs["headers"]["Authorization"], "Bearer tok123")
        self.assertIn("tk-1", info)

    @patch("requests.post")
    def test_hsms_format_telephone_conforme_exemple_documente(self, mock_post):
        """Regression : la documentation officielle HSMS (citee dans
        hsms.py) donne l'exemple exact "0700000001" (local, 10 chiffres)
        -> "2250700000001" (indicatif SANS "+", zero initial CONSERVE,
        13 chiffres au total). vers_international() de phone.py retire ce
        zero (produit "+225700000001", 12 chiffres) - format different et
        rejete par HSMS en production ("Aucun destinataire valide"). Ce
        test pin exactement l'exemple documente, independamment de
        vers_international(), pour empecher toute regression future vers
        le format E.164 tronque."""
        Parametre.objects.update_or_create(cle="sms_hsms_token", defaults={"valeur": "tok123"})
        Parametre.objects.update_or_create(cle="sms_hsms_client_id", defaults={"valeur": "cid"})
        Parametre.objects.update_or_create(cle="sms_hsms_client_secret", defaults={"valeur": "csecret"})
        mock_post.return_value.status_code = 200
        mock_post.return_value.content = b'{"success": true}'
        mock_post.return_value.json.return_value = {
            "success": True, "tasks": {"2250700000001": {"ticket": "tk-doc"}},
        }
        provider = ProviderFactory.get("hsms")
        ok, info = provider.envoyer("0700000001", "test")
        self.assertTrue(ok)
        appel = mock_post.call_args
        self.assertEqual(appel.kwargs["json"]["telephone"], "2250700000001")

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
        reponse_ok.json.return_value = {"success": True, "tasks": {"2250701234567": {"ticket": "tk-2"}}}

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

    @patch("requests.post")
    def test_hsms_erreur_reseau_reelle_ne_plante_pas(self, mock_post):
        """Régression : une VRAIE exception réseau (pas un status_code
        d'erreur mocké) doit être rattrapée proprement et renvoyer
        (False, message) — jamais remonter comme 500 côté demander_otp.
        Un bug précédent référençait `requests.exceptions.RequestException`
        dans le except de envoyer() sans que `requests` soit importé dans
        ce scope : l'évaluation du except levait elle-même un NameError,
        masquant l'erreur réseau réelle en 500 non géré."""
        import requests
        Parametre.objects.update_or_create(cle="sms_hsms_token", defaults={"valeur": "tok123"})
        Parametre.objects.update_or_create(cle="sms_hsms_client_id", defaults={"valeur": "cid"})
        Parametre.objects.update_or_create(cle="sms_hsms_client_secret", defaults={"valeur": "csecret"})
        mock_post.side_effect = requests.exceptions.ConnectionError("DNS/connexion impossible vers hsms.ci")
        provider = ProviderFactory.get("hsms")
        ok, info = provider.envoyer("0701234567", "test")
        self.assertFalse(ok)
        self.assertIn("Erreur réseau HSMS", info)


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

    def test_demander_otp_exception_imprevue_avant_envoi_sms_reste_json(self):
        """
        Regression : la page HTML 500 muette de Django (DEBUG=False en
        prod) est revenue plusieurs fois en production malgre le
        try/except deja pose autour du seul appel envoyer_sms() - preuve
        qu'une exception imprevue AILLEURS dans la vue (avant l'envoi du
        SMS : CodeOTP.generer, Parametre.get, la requete Personnel...)
        n'etait pas couverte. Le try/except couvre maintenant TOUT le
        corps de demander_otp - ce test simule une exception a un endroit
        qui n'etait PAS protege avant (CodeOTP.generer) et verifie qu'elle
        ne remonte plus jamais comme exception Python brute : toujours une
        Response DRF (donc du JSON), jamais autre chose.
        """
        from unittest.mock import patch
        from rest_framework.test import APIRequestFactory
        from rest_framework.response import Response as DRFResponse
        from .views import demander_otp
        rf = APIRequestFactory()
        req = rf.post("/api/auth/otp/demander/", {"telephone": "0701234567"}, format="json")
        with patch("accounts.views.CodeOTP.generer", side_effect=RuntimeError("panne imprevue simulee")):
            resp = demander_otp(req)
        self.assertIsInstance(resp, DRFResponse)
        self.assertEqual(resp.status_code, 500)
        self.assertIn("panne imprevue simulee", resp.data.get("error", ""))

    def test_demander_otp_via_client_complet_reste_json_meme_si_exception(self):
        """
        Comme le test ci-dessus, mais via self.client.post() - passe par
        TOUTE la chaine reelle (middleware, resolution d'URL, dispatch
        DRF), pas seulement la fonction de vue appelee directement. Utile
        car le 500 HTML muet a persiste en production malgre un
        try/except deja complet dans la vue elle-meme (voir le test
        precedent, qui prouve le code de la vue solide) - ce test verifie
        qu'aucune couche AUTOUR de la vue (middleware, dispatch DRF) ne
        transforme une exception en reponse HTML brute. S'il passe ici
        mais que la prod montre encore du HTML, la difference se situe
        forcement dans l'environnement de deploiement (gunicorn/uvicorn/
        nginx), pas dans le code Django/DRF.
        """
        from unittest.mock import patch
        with patch("accounts.views.CodeOTP.generer", side_effect=RuntimeError("panne imprevue simulee 2")):
            resp = self.client.post(
                "/api/auth/otp/demander/", {"telephone": "0701234567"}, content_type="application/json",
            )
        self.assertEqual(resp.status_code, 500)
        self.assertEqual(resp["Content-Type"], "application/json")
        self.assertIn("panne imprevue simulee 2", resp.json().get("error", ""))

    def test_demander_otp_canal_email_sans_adresse_echoue_proprement(self):
        """Nouveau canal 'email' (ajoute suite aux echecs de livraison SMS
        constates en production) : si canal_otp=email mais que le
        Personnel n'a pas d'adresse email renseignee, l'echec doit etre
        clair (404), jamais une exception."""
        from rest_framework.test import APIRequestFactory
        from .views import demander_otp
        Parametre.objects.update_or_create(cle="canal_otp", defaults={"valeur": "email"})
        rf = APIRequestFactory()
        req = rf.post("/api/auth/otp/demander/", {"telephone": "0701234567"}, format="json")
        resp = demander_otp(req)
        self.assertEqual(resp.status_code, 404)
        self.assertIn("email", resp.data.get("error", "").lower())

    def test_demander_otp_canal_email_mode_test_reussit_et_message_est_canal_aware(self):
        """canal_otp=email + Personnel.email renseigne + email_provider=test
        (par defaut) : doit reussir sans reseau, et le message renvoye au
        frontend doit mentionner l'email (pas 'SMS'), demande explicite de
        l'utilisateur ('notifier qu'un mail a ete envoye par mail ou SMS
        selon ce qui a ete choisi')."""
        from rest_framework.test import APIRequestFactory
        from .views import demander_otp
        Parametre.objects.update_or_create(cle="canal_otp", defaults={"valeur": "email"})
        self.personnel.email = "agent.otp@example.com"
        self.personnel.save()
        rf = APIRequestFactory()
        req = rf.post("/api/auth/otp/demander/", {"telephone": "0701234567"}, format="json")
        resp = demander_otp(req)
        self.assertEqual(resp.status_code, 200)
        self.assertIn("email", resp.data.get("message", "").lower())
        self.assertIn("agent.otp@example.com", resp.data.get("message", ""))
        self.assertNotIn("SMS", resp.data.get("message", ""))
        otp = CodeOTP.objects.filter(telephone="0701234567").order_by("-date_creation").first()
        self.assertIsNotNone(otp)

    def test_demander_otp_canal_sms_message_mentionne_sms_pas_email(self):
        """Non-regression : le canal par defaut (sms) doit garder un
        message mentionnant SMS, pas 'email' - le message est bien
        canal-aware dans les deux sens."""
        from rest_framework.test import APIRequestFactory
        from .views import demander_otp
        rf = APIRequestFactory()
        req = rf.post("/api/auth/otp/demander/", {"telephone": "0701234567"}, format="json")
        resp = demander_otp(req)
        self.assertEqual(resp.status_code, 200)
        self.assertIn("SMS", resp.data.get("message", ""))


class EmailProviderTests(TestCase):
    """Fournisseurs email (accounts/email_providers/) - meme structure de
    tests que ProviderFactoryTests pour les fournisseurs SMS."""

    def test_test_provider_reussit_sans_reseau(self):
        from .email_providers import EmailProviderFactory
        provider = EmailProviderFactory.get("test")
        ok, info = provider.envoyer("agent@example.com", "Sujet", "<p>Corps</p>", "Corps")
        self.assertTrue(ok)
        self.assertEqual(info, "mode_test")

    def test_fournisseur_inconnu_renvoie_none(self):
        from .email_providers import EmailProviderFactory
        self.assertIsNone(EmailProviderFactory.get("inconnu"))

    def test_resend_sans_cle_api_echoue_proprement(self):
        from .email_providers import EmailProviderFactory
        provider = EmailProviderFactory.get("resend")
        ok, info = provider.envoyer("agent@example.com", "Sujet", "<p>Corps</p>")
        self.assertFalse(ok)
        self.assertIn("clé API", info)

    @patch("requests.post")
    def test_resend_envoi_reussi_mocke(self, mock_post):
        Parametre.objects.update_or_create(cle="resend_api_key", defaults={"valeur": "re_test_key"})
        Parametre.objects.update_or_create(cle="resend_email_from", defaults={"valeur": "onboarding@resend.dev"})
        mock_post.return_value.status_code = 200
        mock_post.return_value.content = b'{"id": "abc-123"}'
        mock_post.return_value.json.return_value = {"id": "abc-123"}
        from .email_providers import EmailProviderFactory
        provider = EmailProviderFactory.get("resend")
        ok, info = provider.envoyer("agent@example.com", "Sujet", "<p>Corps</p>", "Corps")
        self.assertTrue(ok)
        appel = mock_post.call_args
        self.assertEqual(appel.args[0], "https://api.resend.com/emails")
        self.assertEqual(appel.kwargs["json"]["to"], ["agent@example.com"])
        self.assertEqual(appel.kwargs["headers"]["Authorization"], "Bearer re_test_key")
        self.assertIn("abc-123", info)

    @patch("requests.post")
    def test_resend_utilise_toujours_ladresse_configuree_jamais_une_valeur_en_dur(self, mock_post):
        """
        Regression explicite suite a un signalement ("tu ne dois pas coder
        en dur, tu dois t'appuyer sur l'adresse introduite dans Paramétrage")
        : configure un domaine PERSONNALISE (celui reellement verifie et
        utilise en production : notifications@mail.roxgold-sitelife.com,
        different de la valeur par defaut onboarding@resend.dev) et verifie
        que c'est EXACTEMENT cette adresse qui part dans la requete Resend -
        preuve que rien n'est code en dur, le code lit bien
        Parametre.get("resend_email_from") a chaque envoi.
        """
        Parametre.objects.update_or_create(cle="resend_api_key", defaults={"valeur": "re_test_key"})
        Parametre.objects.update_or_create(cle="resend_email_from", defaults={"valeur": "notifications@mail.roxgold-sitelife.com"})
        Parametre.objects.update_or_create(cle="resend_email_from_nom", defaults={"valeur": "Roxgold SiteLife"})
        mock_post.return_value.status_code = 200
        mock_post.return_value.content = b'{"id": "abc-123"}'
        mock_post.return_value.json.return_value = {"id": "abc-123"}
        from .email_providers import EmailProviderFactory
        provider = EmailProviderFactory.get("resend")
        ok, info = provider.envoyer("agent@example.com", "Sujet", "<p>Corps</p>", "Corps")
        self.assertTrue(ok)
        appel = mock_post.call_args
        self.assertEqual(appel.kwargs["json"]["from"], "Roxgold SiteLife <notifications@mail.roxgold-sitelife.com>")
        self.assertNotIn("onboarding@resend.dev", appel.kwargs["json"]["from"])

    @patch("requests.post")
    def test_resend_domaine_non_verifie_403_message_clair(self, mock_post):
        """Cas attendu tant qu'aucun domaine n'est vérifié dans Resend
        (ou onboarding@resend.dev utilisé hors mode test) - le message
        doit expliquer la cause, jamais un 500 muet."""
        Parametre.objects.update_or_create(cle="resend_api_key", defaults={"valeur": "re_test_key"})
        mock_post.return_value.status_code = 403
        mock_post.return_value.content = b'{}'
        mock_post.return_value.json.return_value = {}
        from .email_providers import EmailProviderFactory
        provider = EmailProviderFactory.get("resend")
        ok, info = provider.envoyer("agent@example.com", "Sujet", "<p>Corps</p>")
        self.assertFalse(ok)
        self.assertIn("domaine", info.lower())


class AuditLoginTrackingTests(TestCase):
    """
    Les connexions (mot de passe ET OTP) doivent desormais laisser une
    trace dans AuditLog (accounts/audit.py::journaliser_connexion) - avant
    ce correctif, aucune connexion n'etait journalisee, ce qui donnait
    l'impression que seules les actions admin (ajustement stock boutique)
    apparaissaient dans l'audit trail.
    """

    def setUp(self):
        Parametre.objects.update_or_create(cle="sms_provider", defaults={"valeur": "test"})
        self.user = User.objects.create_user("jdoe", "j@example.com", "motdepasse123")
        from residences.models import Personnel
        self.personnel = Personnel.objects.create(
            nom="Doe", prenom="Jane", societe="ROXGOLD", numero="AUD1",
            telephone="0709998877", type_personnel="roxgold", user=self.user,
        )

    def test_login_reussi_journalise(self):
        from restauration.models import AuditLog
        resp = self.client.post("/api/auth/login/", {"username": "jdoe", "password": "motdepasse123"}, format="json")
        self.assertEqual(resp.status_code, 200)
        entry = AuditLog.objects.filter(module="connexion", action="login_reussi").first()
        self.assertIsNotNone(entry)
        self.assertEqual(entry.utilisateur, self.user)

    def test_login_mauvais_mot_de_passe_journalise_echec_sans_utilisateur(self):
        from restauration.models import AuditLog
        resp = self.client.post("/api/auth/login/", {"username": "jdoe", "password": "faux"}, format="json")
        self.assertEqual(resp.status_code, 401)
        entry = AuditLog.objects.filter(module="connexion", action="login_echec").first()
        self.assertIsNotNone(entry)
        self.assertIsNone(entry.utilisateur)
        self.assertIn("jdoe", entry.detail)

    def test_login_compte_desactive_journalise(self):
        """
        Django's ModelBackend.authenticate() rejette deja les comptes
        is_active=False (user_can_authenticate()) - authenticate() renvoie
        donc None avant meme d'atteindre le controle is_active explicite de
        custom_login. Le compte desactive est donc journalise comme un
        echec d'authentification standard (branche 'not user'), avec
        l'identifiant tente dans le detail - toujours tracable, meme si ce
        n'est pas le message 'compte desactive' specifique.
        """
        from restauration.models import AuditLog
        self.user.is_active = False
        self.user.save()
        resp = self.client.post("/api/auth/login/", {"username": "jdoe", "password": "motdepasse123"}, format="json")
        self.assertEqual(resp.status_code, 401)
        entry = AuditLog.objects.filter(module="connexion", action="login_echec").first()
        self.assertIsNotNone(entry)
        self.assertIsNone(entry.utilisateur)
        self.assertIn("jdoe", entry.detail)

    def test_verifier_otp_reussi_journalise(self):
        from restauration.models import AuditLog
        from rest_framework.test import APIRequestFactory
        from .views import verifier_otp
        otp = CodeOTP.objects.create(
            telephone="0709998877", code="654321",
            expire_le=timezone.now() + timedelta(minutes=5),
        )
        rf = APIRequestFactory()
        req = rf.post("/api/auth/otp/verifier/", {"telephone": "0709998877", "code": "654321"}, format="json")
        resp = verifier_otp(req)
        self.assertEqual(resp.status_code, 200)
        entry = AuditLog.objects.filter(module="connexion", action="login_reussi").first()
        self.assertIsNotNone(entry)
        self.assertEqual(entry.utilisateur, self.user)


class ModeTestVisibiliteTests(TestCase):
    """
    Signalement : "le mail n'est pas parti" alors que la reponse ne
    montrait aucune erreur - cause probable : le fournisseur configure
    (Paramétrage) est reste sur 'test' (qui repond toujours ok=True sans
    rien envoyer reellement), ce qui etait indiscernable d'un vrai envoi
    reussi cote reponse API/interface. Ces tests verifient que le mode
    test est desormais signale EXPLICITEMENT, pour que ce cas ne puisse
    plus passer inapercu.
    """

    def setUp(self):
        Parametre.objects.update_or_create(cle="sms_provider", defaults={"valeur": "test"})
        Parametre.objects.update_or_create(cle="canal_otp", defaults={"valeur": "sms"})
        self.user = User.objects.create_user("modetest", "m@m.com", "pass")
        from residences.models import Personnel
        self.personnel = Personnel.objects.create(
            nom="Mode", prenom="Test", societe="ROXGOLD", numero="MTX1",
            telephone="0700001111", numero_whatsapp="0700001111",
            type_personnel="roxgold", user=self.user,
        )

    def test_demander_otp_signale_le_mode_test_dans_le_message(self):
        from rest_framework.test import APIRequestFactory
        from .views import demander_otp
        rf = APIRequestFactory()
        req = rf.post("/api/auth/otp/demander/", {"telephone": "0700001111"}, format="json")
        resp = demander_otp(req)
        self.assertEqual(resp.status_code, 200)
        self.assertTrue(resp.data.get("mode_test"))
        self.assertIn("mode test", resp.data.get("message", "").lower())

    def test_envoyer_identifiants_signale_le_mode_test_sms(self):
        from .notifications import envoyer_identifiants
        envoi = envoyer_identifiants(self.personnel, "u_test", "Xx1!aaaa")
        self.assertTrue(envoi["ok"])
        self.assertTrue(envoi["mode_test"])

    def test_envoyer_identifiants_signale_le_mode_test_email(self):
        Parametre.objects.update_or_create(cle="canal_otp", defaults={"valeur": "email"})
        Parametre.objects.update_or_create(cle="email_provider", defaults={"valeur": "test"})
        self.personnel.email = "mode.test@example.com"
        self.personnel.save()
        from .notifications import envoyer_identifiants
        envoi = envoyer_identifiants(self.personnel, "u_test", "Xx1!aaaa")
        self.assertTrue(envoi["ok"])
        self.assertTrue(envoi["mode_test"])

    def test_envoyer_identifiants_mode_test_false_quand_fournisseur_reel_configure(self):
        """Une fois un vrai fournisseur configure (resend), mode_test doit
        redevenir False - sinon l'avertissement s'afficherait a tort meme
        sur un envoi reellement livre."""
        from unittest.mock import patch as _patch
        Parametre.objects.update_or_create(cle="canal_otp", defaults={"valeur": "email"})
        Parametre.objects.update_or_create(cle="email_provider", defaults={"valeur": "resend"})
        Parametre.objects.update_or_create(cle="resend_api_key", defaults={"valeur": "re_test_key"})
        Parametre.objects.update_or_create(cle="resend_email_from", defaults={"valeur": "notifications@mail.roxgold-sitelife.com"})
        self.personnel.email = "reel@example.com"
        self.personnel.save()
        with _patch("requests.post") as mock_post:
            mock_post.return_value.status_code = 200
            mock_post.return_value.content = b'{"id": "abc-123"}'
            mock_post.return_value.json.return_value = {"id": "abc-123"}
            from .notifications import envoyer_identifiants
            envoi = envoyer_identifiants(self.personnel, "u_test", "Xx1!aaaa")
        self.assertTrue(envoi["ok"])
        self.assertFalse(envoi["mode_test"])


class AuthMeRoleTests(TestCase):
    """/api/auth/me/ doit renvoyer le VRAI rôle (avant : 'agent' pour tout non-superadmin)."""

    def test_role_reel_renvoye(self):
        from django.contrib.auth.models import User
        from rest_framework.test import APIClient
        from accounts.models import Profile
        u = User.objects.create_user("bar", password="x", first_name="Koffi", last_name="Bar")
        Profile.objects.update_or_create(user=u, defaults={"role": "boutique"})
        c = APIClient(); c.force_authenticate(User.objects.get(pk=u.pk))
        d = c.get("/api/auth/me/").data
        self.assertEqual(d["profile"]["role"], "boutique")
        self.assertEqual((d["first_name"], d["last_name"]), ("Koffi", "Bar"))


class SynchroniserProfilsTests(TestCase):
    def test_alignement_sans_toucher_aux_admins(self):
        from django.contrib.auth.models import User
        from accounts.models import Profile, RoleCustom
        from accounts.profils import synchroniser_profils
        from residences.models import Personnel
        for code in ("hse", "restauration"):
            RoleCustom.objects.get_or_create(code=code, defaults={"label": code})
        def perso(nom, profil, role, staff=False):
            u = User.objects.create_user(nom, password="x", is_staff=staff)
            Profile.objects.update_or_create(user=u, defaults={"role": role})
            return Personnel.objects.create(nom=nom, prenom="T", societe="S", profil=profil, user=u), u
        a, ua = perso("a", "hse", "agent")                 # nouveau profil, rôle par défaut -> rôle = hse
        b, ub = perso("b", "agent", "restauration")        # rôle explicite, profil défaut -> profil = restauration
        c, uc = perso("c", "restaurant", "agent")          # ancien code -> restauration
        d, ud = perso("d", "hse", "agent", staff=True)     # admin : intact
        r = synchroniser_profils()
        for u in (ua, ub, uc, ud): u.profile.refresh_from_db()
        for x in (a, b, c, d): x.refresh_from_db()
        self.assertEqual(ua.profile.role, "hse")
        self.assertEqual((ub.profile.role, b.profil), ("restauration", "restauration"))
        self.assertEqual(uc.profile.role, "restauration")
        self.assertEqual((ud.profile.role, d.profil), ("agent", "hse"))
        self.assertEqual(synchroniser_profils()["role_mis_a_jour"], 0)  # idempotent
