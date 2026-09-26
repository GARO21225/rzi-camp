"""
Migration de donnees : cree une ligne Rotation pour chaque rotation_id
DEJA existant (regroupe actuellement uniquement via les lignes Voyage
qui le partagent), en reprenant les valeurs du voyage le plus recent de
ce groupe. Protege l'existant - aucune ligne Voyage n'est touchee,
seule la table Rotation est peuplee retroactivement pour que les
rotations deja creees restent visibles et coherentes avec le nouveau
modele.
"""
from django.db import migrations


def backfill_rotations(apps, schema_editor):
    Voyage = apps.get_model("voyages", "Voyage")
    Rotation = apps.get_model("voyages", "Rotation")

    rotation_ids = (Voyage.objects
        .exclude(rotation_id__isnull=True).exclude(rotation_id="")
        .values_list("rotation_id", flat=True).distinct())

    crees = 0
    for rid in rotation_ids:
        if Rotation.objects.filter(rotation_id=rid).exists():
            continue
        v = Voyage.objects.filter(rotation_id=rid).order_by("-id").first()
        if not v:
            continue
        Rotation.objects.create(
            rotation_id=rid,
            vehicule=v.vehicule or "", vehicule_matricule=v.vehicule_matricule or "",
            vehicule_photo=v.vehicule_photo or "",
            conducteur=v.conducteur or "", conducteur_personnel_id=v.conducteur_personnel_id,
            conducteur_secondaire=v.conducteur_secondaire or "", conducteur_secondaire_personnel_id=v.conducteur_secondaire_personnel_id,
            destination=v.destination or "", origine=v.origine or "",
            date_depart=v.date_depart, date_retour_prevue=v.date_retour_prevue,
            heure_depart=v.heure_depart, point_rdv=v.point_rdv or "",
            motif=v.motif or "", nb_places_total=v.nb_places_total or 15,
            niveau_alerte=v.niveau_alerte or 1, trajet_aller_seul=v.trajet_aller_seul or False,
            statut=v.statut, enregistre_par_id=v.enregistre_par_id,
        )
        crees += 1
    print(f"\n  [migration rotations] {crees} rotation(s) existante(s) migrees vers le nouveau modele Rotation.")


def revenir_en_arriere(apps, schema_editor):
    # Rien a annuler cote Voyage (jamais touche) - supprimer les lignes
    # Rotation retroactivement creees suffit, gere par la suppression du
    # modele lui-meme si on revient plus loin en arriere.
    pass


class Migration(migrations.Migration):
    dependencies = [
        ("voyages", "0028_rotation_historicalrotation"),
    ]
    operations = [
        migrations.RunPython(backfill_rotations, revenir_en_arriere),
    ]
