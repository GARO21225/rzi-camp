"""
Utilitaires de notification: Email + SMS
"""
import logging
from django.conf import settings
from django.core.mail import send_mail
from django.template.loader import render_to_string

logger = logging.getLogger(__name__)

APP_URL = getattr(settings, "APP_URL", "https://rzi-camp-frontend.onrender.com")


def envoyer_email_bienvenue(personnel):
    """Envoyer email de bienvenue à un nouveau personnel"""
    if not personnel.email:
        logger.info(f"Pas d'email pour {personnel.nom} {personnel.prenom}")
        return False

    sujet = f"🏕️ Bienvenue à la Résidence Roxgold Sango — {personnel.prenom} {personnel.nom}"
    message = f"""
Bonjour {personnel.prenom} {personnel.nom},

Bienvenue à la Résidence Roxgold Sango !

Vos identifiants de connexion à l'application de gestion :
━━━━━━━━━━━━━━━━━━━━━━━━━
🔗 Lien : {APP_URL}
👤 Identifiant : {personnel.login_genere or "à définir"}
🔑 Mot de passe : {personnel.password_genere or "à définir"}
━━━━━━━━━━━━━━━━━━━━━━━━━

Conseils de sécurité :
• Changez votre mot de passe à la première connexion
• Ne partagez jamais vos identifiants
• En cas de problème, contactez l'administrateur

Bonne installation !
L'équipe Roxgold Sango
"""
    try:
        send_mail(
            subject=sujet,
            message=message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[personnel.email],
            fail_silently=False,
        )
        logger.info(f"Email envoyé à {personnel.email}")
        return True
    except Exception as e:
        logger.error(f"Erreur email ({personnel.email}): {e}")
        return False


def envoyer_sms(numero, message):
    """Envoyer un SMS via Twilio"""
    sid  = getattr(settings, "TWILIO_ACCOUNT_SID", "")
    tok  = getattr(settings, "TWILIO_AUTH_TOKEN", "")
    from_num = getattr(settings, "TWILIO_FROM_NUMBER", "")

    if not sid or not tok:
        logger.info(f"Twilio non configuré — SMS ignoré pour {numero}: {message[:50]}")
        return False

    try:
        from twilio.rest import Client
        client = Client(sid, tok)
        client.messages.create(body=message, from_=from_num, to=numero)
        logger.info(f"SMS envoyé à {numero}")
        return True
    except Exception as e:
        logger.error(f"Erreur SMS ({numero}): {e}")
        return False


def envoyer_sms_bienvenue(personnel):
    """Envoyer SMS de bienvenue à un nouveau personnel"""
    if not personnel.numero:
        return False
    msg = (
        f"Bonjour {personnel.prenom}! Bienvenue a la Residence Roxgold Sango. "
        f"Votre acces: {APP_URL} "
        f"Login: {personnel.login_genere or '?'} "
        f"MDP: {personnel.password_genere or '?'}"
    )
    return envoyer_sms(personnel.numero, msg)


def notifier_admins_sms(message):
    """Envoyer SMS à tous les admins qui ont un numéro"""
    from accounts.models import Profile
    from django.contrib.auth.models import User

    admins = set(User.objects.filter(is_staff=True))
    try:
        for p in Profile.objects.filter(role="admin").select_related("user"):
            admins.add(p.user)
    except Exception:
        pass

    sent = 0
    for admin in admins:
        try:
            from residences.models import Personnel
            pers = Personnel.objects.filter(user=admin).first()
            if pers and pers.numero:
                if envoyer_sms(pers.numero, message):
                    sent += 1
        except Exception:
            pass
    return sent
