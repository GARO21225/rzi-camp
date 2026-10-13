from django.db import migrations


def creer_role(apps, schema_editor):
    """Rôle « Camp Boss » (restauration : tableau de bord, import menus, réglages restaurants)."""
    RoleCustom = apps.get_model("accounts", "RoleCustom")
    RoleCustom.objects.get_or_create(
        code="camp_boss",
        defaults={
            "label": "Camp Boss",
            "menu_pages": ["/carte", "/evenements", "/restauration", "/restaurants", "/historique", "/analytics"],
            "pages_readonly": [],
            "est_systeme": False,
        },
    )


class Migration(migrations.Migration):
    dependencies = [("accounts", "0015_rapport_type_options")]
    operations = [migrations.RunPython(creer_role, migrations.RunPython.noop)]
