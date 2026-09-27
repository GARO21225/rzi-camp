"""
Abstraction fournisseur EMAIL - meme esprit que accounts/sms_providers/base.py
(SMSProvider) : le code metier (accounts/email.py::envoyer_email(), et ses
appelants : OTP par email, notifications) ne connait QUE cette interface,
jamais un fournisseur precis - permet de changer de fournisseur sans
toucher au code appelant.

Chaque methode renvoie (ok: bool, info: str) - jamais d'exception vers
l'appelant (meme convention que SMSProvider).
"""
from abc import ABC, abstractmethod


class EmailProvider(ABC):
    #: identifiant court utilise dans Parametre (ex: 'resend', 'test')
    code = None

    @abstractmethod
    def envoyer(self, destinataire: str, sujet: str, corps_html: str, corps_texte: str = "") -> tuple[bool, str]:
        """
        Envoie un email a UN destinataire. `corps_texte` est une variante
        texte brut optionnelle (repli pour les clients mail qui n'affichent
        pas le HTML) - un fournisseur peut l'ignorer si l'API ne le supporte
        pas.
        """
        raise NotImplementedError
