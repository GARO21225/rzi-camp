"""
Journalisation des CONNEXIONS - reutilise le modele generique AuditLog
(restauration/models.py, deja utilise pour l'ajustement de stock
boutique) plutot que d'en creer un second.

Contexte (investigation demandee : "pourquoi je ne vois que les actions
de l'admin et non des autres qui se sont connectes ?") : la page Audit
Trail (restauration/views.py::AuditLogViewSet) agrege deja correctement
django-simple-history sur Personnel/Incident/RepasLog/Evenement -
CREATIONS/MODIFICATIONS/SUPPRESSIONS de ces modeles sont bien tracees
pour N'IMPORTE QUEL utilisateur, pas seulement l'admin. Ce n'etait donc
PAS un bug de permission/filtrage : un utilisateur qui se connecte sans
JAMAIS creer/modifier un Personnel, un Incident, un Repas ou un
Evenement n'a simplement RIEN a apparaitre dans ce flux, parce que
l'evenement "connexion" lui-meme n'etait journalise nulle part - ni pour
l'admin, ni pour personne d'autre (l'admin n'apparaissait que parce que
c'est lui qui avait modifie des Personnel pendant les tests). Ce module
comble ce trou : desormais TOUTE connexion reussie (et un echec) devient
une entree d'audit, quel que soit l'utilisateur.
"""
import logging

logger = logging.getLogger(__name__)


def _ip_client(request):
    if not request:
        return None
    xff = request.META.get('HTTP_X_FORWARDED_FOR')
    if xff:
        return xff.split(',')[0].strip()
    return request.META.get('REMOTE_ADDR')


def journaliser_connexion(request, user, reussie, methode, detail=''):
    """
    methode: 'mot_de_passe' | 'otp'. Ne leve jamais d'exception - un
    audit qui plante ne doit jamais faire echouer (ni bloquer) une
    connexion, reussie ou non.
    """
    try:
        from restauration.models import AuditLog
        AuditLog.objects.create(
            utilisateur=user if (reussie and user) else None,
            module='connexion',
            action='login_reussi' if reussie else 'login_echec',
            detail=(detail or f"via {methode}")[:500],
            ip=_ip_client(request),
        )
    except Exception:
        logger.exception("journaliser_connexion : echec de journalisation (ignore)")
