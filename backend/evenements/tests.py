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


class WebPushTests(TestCase):
    def test_chiffrement_rfc8291_aller_retour(self):
        """Le message chiffré se déchiffre côté « navigateur » avec ses clés (RFC 8291)."""
        import base64
        from cryptography.hazmat.primitives import hashes, serialization
        from cryptography.hazmat.primitives.asymmetric import ec
        from cryptography.hazmat.primitives.ciphers.aead import AESGCM
        from cryptography.hazmat.primitives.kdf.hkdf import HKDF
        from . import push
        ua = ec.generate_private_key(ec.SECP256R1())
        ua_pub = push._pub_bytes(ua.public_key())
        auth = b"0123456789abcdef"
        corps = push.chiffrer(b'{"titre":"ok"}', push._b64u(ua_pub), push._b64u(auth))
        sel, idlen = corps[:16], corps[20]
        as_pub, chiffre = corps[21:21 + idlen], corps[21 + idlen:]
        secret = ua.exchange(ec.ECDH(), ec.EllipticCurvePublicKey.from_encoded_point(ec.SECP256R1(), as_pub))
        prk = HKDF(hashes.SHA256(), 32, auth, b"WebPush: info\0" + ua_pub + as_pub).derive(secret)
        cek = HKDF(hashes.SHA256(), 16, sel, b"Content-Encoding: aes128gcm\0").derive(prk)
        nonce = HKDF(hashes.SHA256(), 12, sel, b"Content-Encoding: nonce\0").derive(prk)
        clair = AESGCM(cek).decrypt(nonce, chiffre, None)
        self.assertEqual(clair, b'{"titre":"ok"}\x02')

    def test_abonnement_et_push_sur_notification(self):
        from unittest import mock
        from django.contrib.auth.models import User
        from rest_framework.test import APIClient
        from .models import SimpleNotification, PushSubscription
        u = User.objects.create_user("pushu", "p@a.com", "pass")
        c = APIClient(); c.force_authenticate(u)
        self.assertTrue(c.get("/api/push/cle/").data["cle"])
        r = c.post("/api/push/abonner/", {"subscription": {"endpoint": "https://push.example/abc", "keys": {"p256dh": "BP" + "A" * 85, "auth": "A" * 22}}}, format="json")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(PushSubscription.objects.filter(user=u).count(), 1)
        appels = []
        with mock.patch("evenements.push._envoyer_un", side_effect=lambda *a: appels.append(a)):
            with self.captureOnCommitCallbacks(execute=True):
                SimpleNotification.objects.create(user=u, titre="Événement", message="x", type_notif="alerte")
            import time; time.sleep(0.3)
        self.assertEqual(len(appels), 1)
        self.assertTrue(appels[0][2])  # urgent

    def test_push_natif_sans_credentials_fcm_ne_plante_pas(self):
        """FCM_SERVICE_ACCOUNT_JSON absent (cas par défaut tant qu'Edgar n'a pas créé le projet
        Firebase) : push.envoyer() doit continuer silencieusement, sans exception ni appel réseau."""
        from unittest import mock
        from django.contrib.auth.models import User
        from . import push, push_natif
        u = User.objects.create_user("sanscred", "s@a.com", "pass")
        with mock.patch.dict("os.environ", {}, clear=False):
            import os
            os.environ.pop("FCM_SERVICE_ACCOUNT_JSON", None)
            with mock.patch("requests.post") as m:
                with self.captureOnCommitCallbacks(execute=True):
                    push.envoyer([u.pk], "Titre", "corps")
                self.assertFalse(m.called)

    def test_enregistrement_jeton_natif_puis_envoi_fcm(self):
        """Un appareil Android enregistré reçoit bien un appel FCM v1 (requests.post mocké), avec le
        bon jeton OAuth2 signé à partir du compte de service."""
        import json as _json
        from unittest import mock
        from django.contrib.auth.models import User
        from rest_framework.test import APIClient
        from cryptography.hazmat.primitives.asymmetric import rsa
        from cryptography.hazmat.primitives import serialization
        from .models import AppareilPushNatif
        from . import push_natif

        u = User.objects.create_user("natifu", "n@a.com", "pass")
        c = APIClient(); c.force_authenticate(u)
        r = c.post("/api/push/token-natif/", {"token": "FCM-TOKEN-ABC", "plateforme": "android"}, format="json")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(AppareilPushNatif.objects.filter(user=u, plateforme="android").count(), 1)

        r = c.post("/api/push/token-natif/", {"token": "mauvais", "plateforme": "windows"}, format="json")
        self.assertEqual(r.status_code, 400)

        cle = rsa.generate_private_key(public_exponent=65537, key_size=2048)
        pem = cle.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8, serialization.NoEncryption()).decode()
        compte = _json.dumps({"client_email": "svc@test.iam.gserviceaccount.com", "private_key": pem, "project_id": "rzi-camp-test"})

        appels = []
        def _post_fake(url, **kw):
            appels.append((url, kw))
            if "oauth2.googleapis.com" in url:
                return mock.Mock(status_code=200, json=lambda: {"access_token": "abc123", "expires_in": 3600}, raise_for_status=lambda: None)
            return mock.Mock(status_code=200, text="{}")

        with mock.patch.dict("os.environ", {"FCM_SERVICE_ACCOUNT_JSON": compte}):
            push_natif._jeton_cache.update({"valeur": None, "expire": 0})
            with mock.patch("requests.post", side_effect=_post_fake):
                with self.captureOnCommitCallbacks(execute=True):
                    push_natif.envoyer([u.pk], "Titre", "Corps", "/x")
                import time; time.sleep(0.3)
        self.assertEqual(len(appels), 2)  # 1 échange OAuth2 + 1 envoi FCM
        self.assertIn("fcm.googleapis.com/v1/projects/rzi-camp-test/messages:send", appels[1][0])
        self.assertEqual(appels[1][1]["headers"]["Authorization"], "Bearer abc123")

    def test_jwt_vapid_verifiable_avec_la_cle_publique(self):
        from cryptography.hazmat.primitives import hashes
        from cryptography.hazmat.primitives.asymmetric import ec
        from cryptography.hazmat.primitives.asymmetric.utils import encode_dss_signature
        from . import push
        priv, pub = push.cles()
        jwt = push._jwt_vapid("https://fcm.googleapis.com/fcm/send/xyz", priv, "mailto:a@b.c")
        e, c, sig = jwt.split(".")
        raw = push._unb64u(sig)
        cle = ec.EllipticCurvePublicKey.from_encoded_point(ec.SECP256R1(), push._unb64u(pub))
        cle.verify(encode_dss_signature(int.from_bytes(raw[:32], "big"), int.from_bytes(raw[32:], "big")), f"{e}.{c}".encode(), ec.ECDSA(hashes.SHA256()))
