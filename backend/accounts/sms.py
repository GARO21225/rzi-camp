"""
Envoi de SMS - dispatche vers le fournisseur configure depuis
Parametrage -> Connexion SMS (OTP). Pensé pour supporter plusieurs
fournisseurs sans changer le code appelant : demander_otp() n'a besoin
de connaitre que envoyer_sms(numero, message).

Mode 'test' (par defaut, aucun fournisseur requis) : n'envoie rien
reellement, journalise le message et le renvoie tel quel dans la reponse
API (uniquement en DEBUG) pour permettre de valider tout le flux OTP
avant de payer/configurer un vrai fournisseur.
"""
from .models import Parametre


class SMSNonConfigureError(Exception):
    pass


def envoyer_sms(numero, message, canal=None):
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
    WhatsApp du fournisseur SMS principal (aujourd'hui : Twilio).
    """
    provider = Parametre.get('sms_provider', 'test')
    canal = canal or Parametre.get('canal_otp', 'sms')

    if provider == 'test' and canal != 'whatsapp':
        print(f"[SMS TEST] -> {numero} : {message}")
        return True, "mode_test"

    if canal == 'whatsapp':
        whatsapp_provider = Parametre.get('whatsapp_provider', 'auto')
        if whatsapp_provider == 'meta':
            return _envoyer_meta_whatsapp(numero, message)
        if whatsapp_provider in ('', 'auto', 'twilio'):
            if provider == 'test':
                print(f"[SMS TEST/WHATSAPP] -> {numero} : {message}")
                return True, "mode_test"
            if provider == 'twilio':
                return _envoyer_twilio(numero, message, canal='whatsapp')
            return False, f"WhatsApp via Twilio nécessite sms_provider=twilio (actuel : {provider}) — ou configurez whatsapp_provider=meta pour l'API Meta officielle."
        return False, f"whatsapp_provider inconnu : {whatsapp_provider}"

    if provider == 'twilio':
        return _envoyer_twilio(numero, message, canal=canal)

    if provider == 'orange':
        return _envoyer_orange(numero, message)

    if provider == 'africastalking':
        return _envoyer_africastalking(numero, message)

    return False, f"Fournisseur SMS inconnu : {provider}"


def _envoyer_twilio(numero, message, canal='sms'):
    sid   = Parametre.get('sms_twilio_account_sid', '')
    token = Parametre.get('sms_twilio_auth_token', '')
    depuis = Parametre.get('sms_twilio_from', '')
    if not (sid and token and depuis):
        return False, "Twilio non configuré (SID/token/numéro expéditeur manquant)"
    try:
        from twilio.rest import Client
        client = Client(sid, token)
        if canal == 'whatsapp':
            # Le numero expediteur Twilio doit etre approuve WhatsApp
            # Business (sandbox pour les tests, numero dedie en production) -
            # prefixe "whatsapp:" requis des deux cotes par l'API Twilio.
            client.messages.create(body=message, from_=f"whatsapp:{depuis}", to=f"whatsapp:{numero}")
            return True, "envoyé via Twilio WhatsApp"
        client.messages.create(body=message, from_=depuis, to=numero)
        return True, "envoyé via Twilio"
    except ImportError:
        return False, "Le paquet 'twilio' n'est pas installé (pip install twilio)"
    except Exception as e:
        return False, f"Erreur Twilio : {e}"


def _envoyer_orange(numero, message):
    client_id     = Parametre.get('sms_orange_client_id', '')
    client_secret = Parametre.get('sms_orange_client_secret', '')
    depuis        = Parametre.get('sms_orange_from', '')
    if not (client_id and client_secret and depuis):
        return False, "Orange SMS API non configuré (client_id/secret/numéro manquant)"
    try:
        import requests
        # Etape 1 : jeton OAuth2 (identifiants combines en Basic Auth)
        token_resp = requests.post(
            "https://api.orange.com/oauth/v3/token",
            auth=(client_id, client_secret),
            data={"grant_type": "client_credentials"},
            timeout=10,
        )
        token_resp.raise_for_status()
        access_token = token_resp.json()["access_token"]
        # Etape 2 : envoi du SMS
        sms_resp = requests.post(
            f"https://api.orange.com/smsmessaging/v1/outbound/{depuis}/requests",
            headers={"Authorization": f"Bearer {access_token}", "Content-Type": "application/json"},
            json={"outboundSMSMessageRequest": {
                "address": [f"tel:{numero}"],
                "senderAddress": f"tel:{depuis}",
                "outboundSMSTextMessage": {"message": message},
            }},
            timeout=10,
        )
        sms_resp.raise_for_status()
        return True, "envoyé via Orange SMS API"
    except Exception as e:
        return False, f"Erreur Orange SMS API : {e}"


def _envoyer_africastalking(numero, message):
    username = Parametre.get('sms_at_username', '')
    api_key  = Parametre.get('sms_at_api_key', '')
    if not (username and api_key):
        return False, "Africa's Talking non configuré (username/api_key manquant)"
    try:
        import africastalking
        africastalking.initialize(username, api_key)
        sms = africastalking.SMS
        sms.send(message, [numero])
        return True, "envoyé via Africa's Talking"
    except ImportError:
        return False, "Le paquet 'africastalking' n'est pas installé (pip install africastalking)"
    except Exception as e:
        return False, f"Erreur Africa's Talking : {e}"


def _envoyer_meta_whatsapp(numero, message):
    """
    API WhatsApp Business officielle de Meta (Cloud API), independante de
    Twilio - necessite un compte WhatsApp Business verifie et une APP
    Meta for Developers.

    IMPORTANT (contrainte imposee par Meta, pas par ce code) : un message
    envoye en dehors d'une conversation deja ouverte par le destinataire
    (ce qui est TOUJOURS le cas pour un code OTP ou des identifiants -
    premier contact) doit obligatoirement utiliser un MODELE DE MESSAGE
    ("message template") pre-approuve par Meta, pas du texte libre. Le
    modele attendu ici a UNE seule variable {{1}} dans le corps, qui
    recoit le message entier - creer un modele simple du type
    "{{1}}" (categorie UTILITY) dans Meta Business Manager, attendre son
    approbation (generalement quelques minutes a quelques heures), puis
    renseigner son nom exact dans Parametrage.
    """
    phone_number_id = Parametre.get('meta_whatsapp_phone_number_id', '')
    access_token     = Parametre.get('meta_whatsapp_access_token', '')
    template_name    = Parametre.get('meta_whatsapp_template_name', '')
    template_lang    = Parametre.get('meta_whatsapp_template_lang', 'fr') or 'fr'
    if not (phone_number_id and access_token and template_name):
        return False, "API Meta WhatsApp non configurée (Phone Number ID / Access Token / nom du modèle manquant)"
    try:
        import requests
        numero_e164 = numero.replace(" ", "").replace("-", "")
        if not numero_e164.startswith("+"):
            # Hypothese raisonnable pour la Cote d'Ivoire si aucun indicatif
            # n'est fourni - a ajuster si le camp accueille d'autres pays.
            numero_e164 = "+225" + numero_e164.lstrip("0") if len(numero_e164) <= 10 else "+" + numero_e164
        resp = requests.post(
            f"https://graph.facebook.com/v21.0/{phone_number_id}/messages",
            headers={"Authorization": f"Bearer {access_token}", "Content-Type": "application/json"},
            json={
                "messaging_product": "whatsapp",
                "to": numero_e164.lstrip("+"),
                "type": "template",
                "template": {
                    "name": template_name,
                    "language": {"code": template_lang},
                    "components": [{"type": "body", "parameters": [{"type": "text", "text": message}]}],
                },
            },
            timeout=10,
        )
        if resp.status_code >= 400:
            return False, f"Erreur API Meta WhatsApp ({resp.status_code}) : {resp.text[:200]}"
        return True, "envoyé via l'API Meta WhatsApp"
    except Exception as e:
        return False, f"Erreur API Meta WhatsApp : {e}"
