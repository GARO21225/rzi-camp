
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from .models import Evenement, Notification, AlerteCampus
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
        return Response({"ok":True,"residents_notifies":n,"message":f"{n} résident(s) notifié(s)"})

    @action(detail=True, methods=["patch"])
    def changer_statut(self, request, pk=None):
        evt = self.get_object()
        statut = request.data.get("statut")
        valid = [s[0] for s in Evenement.STATUT]
        if statut not in valid:
            return Response({"error":f"Statut invalide: {statut}"}, status=400)
        evt.statut = statut
        evt.save(update_fields=["statut"])
        return Response(EvenementSerializer(evt).data)

    @action(detail=False, methods=["get"])
    def agenda(self, request):
        now = datetime.datetime.now()
        qs = Evenement.objects.filter(date_debut__gte=now, statut__in=["planifie","en_cours"]).order_by("date_debut")[:10]
        return Response(EvenementSerializer(qs, many=True).data)


class NotificationViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = NotificationSerializer
    queryset = Notification.objects.none()  # overridden in get_queryset

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
        return Response({"ok":True})

    @action(detail=False, methods=["get"])
    def compteur(self, request):
        count = 0
        alertes_data = []
        prochain = None
        
        # Notification events-based
        if hasattr(request.user, "personnel"):
            count = Notification.objects.filter(
                personnel=request.user.personnel, lu=False
            ).count()
        # System notifications
        try:
            from .models import SimpleNotification
            count += SimpleNotification.objects.filter(user=request.user, lu=False).count()
        except Exception:
            pass
        
        # Active alerts
        alertes = AlerteCampus.objects.filter(active=True).order_by("-date_creation")[:3]
        alertes_data = [{"id":a.id,"message":a.message,"type_alerte":a.type_alerte} for a in alertes]
        
        # Next event
        now = datetime.datetime.now()
        import django.utils.timezone as tz
        try:
            evt = Evenement.objects.filter(
                date_debut__gte=tz.now(), statut__in=["planifie","en_cours"]
            ).order_by("date_debut").first()
            if evt:
                prochain = {"id":evt.id,"titre":evt.titre,"date_debut":evt.date_debut.isoformat(),"lieu":evt.lieu}
        except Exception:
            pass
        
        return Response({"non_lues":count,"alertes":alertes_data,"prochain_evenement":prochain})


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
