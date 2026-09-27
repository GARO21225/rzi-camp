"""
Validation du contact d'un Personnel (telephone / whatsapp / email) selon
le canal de connexion configure (Parametre 'canal_otp') - utilisee a la
fois par la creation individuelle (residences/serializers.py::
PersonnelSerializer.validate()) et par l'import CSV en masse
(residences/views.py::PersonnelViewSet.import_csv_data()), pour ne pas
dupliquer la meme regle deux fois.

Regle (demande explicite : "je pense qu'on doit rendre des champ
obligatoire et contraindre certains format") : le champ de contact
correspondant au canal choisi est OBLIGATOIRE et doit avoir un format
valide - sinon le code de connexion (OTP) et les identifiants generes ne
pourront jamais etre delivres a cette personne, silencieusement, jusqu'a
ce qu'elle se plaigne de ne rien recevoir.
"""
from django.core.validators import validate_email
from django.core.exceptions import ValidationError as DjangoValidationError

from .phone import normaliser, est_valide as telephone_valide


def valider_contact_selon_canal(canal, telephone='', numero_whatsapp='', email=''):
    """
    Renvoie une liste d'erreurs (chaines) - vide si tout est valide pour
    le canal donne. Ne leve jamais d'exception - a l'appelant de decider
    quoi faire des erreurs (bloquer la creation individuelle, ou
    ignorer/journaliser la ligne lors d'un import CSV en masse).
    """
    erreurs = []
    if canal == 'email':
        email = (email or '').strip()
        if not email:
            erreurs.append("L'email est obligatoire — le canal de connexion configuré (Paramétrage) est « email ».")
        else:
            try:
                validate_email(email)
            except DjangoValidationError:
                erreurs.append(f"Email invalide : « {email} ».")
    elif canal == 'whatsapp':
        numero = (numero_whatsapp or telephone or '').strip()
        if not numero:
            erreurs.append("Le numéro WhatsApp (ou téléphone) est obligatoire — le canal de connexion configuré (Paramétrage) est « whatsapp ».")
        elif not telephone_valide(numero):
            erreurs.append(f"Numéro WhatsApp/téléphone invalide : « {numero} » (format attendu : 0XXXXXXXXX, 10 chiffres, Côte d'Ivoire).")
    else:  # 'sms' (canal par defaut)
        numero = (telephone or '').strip()
        if not numero:
            erreurs.append("Le téléphone est obligatoire — le canal de connexion configuré (Paramétrage) est « sms ».")
        elif not telephone_valide(numero):
            erreurs.append(f"Téléphone invalide : « {numero} » (format attendu : 0XXXXXXXXX, 10 chiffres, Côte d'Ivoire).")
    return erreurs
