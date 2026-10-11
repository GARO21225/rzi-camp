from django.db import migrations, models


def jours_par_defaut(apps, schema_editor):
    """Abidjan → Camp : mardi/jeudi/samedi · Camp → Abidjan : lundi/mercredi/vendredi."""
    It = apps.get_model("voyages", "ItineraireModele")
    est_camp = lambda t: "camp" in (t or "").lower() or "sango" in (t or "").lower()
    for it in It.objects.all():
        o, d = est_camp(it.origine), est_camp(it.destination)
        if o and not d:
            it.jours_voyage = [0, 2, 4]
        elif d and not o:
            it.jours_voyage = [1, 3, 5]
        else:
            continue
        it.save(update_fields=["jours_voyage"])


class Migration(migrations.Migration):
    dependencies = [("voyages", "0034_voyage_vehicule_personnel")]
    operations = [
        migrations.AddField(model_name="itinerairemodele", name="jours_voyage", field=models.JSONField(blank=True, default=list)),
        migrations.RunPython(jours_par_defaut, migrations.RunPython.noop),
    ]
