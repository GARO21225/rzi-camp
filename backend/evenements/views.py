
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from .models import Evenement, Notification, AlerteCampus, SimpleNotification
from .serializers import EvenementSerializer, NotificationSerializer, AlerteSerializer
import datetime


class EvenementViewSet(viewsets.ModelViewSet):
    queryset = Evenement.objects.all()
    serializer_class = EvenementSerializer

    def get_queryset(self):
        return Evenement.objects.all().order_by("-date_debut")

    def destroy(self, request, *args, **kwargs):
        if not request.user.is_staff and not request.user.is_superuser:
            return Response({"error":"Admin uniquement"}, status=403)
        return super().destroy(request, *args, **kwargs)

    @action(detail=True, methods=["post"])
    def notifier(self, request, pk=None):
        evt = self.get_object()
        n = evt.notifier_residents()
        return Response({"ok":True,"residents_notifies":n})

    @action(detail=True, methods=["patch"])
    def changer_statut(self, request, pk=None):
        evt = self.get_object()
        statut = request.data.get("statut")
        if statut not in [s[0] for s in Evenement.STATUT]:
            return Response({"error":"Statut invalide"}, status=400)
        evt.statut = statut
        evt.save(update_fields=["statut"])
        return Response(EvenementSerializer(evt).data)

    @action(detail=False, methods=["get"])
    def agenda(self, request):
        import django.utils.timezone as tz
        qs = Evenement.objects.filter(
            date_debut__gte=tz.now(), statut__in=["planifie","en_cours"]
        ).order_by("date_debut")[:10]
        return Response(EvenementSerializer(qs, many=True).data)


class NotificationViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = NotificationSerializer
    queryset = Notification.objects.none()

    def get_queryset(self):
        user = self.request.user
        if hasattr(user, "personnel"):
            return Notification.objects.filter(personnel=user.personnel).order_by("-date_envoi")
        return Notification.objects.none()

    @action(detail=True, methods=["post"])
    def marquer_lu(self, request, pk=None):
        n = self.get_object()
        n.marquer_lue()
        return Response({"ok":True})

    @action(detail=False, methods=["post"])
    def tout_lire(self, request):
        from django.utils import timezone
        if hasattr(request.user, "personnel"):
            Notification.objects.filter(
                personnel=request.user.personnel, lu=False
            ).update(lu=True, date_lecture=timezone.now())
        SimpleNotification.objects.filter(user=request.user, lu=False).update(
            lu=True, date_lecture=timezone.now()
        )
        return Response({"ok":True})

    @action(detail=False, methods=["get"])
    def compteur(self, request):
        count = 0
        alertes_data = []
        prochain = None
        all_notifs = []

        # Event-based notifications
        if hasattr(request.user, "personnel"):
            ev_notifs = Notification.objects.filter(
                personnel=request.user.personnel
            ).select_related("evenement").order_by("-date_envoi")[:10]
            count += ev_notifs.filter(lu=False).count()
            for n in ev_notifs:
                all_notifs.append({
                    "id": str(n.id),
                    "evenement_titre": n.evenement.titre if n.evenement else "Événement",
                    "evenement_type": n.evenement.type_event if n.evenement else "evenement",
                    "evenement_date": n.evenement.date_debut.isoformat() if n.evenement else None,
                    "evenement_lieu": n.evenement.lieu if n.evenement else "",
                    "lu": n.lu,
                    "date_envoi": n.date_envoi.isoformat(),
                    "source": "event",
                })

        # System notifications (demandes, etc.)
        sys_notifs = SimpleNotification.objects.filter(
            user=request.user
        ).order_by("-date_envoi")[:10]
        count += sys_notifs.filter(lu=False).count()
        for n in sys_notifs:
            all_notifs.append({
                "id": f"s{n.id}",
                "evenement_titre": n.titre,
                "evenement_type": n.type_notif,
                "evenement_date": None,
                "evenement_lieu": "",
                "lu": n.lu,
                "date_envoi": n.date_envoi.isoformat(),
                "message": n.message,
                "source": "system",
            })

        # Sort by date
        all_notifs.sort(key=lambda x: x["date_envoi"], reverse=True)

        # Active alerts
        try:
            alertes = AlerteCampus.objects.filter(active=True).order_by("-date_creation")[:3]
            alertes_data = [{"id":a.id,"message":a.message,"type_alerte":a.type_alerte} for a in alertes]
        except Exception:
            pass

        # Next event
        try:
            import django.utils.timezone as tz
            evt = Evenement.objects.filter(
                date_debut__gte=tz.now(), statut__in=["planifie","en_cours"]
            ).order_by("date_debut").first()
            if evt:
                prochain = {
                    "id": evt.id, "titre": evt.titre,
                    "date_debut": evt.date_debut.isoformat(), "lieu": evt.lieu
                }
        except Exception:
            pass

        return Response({
            "non_lues": count,
            "alertes": alertes_data,
            "prochain_evenement": prochain,
            "notifications": all_notifs[:20],
        })


class AlerteViewSet(viewsets.ModelViewSet):
    serializer_class = AlerteSerializer
    queryset = AlerteCampus.objects.all()

    def get_queryset(self):
        return AlerteCampus.objects.filter(active=True).order_by("-date_creation")

    @action(detail=True, methods=["post"])
    def desactiver(self, request, pk=None):
        a = self.get_object()
        a.active = False
        a.save(update_fields=["active"])
        return Response({"ok":True})
