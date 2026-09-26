"""
Fournisseur HSMS (hsms.ci) - documentation officielle verifiee directement
(hsms.ci/api/documentation/, section API Legacy - la doc precise elle-meme
que cette API "est toujours fonctionnelle et supportee", la v2 recommandee
pour les nouvelles integrations est une console interactive en JavaScript
que je n'ai pas pu lire pour en verifier le contenu exact - implementer
contre la Legacy documentee integralement est le choix responsable ici,
plutot que deviner la v2).

Authentification en deux couches (verifiee) :
- Token Bearer (persistant, obtenu une fois via email+mot de passe sur
  POST /api/token/, ou directement copie depuis le tableau de bord HSMS -
  c'est ce que l'utilisateur a fourni ici).
- clientid + clientsecret (par application HSMS), envoyes dans le CORPS
  de chaque requete, en plus du token.

BASE_URL: https://hsms.ci/api/
Envoi : POST /api/envoi-sms
Solde : POST /api/check-sms
Format telephone attendu : indicatif pays SANS le "+" (ex: 2250700000001).
"""
from .base import SMSProvider
from ..models import Parametre
from ..phone import vers_international


class HSMSProvider(SMSProvider):
    code = "hsms"
    BASE_URL = "https://hsms.ci/api"

    def _identifiants(self):
        return (
            Parametre.get("sms_hsms_token", ""),
            Parametre.get("sms_hsms_client_id", ""),
            Parametre.get("sms_hsms_client_secret", ""),
        )

    def envoyer(self, numero, message, canal="sms"):
        if canal == "whatsapp":
            return False, "HSMS ne gère pas WhatsApp — configurez whatsapp_provider=meta pour ce canal."
        token, client_id, client_secret = self._identifiants()
        if not (token and client_id and client_secret):
            return False, "HSMS non configuré (Token / Client ID / Client Secret manquant — depuis le tableau de bord hsms.ci, onglet « Identifiants API » de votre application)"

        # HSMS attend l'indicatif SANS le "+" (ex: 2250700000001) - phone.py
        # renvoie "+225..." par defaut, on retire juste le prefixe.
        numero_e164 = vers_international(numero).lstrip("+")
        try:
            import requests
            resp = requests.post(
                f"{self.BASE_URL}/envoi-sms",
                headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
                json={"clientid": client_id, "clientsecret": client_secret, "telephone": numero_e164, "message": message},
                timeout=10,
            )
            try:
                data = resp.json()
            except ValueError:
                data = {}
            if resp.status_code == 401:
                return False, "HSMS : token invalide ou expiré — régénérez-le depuis le tableau de bord."
            if resp.status_code == 400:
                return False, f"HSMS : {data.get('message', 'requête invalide (identifiants, numéro ou solde insuffisant)')}"
            if resp.status_code >= 400:
                return False, f"Erreur HSMS ({resp.status_code}) : {data.get('message', resp.text[:200])}"
            if data.get("success") is False:
                return False, f"HSMS : {data.get('message', 'échec non précisé')}"
            return True, "envoyé via HSMS"
        except requests.exceptions.RequestException as e:
            return False, f"Erreur réseau HSMS : {e}"
        except Exception as e:
            return False, f"Erreur HSMS : {e}"

    def get_balance(self):
        token, client_id, client_secret = self._identifiants()
        if not (token and client_id and client_secret):
            return None
        try:
            import requests
            resp = requests.post(
                f"{self.BASE_URL}/check-sms",
                headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
                json={"clientid": client_id, "clientsecret": client_secret},
                timeout=10,
            )
            resp.raise_for_status()
            return resp.json().get("SMS disponibles")
        except Exception:
            return None
