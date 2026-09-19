from django.db import migrations
import json

# Reprend les memes valeurs par defaut que celles utilisees jusqu'ici dans
# accounts/views.py::liste_parametres (menu_role_<code> / readonly_role_<code>)
# pour que rien ne change au premier deploiement - juste la source de
# verite qui passe de cle/valeur a une vraie table.
DEFAUTS = {
    'admin':        ('Administrateur', [], True),   # non configurable, toujours acces complet
    'agent':        ('Agent Terrain', ["/mon-compte","/carte","/demandes","/evenements","/voyages","/restauration","/maintenance","/historique"], False),
    'restauration': ('Equipe Restauration', ["/carte","/evenements","/restauration","/historique"], False),
    'technicien':   ('Technicien Maintenance', ["/carte","/evenements","/maintenance","/induction","/historique"], False),
    'menage':       ('Equipe Ménage', ["/carte","/evenements","/maintenance","/historique"], False),
    'boutique':     ('Bar & Boutique', ["/carte","/evenements","/boutique"], False),
    'securite':     ('Sécurité', ["/carte","/evenements","/annuaire"], False),
    'medical':      ('Médical', ["/carte","/evenements","/annuaire"], False),
    'hse':          ('HSE / QHSE', ["/carte","/evenements","/induction","/maintenance","/epi"], False),
    'accueil':      ("Agent d'accueil", ["/carte","/evenements","/annuaire","/residences"], False),
    'manager':      ('Manager / Responsable', ["/carte","/evenements","/demandes","/rapports","/analytics","/historique"], False),
}

def bootstrap_roles(apps, schema_editor):
    RoleCustom = apps.get_model('accounts', 'RoleCustom')
    Parametre = apps.get_model('accounts', 'Parametre')

    def lire_param(cle):
        try:
            return Parametre.objects.get(cle=cle).valeur
        except Parametre.DoesNotExist:
            return None

    for code, (label, pages_defaut, est_systeme) in DEFAUTS.items():
        # Si un admin avait deja personnalise via l'ancien systeme
        # cle/valeur, reprendre SA configuration plutot que le defaut.
        menu_valeur = lire_param(f'menu_role_{code}')
        pages = pages_defaut
        if menu_valeur:
            try:
                pages = json.loads(menu_valeur)
            except (ValueError, TypeError):
                pass
        readonly_valeur = lire_param(f'readonly_role_{code}')
        readonly = (readonly_valeur == '1')

        RoleCustom.objects.get_or_create(
            code=code,
            defaults={'label': label, 'menu_pages': pages, 'readonly': readonly, 'est_systeme': est_systeme},
        )

def reverse_noop(apps, schema_editor):
    pass

class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0006_rolecustom_alter_profile_role'),
    ]

    operations = [
        migrations.RunPython(bootstrap_roles, reverse_noop),
    ]
