from django.db.models.signals import post_save
from django.dispatch import receiver
from .models import Personnel, OccupationHistory


@receiver(post_save, sender=Personnel)
def sync_personnel_snapshot_to_batiments(sender, instance, created, **kwargs):
    """Propage nom/prénom/société vers les Batiment actuellement liés à cette
    Personnel. Batiment.occupant/societe sont un snapshot dénormalisé volontaire
    (voir BatimentViewSet.partial_update) — utile pour l'affichage rapide et le
    cas d'une occupation sans fiche Personnel complète. Sans ce signal, modifier
    le nom ou la société d'une personne après son affectation ne se répercutait
    jamais sur la chambre qu'elle occupe, créant une divergence silencieuse.
    """
    if created:
        return  # rien à synchroniser à la création, l'affectation se fait après
    from .models import Batiment
    Batiment.objects.filter(personnel=instance).exclude(
        occupant=f"{instance.nom} {instance.prenom}", societe=instance.societe
    ).update(
        occupant=f"{instance.nom} {instance.prenom}",
        societe=instance.societe,
    )


@receiver(post_save, sender=OccupationHistory)
def induction_camp_au_premier_hebergement(sender, instance, created, **kwargs):
    """Premier hébergement d'une personne : l'induction du camp devient obligatoire -> notification."""
    if not created or not instance.personnel_id:
        return
    try:
        pers = instance.personnel
        if not pers or not pers.user_id:
            return
        if OccupationHistory.objects.filter(personnel_id=pers.id).count() != 1:
            return
        from .models import InductionCampRecord
        if InductionCampRecord.objects.filter(user_id=pers.user_id).exists():
            return
        from evenements.models import SimpleNotification
        SimpleNotification.objects.create(user_id=pers.user_id, personnel=pers, titre="🎓 Induction du camp obligatoire",
            message="Vous êtes hébergé(e) pour la première fois : veuillez faire l'induction du camp (signature obligatoire).", type_notif="alerte")
    except Exception:
        pass
