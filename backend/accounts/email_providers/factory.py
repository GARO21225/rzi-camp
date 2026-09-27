"""
EmailProviderFactory - point UNIQUE de selection du fournisseur email actif.
Meme principe que sms_providers/factory.py (ProviderFactory) : le code
appelant (accounts/email.py::envoyer_email) ne fait jamais
`if provider == "resend"` lui-meme.
"""
from .test_provider import TestEmailProvider
from .resend import ResendProvider

PROVIDERS = {
    "test": TestEmailProvider,
    "resend": ResendProvider,
}


class EmailProviderFactory:
    @staticmethod
    def get(code: str):
        cls = PROVIDERS.get(code)
        return cls() if cls else None

    @staticmethod
    def codes_disponibles():
        return list(PROVIDERS.keys())
