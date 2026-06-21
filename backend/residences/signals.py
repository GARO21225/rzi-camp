from django.db.models.signals import post_save
from django.dispatch import receiver
from .models import Personnel


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
