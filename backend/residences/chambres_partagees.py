"""Chambres partagées (règle « chambres doubles »).

* Type « alternance » — 1 place, 2 résidents principaux : l'un est sur le camp pendant que l'autre est en repos.
  -> un seul enregistrement Batiment (ex. B104) avec residents_principaux_max = 2.
* Type « rotation à 3 » — 2 places, 3 résidents principaux : 2 sont sur le camp, le 3e est hors camp.
  -> deux enregistrements Batiment (ex. B104-A et B104-B) partageant le même `groupe_chambre` (« B104 ») avec
     residents_principaux_max = 3 ; chaque résident prend la première place libre à son retour.

La capacité de résidents principaux est portée par le GROUPE (somme sur ses places). Une chambre ordinaire
(sans groupe, max = 1) se comporte exactement comme avant.
"""
from .models import Batiment, ResidentPrincipal


def places_du_groupe(batiment):
    """Toutes les places (enregistrements Batiment) de la chambre partagée ; [batiment] si chambre ordinaire."""
    if batiment.groupe_chambre:
        return list(Batiment.objects.filter(groupe_chambre=batiment.groupe_chambre).order_by("residence"))
    return [batiment]


def capacite_residents(batiment):
    return max([p.residents_principaux_max or 1 for p in places_du_groupe(batiment)] + [1])


def rp_actifs(batiment):
    ids = [p.pk for p in places_du_groupe(batiment)]
    return list(ResidentPrincipal.objects.filter(batiment_id__in=ids, date_fin__isnull=True).select_related("personnel", "batiment"))


def est_partagee(batiment):
    return bool(batiment.groupe_chambre) or (batiment.residents_principaux_max or 1) > 1


def type_chambre(batiment):
    if not est_partagee(batiment):
        return "simple"
    places = len(places_du_groupe(batiment))
    cap = capacite_residents(batiment)
    if places == 1:
        return "alternance"          # 1 place, plusieurs résidents qui alternent
    return "rotation" if cap > places else "double"


def refus_declaration(batiment, personnel):
    """None si `personnel` peut devenir résident principal de cette chambre (ou de son groupe), sinon dict d'erreur 409."""
    autres = [rp for rp in rp_actifs(batiment) if rp.personnel_id != personnel.id]
    if len(autres) < capacite_residents(batiment):
        return None
    noms = ", ".join(f"{rp.personnel.nom} {rp.personnel.prenom}" for rp in autres)
    base = batiment.groupe_chambre or batiment.residence
    if capacite_residents(batiment) == 1:
        return {"error": f"{batiment.residence} est déjà la résidence principale de {noms}.", "conflit_personnel": autres[0].personnel_id}
    return {"error": f"La chambre {base} est complète ({len(autres)}/{capacite_residents(batiment)} résidents principaux : {noms}).",
            "conflit_personnel": autres[0].personnel_id}


def place_occupee_par(personnel_id, batiment):
    """La place du groupe physiquement occupée par cette personne, sinon None."""
    for p in places_du_groupe(batiment):
        if p.personnel_id == personnel_id and p.statut == "Occupé":
            return p
    return None


def place_libre(batiment, preferee=None):
    """Première place libre (préférée en premier) : statut Libre/Réservé sans occupant."""
    places = places_du_groupe(batiment)
    if preferee is not None:
        places.sort(key=lambda p: p.pk != preferee.pk)
    for p in places:
        if p.statut in ("Libre", "Réservé") and not p.personnel_id:
            return p
    return None
