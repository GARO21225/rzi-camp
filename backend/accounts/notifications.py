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


def envoyer_identifiants(personnel, username, password):
    """
    Renvoie {"canal": "sms"|"whatsapp"|"email", "ok": bool, "info": str}.
    Ne leve jamais d'exception - erreurs renvoyees dans "info", jamais
    remontees a l'appelant (creation d'un compte ne doit jamais echouer a
    cause d'un envoi rate).
    """
    nom_app = Parametre.get('nom_application', 'Roxgold SiteLife')
    canal = Parametre.get('canal_otp', 'sms')
    texte = (
        f"{nom_app} — Vos identifiants de connexion :\n"
        f"Identifiant : {username}\nMot de passe : {password}\n\n"
        "Conservez ce message, il ne sera plus jamais affiché."
    )

    try:
        if canal == 'email':
            if not personnel.email:
                return {"canal": "email", "ok": False, "info": "Aucune adresse email associée à ce compte."}
            from .email import envoyer_email
            corps_html = (
                f"<p>{nom_app} — Vos identifiants de connexion :</p>"
                f"<p>Identifiant : <strong>{username}</strong><br>"
                f"Mot de passe : <strong>{password}</strong></p>"
                "<p>Conservez ce message, il ne sera plus jamais affiché.</p>"
            )
            ok, info = envoyer_email(
                personnel.email, sujet=f"🔑 Vos identifiants — {nom_app}",
                corps_html=corps_html, corps_texte=texte, type_message="identifiants",
            )
            return {"canal": "email", "ok": ok, "info": info}

        numero = (personnel.numero_whatsapp if canal == 'whatsapp' else personnel.telephone) or personnel.telephone
        if not numero:
            return {"canal": canal, "ok": False, "info": "Aucun numéro de téléphone associé à ce compte."}
        from .sms import envoyer_sms
        ok, info = envoyer_sms(numero, texte, canal=canal, type_message="identifiants")
        return {"canal": canal, "ok": ok, "info": info}
    except Exception as e:
        return {"canal": canal, "ok": False, "info": f"Erreur inattendue lors de l'envoi des identifiants : {e}"}
