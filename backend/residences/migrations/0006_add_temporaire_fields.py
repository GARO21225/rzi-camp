from django.db import migrations, models

class Migration(migrations.Migration):
    dependencies = [('residences', '0005_demande_historicaldemande')]
    operations = [
        migrations.AddField(model_name='personnel', name='est_temporaire',
            field=models.BooleanField(default=False)),
        migrations.AddField(model_name='personnel', name='date_expiration',
            field=models.DateTimeField(blank=True, null=True)),
        migrations.AddField(model_name='historicalpersonnel', name='est_temporaire',
            field=models.BooleanField(default=False)),
        migrations.AddField(model_name='historicalpersonnel', name='date_expiration',
            field=models.DateTimeField(blank=True, null=True)),
    ]
