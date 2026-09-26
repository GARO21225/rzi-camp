"""
ProviderFactory - point UNIQUE de selection du fournisseur SMS actif.
Le code appelant (accounts/sms.py::envoyer_sms) ne fait jamais
`if provider == "twilio"` lui-meme - il demande une instance a cette
fabrique et n'utilise que l'interface SMSProvider commune. Ajouter un
fournisseur = l'ajouter au dict PROVIDERS, rien d'autre a changer dans le
code appelant.

Prepare aussi le routage par pays (prompt : "prevoir une architecture
permettant plus tard CI, SN, GH... mais NE PAS les activer") - un seul
pays actif pour l'instant, PAYS_PROVIDERS_PAR_DEFAUT n'a qu'une entree
'CI', ajouter un pays reel se fera en ajoutant une entree ici sans
toucher au reste.
"""
from .test_provider import TestProvider
from .orange import OrangeProvider
from .africastalking import AfricasTalkingProvider
from .meta_whatsapp import MetaWhatsAppProvider
from .prosms import ProSMSProvider
from .hsms import HSMSProvider

PROVIDERS = {
    "test": TestProvider,
    "orange": OrangeProvider,
    "africastalking": AfricasTalkingProvider,
    "meta": MetaWhatsAppProvider,
    "prosms": ProSMSProvider,
    "hsms": HSMSProvider,
}

# Fournisseur par defaut PAR PAYS - un seul pays actif (CI) pour
# l'instant, conformement a la regle du prompt de ne pas activer
# d'autres pays avant un vrai besoin confirme.
PAYS_PROVIDERS_PAR_DEFAUT = {
    "CI": "test",
}


class ProviderFactory:
    @staticmethod
    def get(code: str):
        """Renvoie une instance du fournisseur demande, ou None si inconnu."""
        cls = PROVIDERS.get(code)
        return cls() if cls else None

    @staticmethod
    def codes_disponibles():
        return list(PROVIDERS.keys())
