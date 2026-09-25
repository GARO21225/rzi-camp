"""
Abstraction fournisseur SMS - interface commune que chaque fournisseur
(Twilio, Orange, Africa's Talking, Meta WhatsApp, proSMS, HSMS, test...)
doit implementer. Le code metier (envoyer_sms() dans accounts/sms.py, et
tous ses appelants : OTP, envoi d'identifiants) ne connait QUE cette
interface, jamais un fournisseur precis - permet de changer, ajouter ou
faire du failover entre fournisseurs sans toucher au code appelant.

Chaque methode renvoie (ok: bool, info: str) - jamais d'exception vers
l'appelant, les erreurs sont dans le message pour que les vues puissent
repondre proprement au frontend (meme convention que l'ancien
accounts/sms.py, conservee pour ne rien casser).
"""
from abc import ABC, abstractmethod


class SMSProvider(ABC):
    #: identifiant court utilise dans Parametre (ex: 'twilio', 'prosms')
    code = None

    @abstractmethod
    def envoyer(self, numero: str, message: str, canal: str = "sms") -> tuple[bool, str]:
        """
        Envoie un message a UN destinataire. `canal` vaut 'sms' ou
        'whatsapp' - un fournisseur qui ne gere pas un canal doit
        renvoyer (False, "raison claire"), jamais lever d'exception.
        """
        raise NotImplementedError

    def envoyer_bulk(self, numeros: list, message: str, canal: str = "sms") -> dict:
        """
        Envoi a plusieurs destinataires. Implementation par defaut :
        boucle sur envoyer() - suffisant tant qu'aucun fournisseur actif
        n'expose un vrai endpoint d'envoi groupe. Un fournisseur qui en a
        un peut surcharger cette methode pour l'utiliser (plus rapide,
        moins d'appels reseau).
        Renvoie {"reussis": [...], "echecs": [(numero, raison), ...]}.
        """
        reussis, echecs = [], []
        for numero in numeros:
            ok, info = self.envoyer(numero, message, canal)
            (reussis if ok else echecs).append(numero if ok else (numero, info))
        return {"reussis": reussis, "echecs": echecs}

    def get_status(self, message_id: str) -> tuple[bool, str]:
        """Statut de livraison - pas tous les fournisseurs le supportent."""
        return False, "Suivi de statut non disponible pour ce fournisseur"

    def get_balance(self):
        """Solde/credit restant - pas tous les fournisseurs le supportent."""
        return None
