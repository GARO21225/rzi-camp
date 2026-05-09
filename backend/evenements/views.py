
from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.utils import timezone
from .models import Evenement, Notification, AlerteCampus
from .serializers import EvenementSerializer, NotificationSerializer, AlerteSerializer
import base64

class EvenementViewSet(viewsets.ModelViewSet):
    queryset = Evenement.objects.all()
    serializer_class = EvenementSerializer
    filter_backends = [filters.SearchFilter]
    search_fields = ["titre","lieu","description"]

    def get_queryset(self):
        qs = Evenement.objects.all()
        type_e = self.request.query_params.get("type_event")
        statut = self.request.query_params.get("statut")
        if type_e: qs = qs.filter(type_event=type_e)
        if statut: qs = qs.filter(statut=statut)
        return qs

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx["request"] = self.request
        return ctx

    def create(self, request, *args, **kwargs):
        data = dict(request.data)
        # Handle image upload
        img_file = request.FILES.get("image")
        if img_file:
            data["image_base64"] = base64.b64encode(img_file.read()).decode()
        serializer = self.get_serializer(data=data)
        serializer.is_valid(raise_exception=True)
        obj = serializer.save()
        # Auto-notify if requested
        if str(data.get("notifier_residents","false")).lower() in ("true","1"):
            nb = obj.notifier_residents()
            return Response({**serializer.data, "residents_notifies":nb}, status=201)
        return Response(serializer.data, status=201)

    @action(detail=True, methods=["post"])
    def notifier(self, request, pk=None):
        evt = self.get_object()
        nb = evt.notifier_residents()
        return Response({"ok":True,"residents_notifies":nb,
                         "message":f"{nb} résident(s) notifié(s) pour '{evt.titre}'"})

    @action(detail=True, methods=["patch"])
    def changer_statut(self, request, pk=None):
        evt = self.get_object()
        new_statut = request.data.get("statut")
        if new_statut not in dict(Evenement.STATUT):
            return Response({"error":"Statut invalide"}, status=400)
        evt.statut = new_statut
        evt.save()
        return Response(EvenementSerializer(evt, context={"request":request}).data)

    @action(detail=False, methods=["get"])
    def agenda(self, request):
        """Prochains événements — 30 jours"""
        from django.utils import timezone
        import datetime
        now = timezone.now()
        qs = Evenement.objects.filter(
            date_debut__gte=now,
            date_debut__lte=now+datetime.timedelta(days=30),
        ).exclude(statut="annule").order_by("date_debut")[:10]
        return Response(EvenementSerializer(qs, many=True, context={"request":request}).data)


class NotificationViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Notification.objects.all()
    serializer_class = NotificationSerializer

    def get_queryset(self):
        user = self.request.user
        qs = Notification.objects.select_related("evenement","personnel").all()
        # Match to user's personnel record
        if hasattr(user, "personnel"):
            qs = qs.filter(personnel=user.personnel)
        elif not (user.is_staff or user.is_superuser):
            qs = qs.none()
        lu = self.request.query_params.get("lu")
        if lu == "false": qs = qs.filter(lu=False)
        if lu == "true": qs = qs.filter(lu=True)
        return qs

    @action(detail=True, methods=["post"])
    def marquer_lu(self, request, pk=None):
        notif = self.get_object()
        notif.lu = True
        notif.date_lecture = timezone.now()
        notif.save()
        return Response({"ok":True})

    @action(detail=False, methods=["post"])
    def tout_lire(self, request):
        qs = self.get_queryset().filter(lu=False)
        qs.update(lu=True, date_lecture=timezone.now())
        return Response({"ok":True})

    @action(detail=False, methods=["get"])
    def compteur(self, request):
        """Polling endpoint — retourne le nombre de notifs non lues + alertes actives"""
        non_lues = self.get_queryset().filter(lu=False).count()
        alertes = AlerteCampus.objects.filter(active=True).values(
            "id","message","type_alerte","date_creation"
        )[:3]
        prochain_evt = Evenement.objects.filter(
            statut="planifie",
            date_debut__gte=timezone.now()
        ).order_by("date_debut").first()
        return Response({
            "non_lues": non_lues,
            "alertes": list(alertes),
            "prochain_evenement": EvenementSerializer(prochain_evt, context={"request":request}).data if prochain_evt else None,
        })


class AlerteViewSet(viewsets.ModelViewSet):
    queryset = AlerteCampus.objects.filter(active=True)
    serializer_class = AlerteSerializer

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx["request"] = self.request
        return ctx

    @action(detail=True, methods=["post"])
    def desactiver(self, request, pk=None):
        alerte = self.get_object()
        alerte.active = False
        alerte.save()
        return Response({"ok":True})
