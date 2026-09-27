"""
Validation du contact d'un Personnel (telephone / whatsapp / email) selon
le canal de connexion configure (Parametre 'canal_otp') - utilisee a la
fois par la creation individuelle (residences/serializers.py::
PersonnelSerializer.validate()) et par l'import CSV en masse
(residences/views.py::PersonnelViewSet.import_csv_data()), pour ne pas
dupliquer la meme regle deux fois.

Regle (demande explicite initiale : "je pense qu'on doit rendre des champ
obligatoire et contraindre certains format" ; durcie ensuite : "rend
obligatoire les numéros et le numéro whatsapp") : TELEPHONE et NUMERO
WHATSAPP sont desormais TOUJOURS obligatoires, quel que soit le canal
configure (avant ce durcissement, seul le champ correspondant au canal
choisi etait requis - ex: en canal 'sms', le whatsapp restait
optionnel). L'EMAIL, lui, reste obligatoire seulement si canal_otp='email'
(pas de raison de l'exiger sinon). Tous les champs fournis sont en plus
verifies au FORMAT - sinon le code de connexion (OTP) et les identifiants
generes ne pourront jamais etre delivres a cette personne, silencieusement,
jusqu'a ce qu'elle se plaigne de ne rien recevoir.
"""
from django.core.validators import validate_email
from django.core.exceptions import ValidationError as DjangoValidationError

from .phone import normaliser, est_valide as telephone_valide


def valider_contact_selon_canal(canal, telephone='', numero_whatsapp='', email=''):
    """
    Renvoie une liste d'erreurs (chaines) - vide si tout est valide. Ne
    leve jamais d'exception - a l'appelant de decider quoi faire des
    erreurs (bloquer la creation individuelle, ou ignorer/journaliser la
    ligne lors d'un import CSV en masse).
    """
    erreurs = []

    telephone = (telephone or '').strip()
    if not telephone:
        erreurs.append("Le téléphone est obligatoire.")
    elif not telephone_valide(telephone):
        erreurs.append(f"Téléphone invalide : « {telephone} » (format attendu : 0XXXXXXXXX, 10 chiffres, Côte d'Ivoire).")

    numero_whatsapp = (numero_whatsapp or '').strip()
    if not numero_whatsapp:
        erreurs.append("Le numéro WhatsApp est obligatoire.")
    elif not telephone_valide(numero_whatsapp):
        erreurs.append(f"Numéro WhatsApp invalide : « {numero_whatsapp} » (format attendu : 0XXXXXXXXX, 10 chiffres, Côte d'Ivoire).")

    if canal == 'email':
        email = (email or '').strip()
        if not email:
            erreurs.append("L'email est obligatoire — le canal de connexion configuré (Paramétrage) est « email ».")
        else:
            try:
                validate_email(email)
            except DjangoValidationError:
                erreurs.append(f"Email invalide : « {email} ».")

    return erreurs
