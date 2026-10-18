from django.db import migrations


def ajoute(apps, schema_editor):
    """Ajoute les questions supplémentaires du quiz sans toucher aux questions existantes
    (ni à leurs modifications / désactivations faites par l'admin)."""
    from residences.induction_roxgold import QUIZ_COMPLEMENT
    Quiz = apps.get_model("residences", "InductionQuizQuestion")
    debut = (Quiz.objects.order_by("-ordre").values_list("ordre", flat=True).first() or 0) + 1
    for i, (question, options, bonne, explication) in enumerate(QUIZ_COMPLEMENT):
        Quiz.objects.get_or_create(question=question, defaults=dict(options=options, bonne_reponse=bonne,
                                                                    explication=explication, ordre=debut + i, actif=True))


class Migration(migrations.Migration):
    dependencies = [("residences", "0036_efface_provenance_sig")]
    operations = [migrations.RunPython(ajoute, migrations.RunPython.noop)]
