"""
Règle UNIQUE « départ résidence sans décision », partagée par :
  - la tâche quotidienne verifier_departs_residence (notifications résident / admin) ;
  - le tableau de bord admin (/api/batiments/stats/ : alerte 🏠 + liste « Il part / Il reste »).

Avant, chacun avait sa propre copie de la règle et elles avaient divergé : le
tableau de bord écartait encore un résident ayant une demande de voyage
« validée » (statut terminal — souvent ancienne, parfois sans voyage créé),
alors que la notification, corrigée, continuait d'alerter. L'admin recevait
« Départ résidence dépassé — décision requise » sans rien trouver à traiter.
"""
from django.db.models import Q

# Une demande encore EN COURS de décision : inutile de relancer. « validee » est
# terminal — c'est le Voyage qui en découle (planifié / en voyage) qui fait foi.
STATUTS_DEMANDE_EN_COURS = ("en_attente", "proposition")


def personnels_pris_en_charge(personnel_ids):
    """Personnels dont le départ est déjà en cours de traitement (voyage actif ou demande en cours)."""
    from voyages.models import Voyage
    from .models import Demande
    ids = set(personnel_ids)
    if not ids:
        return set()
    couverts = set(Voyage.objects.filter(personnel_id__in=ids, statut__in=["planifie", "en_voyage"])
                   .values_list("personnel_id", flat=True))
    couverts |= set(Demande.objects.filter(
        Q(demandeur__personnel__id__in=ids), type_demande="voyage", statut__in=STATUTS_DEMANDE_EN_COURS,
    ).values_list("demandeur__personnel__id", flat=True))
    return couverts


def departs_sans_decision(today, jusqu_a=None, apres=None):
    """Chambres occupées dont le départ annoncé tombe dans la fenêtre, sans décision prise.
    `jusqu_a` : date_depart <= jusqu_a ; `apres` : date_depart > apres (bornes facultatives)."""
    from .models import Batiment
    qs = Batiment.objects.filter(statut="Occupé", personnel__isnull=False, date_depart__isnull=False)
    if jusqu_a is not None:
        qs = qs.filter(date_depart__lte=jusqu_a)
    if apres is not None:
        qs = qs.filter(date_depart__gt=apres)
    batiments = list(qs.select_related("personnel").order_by("date_depart", "residence"))
    couverts = personnels_pris_en_charge(b.personnel_id for b in batiments)
    return [b for b in batiments if b.personnel_id not in couverts]
