from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import PushSubscription
from . import push


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def push_cle(request):
    """Clé publique VAPID (le navigateur en a besoin pour s'abonner) + état de l'abonnement de l'utilisateur."""
    return Response({"cle": push.cle_publique(), "abonnements": request.user.push_subscriptions.count()})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def push_abonner(request):
    s = request.data.get("subscription") or request.data
    cles = s.get("keys") or {}
    endpoint, p256dh, auth = s.get("endpoint"), cles.get("p256dh"), cles.get("auth")
    if not (endpoint and p256dh and auth):
        return Response({"error": "Abonnement incomplet"}, status=400)
    PushSubscription.objects.update_or_create(
        endpoint=endpoint, defaults={"user": request.user, "p256dh": p256dh, "auth": auth,
                                     "user_agent": (request.META.get("HTTP_USER_AGENT") or "")[:300]})
    return Response({"ok": True})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def push_desabonner(request):
    PushSubscription.objects.filter(user=request.user, endpoint=request.data.get("endpoint", "")).delete()
    return Response({"ok": True})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def push_test(request):
    """Envoie un push de test aux appareils de l'utilisateur connecté."""
    if not request.user.push_subscriptions.exists():
        return Response({"error": "Aucun appareil abonné"}, status=400)
    push.envoyer([request.user.pk], "🔔 Notifications activées", "Vous recevrez ici les événements et alertes du camp.", "/", urgent=False, tag="test")
    return Response({"ok": True})
