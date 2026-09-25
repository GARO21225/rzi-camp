"""
PhoneNumberService - normalisation centralisee des numeros de telephone.

Extrait et reutilise TEL QUEL la logique de normalisation qui existait deja
(dupliquee localement dans residences/views.py::normalize_phone, utilisee
pour l'import CSV du personnel) - ce module la rend reutilisable partout
dans l'application au lieu de la laisser eparpillee/dupliquee.

Un seul pays actif pour l'instant : Cote d'Ivoire (CI, indicatif +225).
Architecture prete pour en ajouter d'autres plus tard (SN, GH, BF, ML...)
sans reecrire le code appelant - il suffira d'ajouter une entree dans
_REGLES_PAR_PAYS, jamais activee tant qu'elle n'y est pas.
"""
import re


def _normaliser_ci(v: str) -> str:
    """
    Reproduit exactement la logique deja existante et validee en
    production (residences/views.py, import CSV du personnel) :
    +225XXXXXXXXXX / 225XXXXXXXXXX / 0XXXXXXXXX -> 0XXXXXXXXX (format
    local, celui deja stocke dans Personnel.telephone dans toute la base
    existante - ne change PAS ce format pour ne rien casser).
    """
    if v.startswith('+225'):
        v = v[4:]
    elif v.startswith('225'):
        v = v[3:]
    # Les fichiers Excel peuvent supprimer le 0 initial, quel que soit le
    # chiffre suivant (numero ivoirien = 9 chiffres sans le 0).
    if re.fullmatch(r'\d{9}', v) and not v.startswith('0'):
        v = '0' + v
    return v


def _vers_international_ci(v_local: str) -> str:
    """0XXXXXXXXX -> +225XXXXXXXXXX, pour les fournisseurs qui exigent le
    format international (proSMS, HSMS, Meta WhatsApp)."""
    if v_local.startswith('0') and len(v_local) == 10:
        return '+225' + v_local[1:]
    return v_local


# Regles par pays - CI est le seul pays ACTIF. Les autres codes ne sont
# pas devines/inventes ici : ajouter une entree quand un vrai besoin se
# presente, avec ses propres regles verifiees.
_REGLES_PAR_PAYS = {
    'CI': {'normaliser_local': _normaliser_ci, 'vers_international': _vers_international_ci},
}

PAYS_PAR_DEFAUT = 'CI'


def normaliser(numero: str, pays: str = PAYS_PAR_DEFAUT) -> str:
    """
    Nettoie et normalise un numero au format LOCAL (celui deja utilise
    dans toute la base : Personnel.telephone, CodeOTP.telephone...).
    Ne leve jamais d'exception - une valeur vide ou non reconnue est
    renvoyee nettoyee telle quelle plutot que de bloquer l'appelant.
    """
    v = str(numero or '').strip()
    if not v:
        return ''
    v = re.sub(r'[\s().-]+', '', v)
    regles = _REGLES_PAR_PAYS.get(pays)
    if not regles:
        return v
    return regles['normaliser_local'](v)


def vers_international(numero: str, pays: str = PAYS_PAR_DEFAUT) -> str:
    """
    Format international (+225XXXXXXXXXX) attendu par les fournisseurs
    SMS externes (proSMS, HSMS, Meta WhatsApp) - le format LOCAL reste la
    representation stockee en base, celle-ci n'est utilisee qu'au moment
    de l'appel reseau.
    """
    local = normaliser(numero, pays)
    regles = _REGLES_PAR_PAYS.get(pays)
    if not regles or not local:
        return local
    return regles['vers_international'](local)
