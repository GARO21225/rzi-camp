"""
Fournisseur Twilio - EN COURS DE RETRAIT (demande explicite : supprimer
Twilio du projet). Conserve pour l'instant en tant qu'adapter derriere
l'abstraction, exactement la meme logique que l'ancien
accounts/sms.py::_envoyer_twilio, pour ne pas casser un deploiement qui
l'utiliserait encore pendant la periode de transition vers proSMS/HSMS.
A retirer completement une fois proSMS confirme et actif en production.
"""
from .base import SMSProvider
from ..models import Parametre


class TwilioProvider(SMSProvider):
    code = "twilio"

    def envoyer(self, numero, message, canal="sms"):
        sid = Parametre.get("sms_twilio_account_sid", "")
        token = Parametre.get("sms_twilio_auth_token", "")
        depuis = Parametre.get("sms_twilio_from", "")
        if not (sid and token and depuis):
            return False, "Twilio non configuré (SID/token/numéro expéditeur manquant)"
        try:
            from twilio.rest import Client
            client = Client(sid, token)
            if canal == "whatsapp":
                # Le numero expediteur Twilio doit etre approuve WhatsApp
                # Business - prefixe "whatsapp:" requis des deux cotes.
                client.messages.create(body=message, from_=f"whatsapp:{depuis}", to=f"whatsapp:{numero}")
                return True, "envoyé via Twilio WhatsApp"
            client.messages.create(body=message, from_=depuis, to=numero)
            return True, "envoyé via Twilio"
        except ImportError:
            return False, "Le paquet 'twilio' n'est pas installé (pip install twilio)"
        except Exception as e:
            return False, f"Erreur Twilio : {e}"
