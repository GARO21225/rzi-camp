from django.db import migrations


def mota(apps, schema_editor):
    """MOTA = entreprise (sans département) dont dépendent JACHRIS, NEEMBA, MAXAM, BIA.
    « MOTA ENGIL » reste un sous-traitant de ROXGOLD (département Mining), comme dans Camp Occupancy."""
    Entreprise = apps.get_model("residences", "Entreprise")
    m, _ = Entreprise.objects.get_or_create(nom="MOTA", defaults={"actif": True})
    Entreprise.objects.filter(entreprise_mere__nom="MOTA ENGIL").update(entreprise_mere=m, departement=None)


class Migration(migrations.Migration):
    dependencies = [("residences", "0028_personnel_mobilite_exclue")]
    operations = [migrations.RunPython(mota, migrations.RunPython.noop)]
