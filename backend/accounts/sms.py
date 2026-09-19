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


def envoyer_sms(numero, message):
    """
    Renvoie (ok: bool, info: str). Ne leve jamais d'exception vers
    l'appelant - les erreurs sont dans (False, "raison") pour que
    demander_otp() puisse repondre proprement au frontend.
    """
    provider = Parametre.get('sms_provider', 'test')

    if provider == 'test':
        print(f"[SMS TEST] -> {numero} : {message}")
        return True, "mode_test"

    if provider == 'twilio':
        return _envoyer_twilio(numero, message)

    if provider == 'orange':
        return _envoyer_orange(numero, message)

    if provider == 'africastalking':
        return _envoyer_africastalking(numero, message)

    return False, f"Fournisseur SMS inconnu : {provider}"


def _envoyer_twilio(numero, message):
    sid   = Parametre.get('sms_twilio_account_sid', '')
    token = Parametre.get('sms_twilio_auth_token', '')
    depuis = Parametre.get('sms_twilio_from', '')
    if not (sid and token and depuis):
        return False, "Twilio non configuré (SID/token/numéro expéditeur manquant)"
    try:
        from twilio.rest import Client
        client = Client(sid, token)
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
