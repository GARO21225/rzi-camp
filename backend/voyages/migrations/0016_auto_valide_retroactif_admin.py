from django.db import migrations, models

def valider_retroactif(apps, schema_editor):
    """
    creer_rotation() (utilise par 'Nouvelle rotation' ET 'Voyage individuel')
    ne geraint pas l'auto-validation admin avant ce correctif - des voyages
    crees par un admin sont donc restes 'en_attente' a tort. On les
    valide retroactivement : si celui qui a enregistre le voyage
    (enregistre_par) est admin/staff, le voyage est repute deja valide des
    sa creation.
    """
    Voyage = apps.get_model('voyages', 'Voyage')
    a_corriger = Voyage.objects.filter(
        statut_validation='en_attente',
        enregistre_par__isnull=False,
    ).filter(
        models.Q(enregistre_par__is_staff=True) | models.Q(enregistre_par__is_superuser=True)
    )
    for v in a_corriger:
        v.statut_validation = 'valide'
        v.valide_par = v.enregistre_par
        v.date_validation = v.created_at
        v.save(update_fields=['statut_validation', 'valide_par', 'date_validation'])

def unvalider(apps, schema_editor):
    pass

class Migration(migrations.Migration):
    dependencies = [('voyages', '0015_nettoyage_complet_refuses')]
    operations = [migrations.RunPython(valider_retroactif, unvalider)]
