
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.utils import timezone
from .models import QRToken, RepasLog, AuditLog
from .serializers import QRTokenSerializer, RepasLogSerializer, AuditLogSerializer

class QRTokenViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = QRToken.objects.all()
    serializer_class = QRTokenSerializer

    @action(detail=False, methods=["post"])
    def scanner(self, request):
        qr_data = request.data.get("qr_data","").strip()
        type_repas = request.data.get("type_repas","dejeuner")
        if not qr_data:
            return Response({"valid":False,"erreur":"QR vide"}, status=400)

        from residences.models import Personnel
        from django.utils.timezone import localdate
        today = localdate()

        # Multi-strategy QR lookup
        personnel = None

        # Strategy 1: Exact QR string match
        try:
            personnel = Personnel.objects.get(qr_code_string=qr_data)
        except Personnel.DoesNotExist:
            pass

        # Strategy 2: Parse QR format "NOM|PRENOM|SOCIETE|NUMERO|TYPE"
        if not personnel and '|' in qr_data:
            parts = qr_data.split('|')
            if len(parts) >= 2:
                try:
                    personnel = Personnel.objects.get(
                        nom__iexact=parts[0].strip(),
                        prenom__iexact=parts[1].strip()
                    )
                except Personnel.DoesNotExist:
                    pass

        # Strategy 3: Search by numero in QR
        if not personnel and qr_data.strip().isdigit():
            personnel = Personnel.objects.filter(numero=qr_data.strip()).first()

        # Strategy 4: Search by name in QR (if QR contains full name)
        if not personnel:
            words = qr_data.strip().split()
            if len(words) >= 2:
                personnel = Personnel.objects.filter(
                    nom__iexact=words[0], prenom__iexact=words[1]
                ).first()

        if not personnel:
            return Response({
                "valid":False,
                "erreur":"QR non reconnu — Ce personnel n\'est pas déclaré dans le système"
            }, status=400)

        # Check already eaten
        already = RepasLog.objects.filter(
            qr_token__personnel=personnel,
            qr_token__type_repas=type_repas,
            cree_le__date=today
        ).exists()
        if already:
            return Response({"valid":False,"erreur":f"FRAUDE - {personnel.nom} {personnel.prenom} a déjà pris ce repas aujourd'hui"}, status=400)

        from datetime import timedelta
        import secrets
        token_str = secrets.token_hex(8)
        qr_token = QRToken.objects.create(
            token=token_str, personnel=personnel,
            residence=personnel.batiments.first().residence if personnel.batiments.exists() else "",
            resident=f"{personnel.nom} {personnel.prenom}",
            type_repas=type_repas,
            genere_par=request.user,
            expire_le=timezone.now()+timedelta(minutes=1),
            utilise=True, utilise_le=timezone.now()
        )
        repas = RepasLog.objects.create(qr_token=qr_token, valide_par=request.user)

        return Response({
            "valid":True,
            "resident":f"{personnel.nom} {personnel.prenom}",
            "residence":qr_token.residence,
            "type_repas":type_repas,
            "type_repas_label":dict(QRToken.REPAS_CHOICES).get(type_repas,type_repas),
            "societe":personnel.societe,
            "type_personnel":personnel.get_type_personnel_display(),
        })

    @action(detail=False, methods=["post"])
    def valider_par_personnel(self, request):
        """Valide un repas en sélectionnant directement le personnel (sans QR scan)"""
        personnel_id = request.data.get("personnel_id")
        type_repas = request.data.get("type_repas","dejeuner")
        
        from residences.models import Personnel
        from django.utils.timezone import localdate
        import secrets
        
        try:
            personnel = Personnel.objects.get(pk=personnel_id)
        except Personnel.DoesNotExist:
            return Response({"valid":False,"erreur":"Personnel non trouvé"}, status=400)
        
        today = localdate()
        # Check already eaten
        already = RepasLog.objects.filter(
            qr_token__personnel=personnel,
            qr_token__type_repas=type_repas,
            cree_le__date=today
        ).exists()
        if already:
            return Response({
                "valid":False,
                "erreur":f"{personnel.nom} {personnel.prenom} a déjà pris ce repas aujourd\'hui"
            }, status=400)
        
        # Create validation
        token_str = secrets.token_hex(8)
        qr_token = QRToken.objects.create(
            token=token_str,
            personnel=personnel,
            residence=personnel.batiments.first().residence if personnel.batiments.exists() else "",
            resident=f"{personnel.nom} {personnel.prenom}",
            type_repas=type_repas,
            genere_par=request.user,
            expire_le=timezone.now() + __import__('datetime').timedelta(minutes=1),
            utilise=True,
            utilise_le=timezone.now()
        )
        RepasLog.objects.create(qr_token=qr_token, valide_par=request.user)
        
        return Response({
            "valid":True,
            "resident":f"{personnel.nom} {personnel.prenom}",
            "residence":qr_token.residence,
            "type_repas":type_repas,
            "type_repas_label":dict(QRToken.REPAS_CHOICES).get(type_repas,type_repas),
            "societe":personnel.societe,
        })

class RepasLogViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = RepasLog.objects.select_related("qr_token","qr_token__personnel","valide_par","personnel").all()
    serializer_class = RepasLogSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        # Non-admin/resto : see only own history
        is_admin = user.is_staff or user.is_superuser
        is_resto = hasattr(user,"profile") and user.profile.role == "restauration"
        if not is_admin and not is_resto:
            if hasattr(user,"personnel"):
                qs = qs.filter(qr_token__personnel=user.personnel)
            else:
                # Fallback: filter by name
                name = user.get_full_name().strip()
                if name:
                    qs = qs.filter(qr_token__resident__icontains=name.split()[0])
                else:
                    qs = qs.none()
        # Optional filters
        type_repas = self.request.query_params.get("type_repas")
        date = self.request.query_params.get("date")
        personnel = self.request.query_params.get("personnel")
        if type_repas: qs = qs.filter(qr_token__type_repas=type_repas)
        if date: qs = qs.filter(date_validation__date=date)
        if personnel: qs = qs.filter(personnel_id=personnel)
        return qs


class AuditLogViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = AuditLog.objects.all()
    serializer_class = AuditLogSerializer
