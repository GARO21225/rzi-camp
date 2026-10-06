from django.db import migrations


def sync(apps, schema_editor):
    """Aligne une fois pour toutes les comptes existants (nouveaux profils créés depuis)."""
    try:
        from accounts.profils import synchroniser_profils
        synchroniser_profils()
    except Exception as e:  # ne jamais bloquer un déploiement
        print(f"  [sync profils] ignoré : {e}")


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0013_alter_smsmessage_canal_alter_smsmessage_destinataire"),
        ("residences", "0026_batiment_etage"),
    ]
    operations = [migrations.RunPython(sync, migrations.RunPython.noop)]
