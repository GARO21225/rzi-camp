"""
Fournisseur proSMS (prosms.ci, par Afruxia) - documentation officielle
verifiee (prosms.ci/documentation, v1.3, consultee directement) avant
toute implementation, conformement a la regle du prompt d'integration
qui interdit d'inventer un endpoint/parametre/header.

BASE_URL: https://prosms.ci/api/v1
Authentification : en-tetes X-Client-ID / X-Client-Secret (pas de
Bearer token, pas d'OAuth - verifie).
Envoi : POST /sms/send avec {"recipients":["+225..."], "message":"...",
"sender_name":"..." (optionnel, max 11 car., doit etre pre-approuve
sinon 403)}.

Cette integration utilise UNIQUEMENT /sms/send comme transport brut, pas
le systeme OTP propre a proSMS (/otp/send, /otp/verify) - le projet a
deja son propre modele CodeOTP (expiration, anti-bruteforce, historique)
qu'il ne faut pas dupliquer ; proSMS ne sert ici qu'a acheminer le SMS
contenant CE code, exactement comme les autres fournisseurs deja
integres (Twilio, Orange, Africa's Talking).
"""
from .base import SMSProvider
from ..models import Parametre
from ..phone import vers_international


class ProSMSProvider(SMSProvider):
    code = "prosms"
    BASE_URL = "https://prosms.ci/api/v1"

    def _headers(self):
        return {
            "X-Client-ID": Parametre.get("sms_prosms_client_id", ""),
            "X-Client-Secret": Parametre.get("sms_prosms_client_secret", ""),
            "Content-Type": "application/json",
        }

    def envoyer(self, numero, message, canal="sms"):
        if canal == "whatsapp":
            return False, "proSMS ne gère pas WhatsApp — configurez whatsapp_provider=meta pour ce canal."
        client_id = Parametre.get("sms_prosms_client_id", "")
        client_secret = Parametre.get("sms_prosms_client_secret", "")
        if not (client_id and client_secret):
            return False, "proSMS non configuré (Client ID / Client Secret manquant — à générer depuis prosms.ci/api-credentials)"

        sender_name = Parametre.get("sms_prosms_sender_id", "")
        numero_e164 = vers_international(numero)
        payload = {"recipients": [numero_e164], "message": message}
        if sender_name:
            payload["sender_name"] = sender_name

        try:
            import requests
            resp = requests.post(f"{self.BASE_URL}/sms/send", headers=self._headers(), json=payload, timeout=10)
            if resp.status_code == 401:
                return False, "proSMS : Client ID / Client Secret invalides ou identifiant désactivé."
            if resp.status_code == 402:
                d = resp.json().get("data", {})
                return False, f"proSMS : crédits SMS insuffisants (requis {d.get('required','?')}, disponible {d.get('available','?')})."
            if resp.status_code == 403:
                return False, "proSMS : ce Sender ID n'est pas approuvé pour votre compte."
            if resp.status_code == 422:
                return False, f"proSMS : données invalides — {resp.json().get('errors', resp.text[:200])}"
            if resp.status_code == 429:
                return False, "proSMS : limite de requêtes atteinte, réessayez plus tard."
            resp.raise_for_status()
            data = resp.json().get("data", {})
            if data.get("failed", 0) and not data.get("sent", 0):
                return False, "proSMS : envoi échoué côté opérateur."
            return True, f"envoyé via proSMS (campagne #{data.get('campaign_id','?')})"
        except requests.exceptions.RequestException as e:
            return False, f"Erreur réseau proSMS : {e}"
        except Exception as e:
            return False, f"Erreur proSMS : {e}"

    def get_balance(self):
        client_id = Parametre.get("sms_prosms_client_id", "")
        client_secret = Parametre.get("sms_prosms_client_secret", "")
        if not (client_id and client_secret):
            return None
        try:
            import requests
            resp = requests.get(f"{self.BASE_URL}/account", headers=self._headers(), timeout=10)
            resp.raise_for_status()
            return resp.json().get("data", {}).get("sms_credits")
        except Exception:
            return None

    def get_status(self, message_id):
        client_id = Parametre.get("sms_prosms_client_id", "")
        client_secret = Parametre.get("sms_prosms_client_secret", "")
        if not (client_id and client_secret):
            return False, "proSMS non configuré"
        try:
            import requests
            resp = requests.get(f"{self.BASE_URL}/campaigns/{message_id}", headers=self._headers(), timeout=10)
            if resp.status_code == 404:
                return False, "Campagne introuvable"
            resp.raise_for_status()
            d = resp.json().get("data", {})
            return True, f"{d.get('status','?')} — {d.get('delivered_count',0)}/{d.get('recipients_count',0)} livrés"
        except Exception as e:
            return False, f"Erreur proSMS : {e}"
