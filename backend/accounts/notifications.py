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
from .messages_bienvenue import message_bienvenue_identifiants, message_nouveaux_identifiants


def envoyer_identifiants(personnel, username, password, regeneration=False):
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
    if regeneration:
        texte, corps_html = message_nouveaux_identifiants(nom_app, personnel.prenom, username, password)
        sujet = f"🔑 Vos nouveaux identifiants {nom_app}"
    else:
        texte, corps_html = message_bienvenue_identifiants(nom_app, personnel.prenom, username, password)
        sujet = f"🔑 Bienvenue — vos identifiants {nom_app}"

    try:
        if canal == 'email':
            if not personnel.email:
                return {"canal": "email", "ok": False, "info": "Aucune adresse email associée à ce compte.", "mode_test": False}
            from .email import envoyer_email
            ok, info = envoyer_email(
                personnel.email, sujet=sujet,
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


# ─── WhatsApp en complément des notifications de l'application ──────────────
# Demande : recevoir les notifications des plaintes sur WhatsApp (admins,
# occupant, et personne à qui la plainte est affectée). Passe par le même
# envoyer_sms(canal='whatsapp') que l'OTP — un seul modèle Meta à variable
# {{1}} suffit, le texte entier y est injecté.

def _whatsapp_actif(cle_module):
    """Actif seulement si l'API Meta est réellement configurée (sinon chaque
    notification créerait une ligne « échec » dans l'historique SMS) et si
    l'interrupteur du module n'est pas coupé dans Paramétrage."""
    if (Parametre.get('whatsapp_provider', 'auto') or '').strip().lower() != 'meta':
        return False
    return (Parametre.get(cle_module, 'oui') or '').strip().lower() not in ('non', '0', 'false', 'off')


def _texte_whatsapp(titre, message):
    # Meta refuse dans une variable de modèle : retours à la ligne, tabulations,
    # plus de 4 espaces consécutifs. Une seule ligne, tronquée.
    texte = f"{titre} — {message}" if message else str(titre)
    texte = ' '.join(texte.split())
    return texte[:900]


def _en_arriere_plan(fn, *args):
    """L'appel Meta peut prendre jusqu'à 10 s par numéro : jamais dans la requête HTTP."""
    import threading

    def _run():
        from django.db import close_old_connections
        try:
            fn(*args)
        finally:
            close_old_connections()
    threading.Thread(target=_run, daemon=True).start()


def _envoyer_lot(numeros, texte, campagne):
    from .sms import envoyer_sms
    for n in numeros:
        try:
            envoyer_sms(n, texte, canal='whatsapp', type_message='notification', campagne=campagne)
        except Exception:
            pass


def notifier_whatsapp(users, titre, message, cle_module='whatsapp_notif_plaintes', campagne='plaintes'):
    """Envoie la notification sur WhatsApp aux comptes donnés (via le numéro
    WhatsApp de leur fiche Personnel, sinon leur téléphone). Ne lève jamais.
    Renvoie le nombre de numéros visés."""
    try:
        if not _whatsapp_actif(cle_module):
            return 0
        from residences.models import Personnel
        ids = {u.id for u in users if u is not None}
        if not ids:
            return 0
        numeros = []
        for wa, tel in Personnel.objects.filter(user_id__in=ids).values_list('numero_whatsapp', 'telephone'):
            n = (wa or tel or '').strip()
            if n and n not in numeros:
                numeros.append(n)
        if numeros:
            _en_arriere_plan(_envoyer_lot, numeros, _texte_whatsapp(titre, message), campagne)
        return len(numeros)
    except Exception:
        return 0
