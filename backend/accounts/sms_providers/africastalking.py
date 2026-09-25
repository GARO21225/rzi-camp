"""
Fournisseur Africa's Talking - meme logique exacte que l'ancien
accounts/sms.py::_envoyer_africastalking, deplacee ici sans changement
fonctionnel.
"""
from .base import SMSProvider
from ..models import Parametre


class AfricasTalkingProvider(SMSProvider):
    code = "africastalking"

    def envoyer(self, numero, message, canal="sms"):
        if canal == "whatsapp":
            return False, "Africa's Talking ne gère pas WhatsApp dans cette intégration — configurez whatsapp_provider=meta pour ce canal."
        username = Parametre.get("sms_at_username", "")
        api_key = Parametre.get("sms_at_api_key", "")
        if not (username and api_key):
            return False, "Africa's Talking non configuré (username/api_key manquant)"
        try:
            import africastalking
            africastalking.initialize(username, api_key)
            sms = africastalking.SMS
            sms.send(message, [numero])
            return True, "envoyé via Africa's Talking"
        except ImportError:
            return False, "Le paquet 'africastalking' n'est pas installé (pip install africastalking)"
        except Exception as e:
            return False, f"Erreur Africa's Talking : {e}"
