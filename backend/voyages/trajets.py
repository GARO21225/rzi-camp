"""
Trajets en ALLER SIMPLE — modèle de fonctionnement du camp :

  Camp → Abidjan   on demande « vous revenez quand ? » : la chambre est
                   libérée, la date de retour bloque les chevauchements, et
                   le trajet retour Abidjan → Camp est créé automatiquement
                   à cette date, dans le convoi du jour.
  Abidjan → Camp   on demande « vous repartez quand ? » : c'est la date de
                   départ de l'hébergement (Batiment.date_depart), qui
                   déclenche la relance « Vous partez demain ? » à J-1.

Chaque Voyage est donc UN trajet (pas un aller-retour) :
  - vers une ville (Camp → X) : trajet_aller_seul=True, son arrivée ne
    touche pas à la chambre ;
  - vers le camp (X → Camp)  : trajet_aller_seul=False, son arrivée
    restitue la chambre (Voyage.revenir()).
"""
import uuid

from .models import Voyage, Rotation, ItineraireModele


def est_camp(lieu):
    return "camp" in (lieu or "").strip().lower()


def itineraire_inverse(itineraire):
    """Itinéraire du trajet retour (ex : Camp → Abidjan  ->  Abidjan → Camp)."""
    if not itineraire:
        return ItineraireModele.objects.filter(actif=True, destination__icontains="camp").first()
    return (ItineraireModele.objects.filter(actif=True, origine__iexact=itineraire.destination,
                                            destination__iexact=itineraire.origine).first()
            or ItineraireModele.objects.filter(actif=True, destination__icontains="camp").first())


def rattacher_au_convoi(voyage, itineraire, enregistre_par=None):
    """Place le voyage dans le convoi (Rotation) du même itinéraire et du
    même jour, en en ouvrant un nouveau si aucun n'existe ou s'il est
    complet - même règle que la validation d'une demande de voyage."""
    from .views import _appliquer_itineraire_a_voyage
    if not itineraire:
        return None
    rotation = Rotation.objects.filter(itineraire_modele=itineraire, date_depart=voyage.date_depart,
                                       statut="planifie").first()
    if rotation and Voyage.objects.filter(rotation_id=rotation.rotation_id).exclude(statut="annule").count() >= rotation.nb_places_total:
        rotation = None  # convoi complet : on en ouvre un nouveau plutôt que de bloquer
    if not rotation:
        rotation = Rotation.objects.create(
            rotation_id=str(uuid.uuid4())[:8].upper(),
            origine=itineraire.origine, destination=itineraire.destination,
            date_depart=voyage.date_depart, date_retour_prevue=voyage.date_retour_prevue or voyage.date_depart,
            itineraire_modele=itineraire, enregistre_par=enregistre_par,
        )
    voyage.rotation_id = rotation.rotation_id
    voyage.nb_places_total = rotation.nb_places_total
    voyage.type_voyage = "rotation"
    for champ in ("vehicule", "vehicule_matricule", "conducteur", "conducteur_secondaire", "heure_depart", "point_rdv"):
        if getattr(rotation, champ, None):
            setattr(voyage, champ, getattr(rotation, champ))
    voyage.conducteur_personnel_id = rotation.conducteur_personnel_id
    voyage.conducteur_secondaire_personnel_id = rotation.conducteur_secondaire_personnel_id
    voyage.save()
    _appliquer_itineraire_a_voyage(voyage, itineraire)
    return rotation


def creer_trajet_retour(voyage_aller, itineraire_aller=None, enregistre_par=None):
    """Crée le trajet X → Camp à la date de retour d'un trajet Camp → X.
    Montée = la ville où la personne est descendue. Sans effet si le
    trajet aller va déjà au camp, n'a pas de date de retour, ou si un
    trajet vers le camp est déjà prévu ce jour-là pour cette personne."""
    from django.utils import timezone
    date_retour = voyage_aller.date_retour_prevue
    if not date_retour or date_retour <= voyage_aller.date_depart or est_camp(voyage_aller.destination):
        return None
    if Voyage.objects.filter(personnel_id=voyage_aller.personnel_id, date_depart=date_retour,
                             destination__icontains="camp").exclude(statut="annule").exists():
        return None
    itineraire = itineraire_inverse(itineraire_aller)
    retour = Voyage.objects.create(
        personnel_id=voyage_aller.personnel_id,
        origine=voyage_aller.destination,
        destination=(itineraire.destination if itineraire else "CAMP"),
        motif=f"Retour au camp — planifié automatiquement au départ du {voyage_aller.date_depart:%d/%m/%Y}",
        date_depart=date_retour, date_retour_prevue=date_retour,
        statut="planifie", trajet_aller_seul=False,
        vehicule_personnel=voyage_aller.vehicule_personnel,
        vehicule="Véhicule personnel" if voyage_aller.vehicule_personnel else "",
        vehicule_matricule=voyage_aller.vehicule_matricule if voyage_aller.vehicule_personnel else "",
        type_voyage="individuel",
        statut_validation="valide", valide_par=enregistre_par, date_validation=timezone.now(),
        enregistre_par=enregistre_par,
    )
    if not retour.vehicule_personnel:
        rattacher_au_convoi(retour, itineraire, enregistre_par)
    elif itineraire:
        from .views import _appliquer_itineraire_a_voyage
        _appliquer_itineraire_a_voyage(retour, itineraire)
    return retour


def fixer_prochain_depart(personnel, date_prochain_depart):
    """Date de départ de l'hébergement (déclenche la relance J-1 « Vous
    partez demain ? ») sur la chambre principale de la personne."""
    from residences.models import ResidentPrincipal, Batiment
    if not personnel or not date_prochain_depart:
        return None
    rp = ResidentPrincipal.objects.filter(personnel=personnel, date_fin__isnull=True).select_related("batiment").first()
    b = rp.batiment if rp and rp.batiment_id else Batiment.objects.filter(personnel=personnel).first()
    # Jamais sur une chambre occupée par quelqu'un d'autre (ce serait SA date de départ)
    if b and b.personnel_id == personnel.id:
        b.date_depart = date_prochain_depart
        b.save(update_fields=["date_depart"])
    return b
