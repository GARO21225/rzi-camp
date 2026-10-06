"""
Liaison convoi <-> résidence, appliquée AUTOMATIQUEMENT à la date du trajet.

  Camp -> X  (date du convoi)      la chambre est libérée (Voyage.partir) ;
                                   la date « Il revient quand ? » bloque les
                                   chevauchements et planifie le trajet retour.
  X -> Camp  (date du convoi)      la personne est relogée avec
                                     Arrivée = date du voyage,
                                     Départ  = date « Retourne quand ? »
                                   (Voyage.revenir, qui crée aussi l'historique).

Idempotent : ne traite que les trajets validés encore « planifie », donc
le rejouer (lazy à chaque requête, ou via la commande) est sans danger.
"""
import datetime

from django.core.cache import cache

from .models import Voyage
from .trajets import est_camp

FENETRE_RATTRAPAGE_JOURS = 7
CLE_THROTTLE = "voyages:appliquer_du_jour"


def appliquer_voyages_du_jour(today=None):
    today = today or datetime.date.today()
    debut = today - datetime.timedelta(days=FENETRE_RATTRAPAGE_JOURS)
    qs = (Voyage.objects.select_related("personnel")
          .filter(statut="planifie", statut_validation="valide",
                  date_depart__gte=debut, date_depart__lte=today)
          .exclude(personnel__isnull=True)
          .order_by("date_depart", "id"))
    resultat = {"departs": 0, "arrivees": 0, "conflits": []}
    for v in qs:
        try:
            if est_camp(v.origine) and not est_camp(v.destination):
                v.partir(v.date_depart)
                resultat["departs"] += 1
                v._notifier_retour(v.personnel, f"🧳 Départ du camp enregistré ({v.date_depart:%d/%m/%Y}) — votre chambre est libérée"
                                   + (f", retour prévu le {v.date_retour_prevue:%d/%m/%Y}." if v.date_retour_prevue and v.date_retour_prevue > v.date_depart else "."))
            elif est_camp(v.destination) and not est_camp(v.origine) and not v.trajet_aller_seul:
                info = v.revenir(v.date_depart)
                resultat["arrivees"] += 1
                if info.get("chambre_restituee"):
                    fin = f" Départ prévu le {v.date_retour_prevue:%d/%m/%Y}." if v.date_retour_prevue and v.date_retour_prevue > v.date_depart else ""
                    v._notifier_retour(v.personnel, f"🏠 Arrivée au camp enregistrée ({v.date_depart:%d/%m/%Y}) — vous êtes logé automatiquement.{fin}")
                if info.get("chambre_occupee_par"):
                    resultat["conflits"].append(f"{v.personnel} : {info['residence']} occupée par {info['chambre_occupee_par']}")
        except Exception:  # un trajet en erreur ne doit jamais bloquer les autres
            continue
    return resultat


def appliquer_si_necessaire(delai=120):
    """Version paresseuse : au plus une fois toutes les `delai` secondes
    (pas besoin de cron sur l'hôte)."""
    try:
        if not cache.add(CLE_THROTTLE, 1, delai):
            return None
        return appliquer_voyages_du_jour()
    except Exception:
        return None
