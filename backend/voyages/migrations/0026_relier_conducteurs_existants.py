"""
Migration de donnees : relie automatiquement les Voyage.conducteur /
conducteur_secondaire (texte libre existant) vers la fiche Personnel
correspondante, par correspondance exacte de nom complet
("{nom} {prenom}", insensible a la casse). N'ECRASE JAMAIS le texte
existant, se contente de REMPLIR la nouvelle reference quand une
correspondance sure est trouvee - une correspondance ambigue (plusieurs
Personnel avec le meme nom complet) ou absente laisse le champ FK vide,
sans bloquer la migration ni modifier le texte.
"""
from django.db import migrations


def relier_conducteurs_existants(apps, schema_editor):
    Voyage = apps.get_model("voyages", "Voyage")
    Personnel = apps.get_model("residences", "Personnel")

    # Index nom complet -> id, ne garde que les correspondances UNIQUES
    # (un nom complet partage par plusieurs personnes reste ambigu,
    # volontairement pas devine).
    comptes = {}
    index = {}
    for p in Personnel.objects.all().only("id", "nom", "prenom"):
        cle = f"{p.nom} {p.prenom}".strip().lower()
        comptes[cle] = comptes.get(cle, 0) + 1
        index[cle] = p.id
    noms_uniques = {cle: pid for cle, pid in index.items() if comptes[cle] == 1}

    relies_principal = relies_secondaire = 0
    for v in Voyage.objects.exclude(conducteur="").only("id", "conducteur", "conducteur_secondaire", "conducteur_personnel_id", "conducteur_secondaire_personnel_id"):
        maj = {}
        if v.conducteur and not v.conducteur_personnel_id:
            pid = noms_uniques.get(v.conducteur.strip().lower())
            if pid:
                maj["conducteur_personnel_id"] = pid
                relies_principal += 1
        if v.conducteur_secondaire and not v.conducteur_secondaire_personnel_id:
            pid = noms_uniques.get(v.conducteur_secondaire.strip().lower())
            if pid:
                maj["conducteur_secondaire_personnel_id"] = pid
                relies_secondaire += 1
        if maj:
            Voyage.objects.filter(pk=v.pk).update(**maj)

    print(f"\n  [migration conducteurs] {relies_principal} conducteur(s) principal(aux) et {relies_secondaire} second(s) relies automatiquement par nom.")


def revenir_en_arriere(apps, schema_editor):
    # Rien a annuler : le texte original n'a jamais ete touche, seule la
    # FK ajoutee est remplie - la supprimer suffit (gere par la migration
    # de suppression de colonne elle-meme si on revient en arriere).
    pass


class Migration(migrations.Migration):
    dependencies = [
        ("voyages", "0025_historicalvoyage_conducteur_personnel_and_more"),
    ]
    operations = [
        migrations.RunPython(relier_conducteurs_existants, revenir_en_arriere),
    ]
