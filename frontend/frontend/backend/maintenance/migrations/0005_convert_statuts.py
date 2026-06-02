from django.db import migrations

def convert_statuts(apps, schema_editor):
    Incident = apps.get_model('maintenance', 'Incident')
    mapping = {'Ouvert': 'declare', 'En cours': 'en_cours', 'Résolu': 'resolu', 'Fermé': 'cloture'}
    for old, new in mapping.items():
        Incident.objects.filter(statut=old).update(statut=new)
    # Mettre à jour les historical
    try:
        HistoricalIncident = apps.get_model('maintenance', 'historicalincident')
        for old, new in mapping.items():
            HistoricalIncident.objects.filter(statut=old).update(statut=new)
    except: pass

class Migration(migrations.Migration):
    dependencies = [('maintenance', '0004_workflow_v2')]
    operations = [migrations.RunPython(convert_statuts, migrations.RunPython.noop)]
