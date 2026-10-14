from django.db.models.signals import post_save
from django.dispatch import receiver

from .models import AlerteCampus, SimpleNotification


@receiver(post_save, sender=SimpleNotification)
def push_notification(sender, instance, created, **kwargs):
    """Chaque notification « cloche » destinée à un compte déclenche aussi un push téléphone."""
    if created and instance.user_id:
        from .push import envoyer
        urgent = instance.type_notif == "alerte"
        envoyer([instance.user_id], instance.titre, instance.message, "/", urgent, tag=f"notif-{instance.pk}")


@receiver(post_save, sender=AlerteCampus)
def push_alerte(sender, instance, created, **kwargs):
    """Une alerte active est poussée à TOUS les appareils abonnés (sirène côté téléphone)."""
    if created and instance.active:
        from django.contrib.auth.models import User
        from .push import envoyer
        urgent = instance.type_alerte in ("danger", "warning")
        envoyer(User.objects.filter(is_active=True, push_subscriptions__isnull=False).distinct().values_list("id", flat=True),
                "🚨 ALERTE" if urgent else "ℹ️ Information", instance.message, "/", urgent, tag=f"alerte-{instance.pk}")
