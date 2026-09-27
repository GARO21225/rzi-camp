"""
Point d'entree UNIQUE pour l'envoi des identifiants de connexion a un
Personnel nouvellement cree - creation INDIVIDUELLE et import CSV en
MASSE utilisent tous les deux cette meme fonction (demande explicite :
"prend en compte creation individuel et par importation").

Respecte le canal configure dans Parametrage (Parametre 'canal_otp' :
sms / whatsapp / email) - remplace l'ancien comportement de
residences/views.py::PersonnelViewSet.create(), qui envoyait TOUJOURS
WhatsApp + email sans condition, et qui appelait
django.core.mail.send_mail() directement (jamais configure dans ce
projet - aucun EMAIL_BACKEND SMTP dans settings.py - donc silencieusement
inoperant) au lieu du systeme email deja en place pour l'OTP
(accounts/email.py, fournisseur Resend).
"""
from .models import Parametre
from .messages_bienvenue import message_bienvenue_identifiants


def envoyer_identifiants(personnel, username, password):
    """
    Renvoie {"canal": "sms"|"whatsapp"|"email", "ok": bool, "info": str,
    "mode_test": bool}.
    Ne leve jamais d'exception - erreurs renvoyees dans "info", jamais
    remontees a l'appelant (creation d'un compte ne doit jamais echouer a
    cause d'un envoi rate).

    "mode_test" (ajoute suite a un signalement : "le mail n'est pas
    arrive" alors que la reponse disait "ok") : le fournisseur 'test'
    (email_provider/sms_provider = 'test' dans Parametrage) renvoie
    TOUJOURS ok=True sans rien envoyer reellement (il journalise
    seulement) - indispensable pour valider le flux sans depenser un vrai
    SMS/email, mais s'il reste actif par erreur en production, un "ok"
    peut faire croire qu'un message a ete livre alors qu'il ne l'a jamais
    ete. "mode_test": True permet a l'appelant (Personnel.jsx) d'afficher
    un avertissement distinct au lieu d'un succes silencieux trompeur.
    """
    nom_app = Parametre.get('nom_application', 'Roxgold SiteLife')
    canal = Parametre.get('canal_otp', 'sms')
    texte, corps_html = message_bienvenue_identifiants(nom_app, personnel.prenom, username, password)

    try:
        if canal == 'email':
            if not personnel.email:
                return {"canal": "email", "ok": False, "info": "Aucune adresse email associée à ce compte.", "mode_test": False}
            from .email import envoyer_email
            ok, info = envoyer_email(
                personnel.email, sujet=f"🔑 Bienvenue — vos identifiants {nom_app}",
                corps_html=corps_html, corps_texte=texte, type_message="identifiants",
            )
            return {"canal": "email", "ok": ok, "info": info, "mode_test": info == "mode_test"}

        numero = (personnel.numero_whatsapp if canal == 'whatsapp' else personnel.telephone) or personnel.telephone
        if not numero:
            return {"canal": canal, "ok": False, "info": "Aucun numéro de téléphone associé à ce compte.", "mode_test": False}
        from .sms import envoyer_sms
        ok, info = envoyer_sms(numero, texte, canal=canal, type_message="identifiants")
        return {"canal": canal, "ok": ok, "info": info, "mode_test": info == "mode_test"}
    except Exception as e:
        return {"canal": canal, "ok": False, "info": f"Erreur inattendue lors de l'envoi des identifiants : {e}", "mode_test": False}
