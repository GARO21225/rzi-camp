"""
Textes des notifications envoyees au Personnel (identifiants de connexion
+ code OTP) - point UNIQUE pour le ton "courtois et taquin" demande
explicitement ("Bienvenue sur le site de vie de ROXGOLD... de maniere
courtois et taquin"), partage entre :
- l'envoi des identifiants a la creation (accounts/notifications.py)
- l'envoi du code de connexion OTP (accounts/views.py::demander_otp)
pour que le style ne diverge pas entre les deux si l'un des deux change
plus tard. Renvoie systematiquement (texte_brut, corps_html) - le texte
brut sert au SMS/WhatsApp, le HTML a l'email (Resend).
"""
from django.conf import settings


def _lien_connexion():
    # settings.APP_URL est TOUJOURS défini (voir rzi_camp/settings.py) - ce
    # 2e argument n'est qu'un filet de sécurité si jamais ce n'était plus le
    # cas ; sa valeur suit celle de settings.py. Le lien est repris ICI
    # TEL QUEL (aucune concaténation de chemin) - si APP_URL se termine par
    # "/", le lien envoyé se termine aussi par "/".
    return getattr(settings, "APP_URL", "https://app.roxgold-sitelife.com:5173")


def message_bienvenue_identifiants(nom_app, prenom, username, password):
    lien = _lien_connexion()
    texte = (
        f"Bienvenue sur le site de vie {nom_app} 👋 {prenom}, on est ravis de vous compter "
        "parmi nous !\n\n"
        "Voici vos paramètres d'authentification (à garder bien au chaud, on ne les "
        "répète pas deux fois 😉) :\n"
        f"Identifiant : {username}\n"
        f"Mot de passe : {password}\n\n"
        f"Connexion ici : {lien}\n\n"
        "Conservez ce message, il ne sera plus jamais affiché."
    )
    corps_html = (
        f"<p>Bienvenue sur le site de vie <strong>{nom_app}</strong> 👋 {prenom}, on est ravis "
        "de vous compter parmi nous !</p>"
        "<p>Voici vos paramètres d'authentification (à garder bien au chaud, on ne les "
        "répète pas deux fois 😉) :</p>"
        f"<p>Identifiant : <strong>{username}</strong><br>"
        f"Mot de passe : <strong>{password}</strong></p>"
        f"<p>Connexion ici : <a href=\"{lien}\">{lien}</a></p>"
        "<p>Conservez ce message, il ne sera plus jamais affiché.</p>"
    )
    return texte, corps_html


def message_code_otp(nom_app, prenom, code, duree_min):
    texte = (
        f"🔐 {nom_app} frappe à votre porte, {prenom} ! Votre code de connexion est {code} "
        f"(valable {duree_min} min) — gardez-le pour vous, même votre plus grand fan n'y a pas droit 😄"
    )
    corps_html = (
        f"<p>🔐 {nom_app} frappe à votre porte, {prenom} !</p>"
        f"<p>Votre code de connexion est "
        f"<strong style=\"font-size:20px;letter-spacing:2px\">{code}</strong> "
        f"(valable {duree_min} minutes).</p>"
        "<p>Gardez-le pour vous, même votre plus grand fan n'y a pas droit 😄</p>"
    )
    return texte, corps_html


def message_code_reinitialisation(nom_app, prenom, code, duree_min):
    texte = (
        f"🔐 {nom_app} — {prenom}, votre code de réinitialisation du mot de passe est {code} "
        f"(valable {duree_min} min). Si vous n'êtes pas à l'origine de cette demande, ignorez ce message."
    )
    corps_html = (
        f"<p>🔐 Bonjour {prenom},</p>"
        f"<p>Votre code de réinitialisation du mot de passe {nom_app} est "
        f"<strong style=\"font-size:20px;letter-spacing:2px\">{code}</strong> "
        f"(valable {duree_min} minutes).</p>"
        "<p>Saisissez-le dans l'écran « Mot de passe oublié » avec votre nouveau mot de passe. "
        "Si vous n'êtes pas à l'origine de cette demande, ignorez ce message.</p>"
    )
    return texte, corps_html
