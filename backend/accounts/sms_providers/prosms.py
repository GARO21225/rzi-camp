"""
Fournisseur proSMS - PLACEHOLDER, PAS ENCORE IMPLEMENTE.

Le prompt d'integration interdit explicitement d'inventer des endpoints,
parametres, headers ou methodes d'authentification. Recherche effectuee
(web) : le candidat le plus proche du nom "proSMS" pour la Cote d'Ivoire
est "Mon SMS PRO" (docs.monsms.pro), qui expose une API REST documentee
(cle API + Company ID, endpoints OTP/campagnes/expediteurs), mais ce
rapprochement de nom n'a PAS ete confirme explicitement - implementer
maintenant reviendrait a deviner, ce que le prompt interdit precisement.

Ce module reste un adapter vide et clairement identifiable, qui echoue
proprement (pas d'exception, pas d'appel reseau invente) tant que la
confirmation et les vrais parametres n'ont pas ete fournis. L'activer
ensuite consiste a remplir la methode envoyer() avec les VRAIS
endpoint/headers/auth de la documentation confirmee - rien d'autre a
changer dans le reste de l'application (factory, code appelant).
"""
from .base import SMSProvider


class ProSMSProvider(SMSProvider):
    code = "prosms"

    def envoyer(self, numero, message, canal="sms"):
        return False, (
            "Fournisseur proSMS pas encore implémenté — en attente de confirmation du "
            "fournisseur exact (candidat identifié : « Mon SMS PRO », docs.monsms.pro) "
            "et de ses paramètres réels avant toute intégration."
        )
