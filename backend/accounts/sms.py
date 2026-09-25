"""
Point d'entree UNIQUE pour l'envoi de SMS/WhatsApp - dispatche vers le
fournisseur configure depuis Parametrage -> Connexion SMS (OTP), via
ProviderFactory (accounts/sms_providers/). Le reste de l'application
(OTP, envoi d'identifiants, notifications) n'a besoin de connaitre QUE
cette fonction envoyer_sms(numero, message, canal=None) - signature
INCHANGEE depuis avant cette refonte, pour ne rien casser cote appelants
(2 utilisations actives : accounts/views.py::demander_otp,
residences/views.py::PersonnelViewSet.create).

Mode 'test' (par defaut, aucun fournisseur requis) : n'envoie rien
reellement, journalise le message (uniquement visible en DEBUG) pour
permettre de valider tout le flux OTP avant de payer/configurer un vrai
fournisseur.

Chaque envoi est trace dans SMSMessage (accounts/models.py) - jamais le
contenu d'un OTP, uniquement son type.
"""
from .models import Parametre
from .sms_providers import ProviderFactory
from .phone import normaliser


class SMSNonConfigureError(Exception):
    pass


def envoyer_sms(numero, message, canal=None, type_message="systeme", campagne=""):
    """
    Renvoie (ok: bool, info: str). Ne leve jamais d'exception vers
    l'appelant - les erreurs sont dans (False, "raison") pour que
    demander_otp() puisse repondre proprement au frontend.

    canal: 'sms' (par defaut) ou 'whatsapp'. Si omis, lit le parametre
    'canal_otp' (permet de choisir le canal par defaut pour tout le camp
    sans toucher au code appelant).

    Pour WhatsApp specifiquement, un fournisseur DEDIE et independant du
    SMS peut etre configure ('whatsapp_provider') - Meta est une API
    WhatsApp uniquement (pas de SMS), donc ca ne remplace jamais
    sms_provider, ca s'ajoute a cote pour ce canal precis. Si
    whatsapp_provider est vide/'auto', on retombe sur la capacite
    WhatsApp du fournisseur SMS principal.

    type_message/campagne : optionnels, uniquement pour l'historique
    (SMSMessage) - n'affectent jamais le comportement d'envoi lui-meme.
    """
    numero_normalise = normaliser(numero) or numero
    provider_code = Parametre.get('sms_provider', 'test')
    canal = canal or Parametre.get('canal_otp', 'sms')

    if canal == 'whatsapp':
        whatsapp_provider = Parametre.get('whatsapp_provider', 'auto')
        if whatsapp_provider == 'meta':
            fournisseur_utilise = 'meta'
        elif whatsapp_provider in ('', 'auto', 'twilio'):
            fournisseur_utilise = provider_code if provider_code == 'test' else 'twilio'
            if provider_code not in ('test', 'twilio'):
                return _tracer_et_renvoyer(
                    numero_normalise, message, canal, type_message, campagne, provider_code,
                    False, f"WhatsApp via Twilio nécessite sms_provider=twilio (actuel : {provider_code}) — ou configurez whatsapp_provider=meta pour l'API Meta officielle.",
                )
        else:
            return _tracer_et_renvoyer(
                numero_normalise, message, canal, type_message, campagne, whatsapp_provider,
                False, f"whatsapp_provider inconnu : {whatsapp_provider}",
            )
    else:
        fournisseur_utilise = provider_code

    provider = ProviderFactory.get(fournisseur_utilise)
    if not provider:
        return _tracer_et_renvoyer(
            numero_normalise, message, canal, type_message, campagne, fournisseur_utilise,
            False, f"Fournisseur SMS inconnu : {fournisseur_utilise}",
        )

    ok, info = provider.envoyer(numero_normalise, message, canal=canal)
    return _tracer_et_renvoyer(numero_normalise, message, canal, type_message, campagne, fournisseur_utilise, ok, info)


def _tracer_et_renvoyer(numero, message, canal, type_message, campagne, fournisseur, ok, info):
    """Enregistre l'envoi dans l'historique (SMSMessage) - jamais bloquant si ca echoue."""
    try:
        from django.utils import timezone
        from .models import SMSMessage
        SMSMessage.objects.create(
            destinataire=numero, canal=canal, type_message=type_message,
            fournisseur=fournisseur, campagne=campagne,
            statut="sent" if ok else "failed",
            erreur="" if ok else str(info)[:500],
            date_envoi=timezone.now() if ok else None,
        )
    except Exception:
        pass
    return ok, info
