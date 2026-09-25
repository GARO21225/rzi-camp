"""
Fournisseur 'test' - n'envoie rien reellement, journalise et renvoie le
message tel quel (pour valider tout le flux OTP/notifications avant de
payer/configurer un vrai fournisseur). Comportement identique a l'ancien
accounts/sms.py, deplace ici sans changement fonctionnel.
"""
from .base import SMSProvider


class TestProvider(SMSProvider):
    code = "test"

    def envoyer(self, numero, message, canal="sms"):
        suffixe = "/WHATSAPP" if canal == "whatsapp" else ""
        print(f"[SMS TEST{suffixe}] -> {numero} : {message}")
        return True, "mode_test"
