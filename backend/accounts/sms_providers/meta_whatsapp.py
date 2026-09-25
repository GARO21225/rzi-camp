"""
Fournisseur API WhatsApp Business officielle de Meta - meme logique
exacte que l'ancien accounts/sms.py::_envoyer_meta_whatsapp, deplacee ici
sans changement fonctionnel. Independant de Twilio - gere uniquement le
canal WhatsApp (pas de SMS classique), via des modeles de message
pre-approuves (contrainte imposee par Meta pour tout premier contact).
"""
from .base import SMSProvider
from ..models import Parametre
from ..phone import vers_international


class MetaWhatsAppProvider(SMSProvider):
    code = "meta"

    def envoyer(self, numero, message, canal="sms"):
        if canal != "whatsapp":
            return False, "Le fournisseur Meta ne gère que le canal WhatsApp"
        phone_number_id = Parametre.get("meta_whatsapp_phone_number_id", "")
        access_token = Parametre.get("meta_whatsapp_access_token", "")
        template_name = Parametre.get("meta_whatsapp_template_name", "")
        template_lang = Parametre.get("meta_whatsapp_template_lang", "fr") or "fr"
        if not (phone_number_id and access_token and template_name):
            return False, "API Meta WhatsApp non configurée (Phone Number ID / Access Token / nom du modèle manquant)"
        try:
            import requests
            numero_e164 = vers_international(numero)
            resp = requests.post(
                f"https://graph.facebook.com/v21.0/{phone_number_id}/messages",
                headers={"Authorization": f"Bearer {access_token}", "Content-Type": "application/json"},
                json={
                    "messaging_product": "whatsapp",
                    "to": numero_e164.lstrip("+"),
                    "type": "template",
                    "template": {
                        "name": template_name,
                        "language": {"code": template_lang},
                        "components": [{"type": "body", "parameters": [{"type": "text", "text": message}]}],
                    },
                },
                timeout=10,
            )
            if resp.status_code >= 400:
                return False, f"Erreur API Meta WhatsApp ({resp.status_code}) : {resp.text[:200]}"
            return True, "envoyé via l'API Meta WhatsApp"
        except Exception as e:
            return False, f"Erreur API Meta WhatsApp : {e}"
