"""
Point d'entree UNIQUE pour l'envoi d'email - dispatche vers le fournisseur
configure depuis Parametrage -> Connexion (canal_otp=email), via
EmailProviderFactory (accounts/email_providers/). Meme principe que
accounts/sms.py::envoyer_sms(), pour le canal email.

Mode 'test' (par defaut, aucun fournisseur requis) : n'envoie rien
reellement, journalise le message (uniquement visible en DEBUG) pour
permettre de valider tout le flux OTP par email avant de configurer un
vrai fournisseur (Resend).

Chaque envoi est trace dans SMSMessage (accounts/models.py, canal='email') -
jamais le contenu d'un OTP, uniquement son type.
"""
from .models import Parametre
from .email_providers import EmailProviderFactory


def envoyer_email(destinataire, sujet, corps_html, corps_texte="", type_message="systeme", campagne=""):
    """
    Renvoie (ok: bool, info: str). Ne leve jamais d'exception vers
    l'appelant - memes garanties que envoyer_sms().
    """
    provider_code = Parametre.get('email_provider', 'test')
    provider = EmailProviderFactory.get(provider_code)
    if not provider:
        return _tracer_et_renvoyer(
            destinataire, type_message, campagne, provider_code,
            False, f"Fournisseur email inconnu : {provider_code}",
        )

    # Meme filet de securite structurel que envoyer_sms() : une exception
    # inattendue du fournisseur ne doit jamais remonter en 500 brut.
    try:
        ok, info = provider.envoyer(destinataire, sujet, corps_html, corps_texte)
    except Exception as e:
        ok, info = False, f"Erreur inattendue du fournisseur email ({provider_code}) : {e}"
    return _tracer_et_renvoyer(destinataire, type_message, campagne, provider_code, ok, info)


def _tracer_et_renvoyer(destinataire, type_message, campagne, fournisseur, ok, info):
    """Enregistre l'envoi dans l'historique (SMSMessage, canal='email') - jamais bloquant si ca echoue."""
    try:
        from django.utils import timezone
        from .models import SMSMessage
        SMSMessage.objects.create(
            destinataire=destinataire, canal="email", type_message=type_message,
            fournisseur=fournisseur, campagne=campagne,
            statut="sent" if ok else "failed",
            erreur="" if ok else str(info)[:500],
            date_envoi=timezone.now() if ok else None,
        )
    except Exception:
        pass
    return ok, info
