"""
Fournisseur HSMS - PLACEHOLDER, PAS ENCORE IMPLEMENTE.

HSMS (hsms.ci) est bien un fournisseur SMS/OTP reel actif en Cote
d'Ivoire (recherche web confirmee), mais sa documentation technique
(endpoints, authentification, format des requetes) n'est pas publiee en
acces libre - elle necessite un compte/tableau de bord HSMS pour y
acceder. Le prompt d'integration interdit d'inventer ces details.

Ce module reste un adapter vide et clairement identifiable, qui echoue
proprement tant que la documentation reelle n'a pas ete fournie/consultee.
Activer ce fournisseur = remplir envoyer() avec les vrais parametres,
rien d'autre a changer ailleurs (factory, code appelant).
"""
from .base import SMSProvider


class HSMSProvider(SMSProvider):
    code = "hsms"

    def envoyer(self, numero, message, canal="sms"):
        return False, (
            "Fournisseur HSMS pas encore implémenté — sa documentation technique "
            "nécessite un accès compte (hsms.ci) non consulté à ce stade."
        )
