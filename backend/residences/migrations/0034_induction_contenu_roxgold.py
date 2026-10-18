from django.db import migrations


def charger(apps, schema_editor):
    from residences.induction_roxgold import charger as _charger
    _charger(apps)


class Migration(migrations.Migration):
    """Contenu de l'Induction Camp repris du document officiel Roxgold Sango
    (l'ancien contenu est désactivé, pas supprimé)."""

    dependencies = [("residences", "0033_induction_camp_exemption")]

    operations = [migrations.RunPython(charger, migrations.RunPython.noop)]
