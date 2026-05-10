
from rest_framework import viewsets, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from django.utils import timezone
from .models import Incident
from .serializers import IncidentSerializer
import base64

class IncidentViewSet(viewsets.ModelViewSet):
    queryset = Incident.objects.all()
    serializer_class = IncidentSerializer
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    filter_backends = [filters.SearchFilter]
    search_fields = ["titre","residence","bloc"]

    def get_queryset(self):
        qs = Incident.objects.all()
        user = self.request.user
        is_admin = user.is_staff or user.is_superuser
        is_tech = hasattr(user,"profile") and user.profile.role in ("technicien","menage","admin")
        # Non-admin: see only own incidents
        if not is_admin and not is_tech:
            qs = qs.filter(auteur=user)
        statut = self.request.query_params.get("statut")
        priorite = self.request.query_params.get("priorite")
        if statut: qs = qs.filter(statut=statut)
        if priorite: qs = qs.filter(priorite=priorite)
        return qs

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx["request"] = self.request
        return ctx

    def create(self, request, *args, **kwargs):
        data = {}
        # Handle both JSON and FormData
        if hasattr(request.data, "dict"):
            data = request.data.dict()
        else:
            data = dict(request.data)

        # Get base64 photo from JSON body
        photo_b64 = data.get("photo_base64","")
        photo_mime = data.get("photo_mime","image/jpeg")

        # Or from file upload
        photo_file = request.FILES.get("photo")
        if photo_file and not photo_b64:
            photo_b64 = base64.b64encode(photo_file.read()).decode("utf-8")
            photo_mime = photo_file.content_type or "image/jpeg"

        serializer = self.get_serializer(data=data)
        serializer.is_valid(raise_exception=True)
        obj = serializer.save(
            auteur=request.user,
            photo_base64=photo_b64,
            photo_mime=photo_mime,
            latitude=data.get("latitude") or None,
            longitude=data.get("longitude") or None,
        )
        return Response(self.get_serializer(obj).data, status=201)

    def destroy(self, request, *args, **kwargs):
        user = request.user
        is_admin = user.is_staff or user.is_superuser or (hasattr(user,'profile') and user.profile.role=='admin')
        if not is_admin:
            return Response({"error":"Admin uniquement"}, status=403)
        return super().destroy(request, *args, **kwargs)

    @action(detail=True, methods=["post"])
    def resoudre(self, request, pk=None):
        user = request.user
        is_admin = user.is_staff or user.is_superuser
        is_maintenance = hasattr(user,"profile") and user.profile.role in ("technicien","manager")
        if not is_admin and not is_maintenance:
            return Response({"error":"Seule l'équipe maintenance ou l'admin peut clôturer"}, status=403)
        incident = self.get_object()
        incident.statut = "Résolu"
        incident.date_resolution = timezone.now()
        photo_file = request.FILES.get("photo_resolution")
        if photo_file:
            incident.photo_resolution_base64 = base64.b64encode(photo_file.read()).decode("utf-8")
        incident.save()
        return Response({"status":"Résolu","date":str(incident.date_resolution)})

    @action(detail=False, methods=["get"])
    def stats(self, request):
        from django.db.models import Count
        qs = Incident.objects.all()
        return Response({
            "total":qs.count(),
            "ouverts":qs.filter(statut="Ouvert").count(),
            "en_cours":qs.filter(statut="En cours").count(),
            "resolus":qs.filter(statut="Résolu").count(),
            "par_priorite":dict(qs.values_list("priorite").annotate(n=Count("id")).values_list("priorite","n")),
        })
