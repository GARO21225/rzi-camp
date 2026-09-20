# Reecrit a la main : preserve l'etat "readonly" existant en le
# transformant en pages_readonly = menu_pages (tout etait en lecture
# seule -> tout le reste aussi, comportement identique pour les roles
# deja configures) avant de retirer l'ancien champ booleen.

from django.db import migrations, models


def migrer_readonly_vers_pages(apps, schema_editor):
    RoleCustom = apps.get_model('accounts', 'RoleCustom')
    for role in RoleCustom.objects.all():
        if getattr(role, 'readonly', False):
            role.pages_readonly = list(role.menu_pages or [])
            role.save(update_fields=['pages_readonly'])


def inverse(apps, schema_editor):
    pass  # rien a restaurer : le champ booleen redevient juste False partout


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0009_codeotp'),
    ]

    operations = [
        migrations.AddField(
            model_name='rolecustom',
            name='pages_readonly',
            field=models.JSONField(blank=True, default=list),
        ),
        migrations.RunPython(migrer_readonly_vers_pages, inverse),
        migrations.RemoveField(
            model_name='rolecustom',
            name='readonly',
        ),
    ]
