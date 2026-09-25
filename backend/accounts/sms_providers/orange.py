"""
Fournisseur Orange SMS API (Cote d'Ivoire) - meme logique exacte que
l'ancien accounts/sms.py::_envoyer_orange, deplacee ici sans changement
fonctionnel. Verifie via developer.orange.com (deja utilise/documente
dans une session precedente du projet).
"""
from .base import SMSProvider
from ..models import Parametre


class OrangeProvider(SMSProvider):
    code = "orange"

    def envoyer(self, numero, message, canal="sms"):
        if canal == "whatsapp":
            return False, "Orange SMS API ne gère pas WhatsApp — configurez whatsapp_provider=meta pour ce canal."
        client_id = Parametre.get("sms_orange_client_id", "")
        client_secret = Parametre.get("sms_orange_client_secret", "")
        depuis = Parametre.get("sms_orange_from", "")
        if not (client_id and client_secret and depuis):
            return False, "Orange SMS API non configuré (client_id/secret/numéro manquant)"
        try:
            import requests
            token_resp = requests.post(
                "https://api.orange.com/oauth/v3/token",
                auth=(client_id, client_secret),
                data={"grant_type": "client_credentials"},
                timeout=10,
            )
            token_resp.raise_for_status()
            access_token = token_resp.json()["access_token"]
            sms_resp = requests.post(
                f"https://api.orange.com/smsmessaging/v1/outbound/{depuis}/requests",
                headers={"Authorization": f"Bearer {access_token}", "Content-Type": "application/json"},
                json={"outboundSMSMessageRequest": {
                    "address": [f"tel:{numero}"],
                    "senderAddress": f"tel:{depuis}",
                    "outboundSMSTextMessage": {"message": message},
                }},
                timeout=10,
            )
            sms_resp.raise_for_status()
            return True, "envoyé via Orange SMS API"
        except Exception as e:
            return False, f"Erreur Orange SMS API : {e}"
