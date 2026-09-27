"""
Fournisseur 'test' - n'envoie rien reellement, journalise et renvoie le
sujet/corps tel quel (meme convention que accounts/sms_providers/test_provider.py) -
permet de valider tout le flux OTP par email avant de configurer un vrai
fournisseur (Resend).
"""
from .base import EmailProvider


class TestEmailProvider(EmailProvider):
    code = "test"

    def envoyer(self, destinataire, sujet, corps_html, corps_texte=""):
        print(f"[EMAIL TEST] -> {destinataire} : {sujet} | {corps_texte or corps_html}")
        return True, "mode_test"
