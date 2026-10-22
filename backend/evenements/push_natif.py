"""Push NATIF (FCM HTTP v1) pour l'app Capacitor Android/iOS compilée — distinct de push.py (Web Push
PWA/navigateur). Sur un WebView natif, le Push API web ne livre rien quand l'app est fermée : il faut un
vrai push système, et Google impose FCM pour Android (Firebase relaie aussi à APNs côté iOS, donc un seul
jeu de credentials couvre les deux plateformes).

Volontairement SANS la dépendance `firebase-admin` (lourde, réimplémente un client HTTP complet) : on
signe soi-même le JWT du compte de service (RS256, `cryptography` — déjà utilisée par push.py pour le
Web Push) pour obtenir un jeton OAuth2, comme push.py le fait déjà pour VAPID. Mêmes garanties : jamais
d'exception remontée à l'appelant, et un simple log si les credentials FCM ne sont pas configurés —
indispensable tant qu'Edgar n'a pas créé le projet Firebase (voir CLAUDE.md, section "Pièges connus").

Configuration attendue (absente = canal natif silencieusement inactif, le reste de l'app continue) :
  FCM_SERVICE_ACCOUNT_JSON = contenu JSON complet du compte de service Firebase (Admin SDK),
                              généré dans Firebase Console > Paramètres du projet > Comptes de service.
"""
import json
import logging
import os
import time
from concurrent.futures import ThreadPoolExecutor

import requests
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding

log = logging.getLogger(__name__)
_pool = ThreadPoolExecutor(max_workers=4, thread_name_prefix="fcm")

_SCOPE = "https://www.googleapis.com/auth/firebase.messaging"
_TOKEN_URL = "https://oauth2.googleapis.com/token"

_jeton_cache = {"valeur": None, "expire": 0}
_avertissement_emis = False


def _b64u(b):
    import base64
    return base64.urlsafe_b64encode(b).rstrip(b"=").decode()


def _compte_service():
    brut = os.environ.get("FCM_SERVICE_ACCOUNT_JSON")
    if not brut:
        return None
    try:
        return json.loads(brut)
    except Exception:
        log.warning("FCM_SERVICE_ACCOUNT_JSON invalide (pas un JSON valide)")
        return None


def _jeton_acces():
    """Jeton OAuth2 (Bearer) pour l'API FCM — signe un JWT RS256 avec la clé privée du compte de service,
    l'échange contre un access_token (grant_type JWT bearer, RFC 7523). Mis en cache jusqu'à expiration."""
    if _jeton_cache["valeur"] and time.time() < _jeton_cache["expire"] - 60:
        return _jeton_cache["valeur"]
    compte = _compte_service()
    if not compte:
        return None
    maintenant = int(time.time())
    entete = _b64u(json.dumps({"alg": "RS256", "typ": "JWT"}).encode())
    corps = _b64u(json.dumps({
        "iss": compte["client_email"], "scope": _SCOPE, "aud": _TOKEN_URL,
        "iat": maintenant, "exp": maintenant + 3600,
    }).encode())
    cle = serialization.load_pem_private_key(compte["private_key"].encode(), None)
    signature = cle.sign(f"{entete}.{corps}".encode(), padding.PKCS1v15(), hashes.SHA256())
    assertion = f"{entete}.{corps}.{_b64u(signature)}"
    r = requests.post(_TOKEN_URL, data={
        "grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer", "assertion": assertion,
    }, timeout=10)
    r.raise_for_status()
    d = r.json()
    _jeton_cache["valeur"] = d["access_token"]
    _jeton_cache["expire"] = maintenant + int(d.get("expires_in", 3600))
    return _jeton_cache["valeur"]


def _envoyer_un(appareil_id, token, project_id, acces, titre, corps, url, tag):
    try:
        r = requests.post(
            f"https://fcm.googleapis.com/v1/projects/{project_id}/messages:send",
            timeout=10, headers={"Authorization": f"Bearer {acces}", "Content-Type": "application/json"},
            json={"message": {
                "token": token,
                "notification": {"title": titre, "body": corps or ""},
                "data": {"url": url or "/", "tag": tag or ""},
                "android": {"priority": "high"},
                "apns": {"headers": {"apns-priority": "10"}, "payload": {"aps": {"sound": "default"}}},
            }})
        if r.status_code == 404 or (r.status_code == 400 and "UNREGISTERED" in r.text):
            from .models import AppareilPushNatif
            AppareilPushNatif.objects.filter(pk=appareil_id).delete()
        elif r.status_code >= 400:
            log.warning("fcm %s -> %s %s", token[:24], r.status_code, r.text[:200])
    except Exception as e:  # jamais bloquant
        log.warning("fcm échec : %s", e)


def envoyer(users, titre, corps="", url="/", tag=None):
    """Envoie un push natif (FCM) à tous les appareils Android/iOS natifs des `users`. No-op silencieux
    si FCM_SERVICE_ACCOUNT_JSON n'est pas configuré. Appelée par push.envoyer() — jamais besoin de
    l'appeler directement depuis une vue."""
    global _avertissement_emis
    compte = _compte_service()
    if not compte:
        if not _avertissement_emis:
            log.info("Push natif (FCM) inactif : FCM_SERVICE_ACCOUNT_JSON non configuré.")
            _avertissement_emis = True
        return
    from django.db import transaction
    from .models import AppareilPushNatif
    ids = [getattr(u, "pk", u) for u in users]
    if not ids:
        return

    def lancer():
        try:
            appareils = list(AppareilPushNatif.objects.filter(user_id__in=ids).values("id", "token"))
            if not appareils:
                return
            acces = _jeton_acces()
            if not acces:
                return
            project_id = compte["project_id"]
            for a in appareils:
                _pool.submit(_envoyer_un, a["id"], a["token"], project_id, acces, titre, corps, url, tag)
        except Exception as e:
            log.warning("fcm préparation : %s", e)
    transaction.on_commit(lancer)
