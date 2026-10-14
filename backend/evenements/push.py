"""Web Push (RFC 8030 / 8291 / 8292) sans dépendance externe : uniquement `cryptography` + `requests`.
Un push arrive même quand l'application est fermée (PWA installée) et fait sonner / vibrer le téléphone."""
import base64
import json
import logging
import os
import time
from concurrent.futures import ThreadPoolExecutor
from urllib.parse import urlparse

import requests
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives.asymmetric.utils import decode_dss_signature
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.hkdf import HKDF

log = logging.getLogger(__name__)
_pool = ThreadPoolExecutor(max_workers=4, thread_name_prefix="webpush")


def _b64u(b):
    return base64.urlsafe_b64encode(b).rstrip(b"=").decode()


def _unb64u(s):
    return base64.urlsafe_b64decode(s + "=" * (-len(s) % 4))


def _pub_bytes(pub):
    return pub.public_bytes(serialization.Encoding.X962, serialization.PublicFormat.UncompressedPoint)


def cles():
    """(clé privée EC, clé publique b64url) — créées et enregistrées au premier appel."""
    from .models import VapidCle
    k = VapidCle.objects.first()
    if not k:
        priv = ec.generate_private_key(ec.SECP256R1())
        k = VapidCle.objects.create(
            publique=_b64u(_pub_bytes(priv.public_key())),
            privee_pem=priv.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8, serialization.NoEncryption()).decode(),
        )
    return serialization.load_pem_private_key(k.privee_pem.encode(), None), k.publique


def cle_publique():
    return cles()[1]


def chiffrer(payload: bytes, p256dh: str, auth: str, *, ephemere=None, sel=None):
    """Corps `aes128gcm` d'un message Web Push (RFC 8291)."""
    ua_pub = _unb64u(p256dh)
    eph = ephemere or ec.generate_private_key(ec.SECP256R1())
    as_pub = _pub_bytes(eph.public_key())
    secret = eph.exchange(ec.ECDH(), ec.EllipticCurvePublicKey.from_encoded_point(ec.SECP256R1(), ua_pub))
    sel = sel or os.urandom(16)
    prk = HKDF(hashes.SHA256(), 32, _unb64u(auth), b"WebPush: info\0" + ua_pub + as_pub).derive(secret)
    cek = HKDF(hashes.SHA256(), 16, sel, b"Content-Encoding: aes128gcm\0").derive(prk)
    nonce = HKDF(hashes.SHA256(), 12, sel, b"Content-Encoding: nonce\0").derive(prk)
    chiffre = AESGCM(cek).encrypt(nonce, payload + b"\x02", None)
    return sel + (4096).to_bytes(4, "big") + bytes([len(as_pub)]) + as_pub + chiffre


def _jwt_vapid(endpoint, priv, sujet):
    p = urlparse(endpoint)
    entete = _b64u(json.dumps({"typ": "JWT", "alg": "ES256"}).encode())
    corps = _b64u(json.dumps({"aud": f"{p.scheme}://{p.netloc}", "exp": int(time.time()) + 12 * 3600, "sub": sujet}).encode())
    r, s = decode_dss_signature(priv.sign(f"{entete}.{corps}".encode(), ec.ECDSA(hashes.SHA256())))
    return f"{entete}.{corps}." + _b64u(r.to_bytes(32, "big") + s.to_bytes(32, "big"))


def _envoyer_un(sub, donnees, urgent, priv, pub):
    try:
        sujet = os.environ.get("VAPID_SUBJECT") or "mailto:edgar.kouame225@gmail.com"
        r = requests.post(
            sub["endpoint"], data=chiffrer(json.dumps(donnees).encode(), sub["p256dh"], sub["auth"]), timeout=10,
            headers={"Content-Encoding": "aes128gcm", "Content-Type": "application/octet-stream",
                     "TTL": "86400", "Urgency": "high" if urgent else "normal",
                     "Authorization": f"vapid t={_jwt_vapid(sub['endpoint'], priv, sujet)}, k={pub}"})
        if r.status_code in (404, 410):   # abonnement expiré / désinstallé
            from .models import PushSubscription
            PushSubscription.objects.filter(pk=sub["id"]).delete()
        elif r.status_code >= 400:
            log.warning("webpush %s -> %s", sub["endpoint"][:60], r.status_code)
    except Exception as e:   # jamais bloquant
        log.warning("webpush échec : %s", e)


def envoyer(users, titre, corps="", url="/", urgent=False, tag=None):
    """Envoie un push à tous les appareils des `users` (iterable de User ou d'ids), en arrière-plan."""
    from django.db import transaction
    from .models import PushSubscription
    ids = [getattr(u, "pk", u) for u in users]
    if not ids:
        return
    donnees = {"titre": titre, "corps": (corps or "")[:180], "url": url, "urgent": bool(urgent), "tag": tag}

    def lancer():
        try:
            subs = list(PushSubscription.objects.filter(user_id__in=ids).values("id", "endpoint", "p256dh", "auth"))
            if not subs:
                return
            priv, pub = cles()
            for s in subs:
                _pool.submit(_envoyer_un, s, donnees, urgent, priv, pub)
        except Exception as e:
            log.warning("webpush préparation : %s", e)
    transaction.on_commit(lancer)
