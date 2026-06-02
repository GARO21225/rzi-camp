from django.db import migrations, models

class Migration(migrations.Migration):
    dependencies = [
        ('restauration', '0007_add_menu_jour'),
    ]
    operations = [
        migrations.AddField(
            model_name='consommationboutique',
            name='mode_paiement',
            field=models.CharField(
                choices=[('especes','Espèces'),('bon','Bon de caisse'),('credit','Crédit')],
                default='especes', max_length=20
            ),
        ),
    ]
