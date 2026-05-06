from rest_framework import viewsets, status
from rest_framework.decorators import api_view, permission_classes, action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.utils import timezone
from datetime import timedelta
from .models import QRToken, RepasLog, AuditLog
from .serializers import QRTokenSerializer, RepasLogSerializer, AuditLogSerializer
import secrets, hashlib

class QRTokenViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = QRToken.objects.all()
    serializer_class = QRTokenSerializer

    @action(detail=False, methods=['post'])
    def generer(self, request):
        residence = request.data.get('residence', '')
        resident = request.data.get('resident', '')
        duree = int(request.data.get('duree', 45))
        raw = secrets.token_hex(12)
        key = b'rzi-camp-hmac-secret-2026'
        sig = hashlib.new('sha256', (raw + key.decode()).encode()).hexdigest()[:12]
        token_str = f"{raw[:8]}-{sig}"
        expire = timezone.now() + timedelta(seconds=duree)
        qr = QRToken.objects.create(
            token=token_str, residence=residence, resident=resident,
            genere_par=request.user, expire_le=expire
        )
        AuditLog.objects.create(utilisateur=request.user, action='QR_GENERE',
            module='Restauration', detail=f'Token pour {resident} ({residence})',
            ip=request.META.get('REMOTE_ADDR'))
        return Response(QRTokenSerializer(qr).data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['post'])
    def scanner(self, request):
        token_str = request.data.get('token', '')
        device_id = request.data.get('device_id', '')
        now = timezone.now()
        try:
            qr = QRToken.objects.get(token=token_str)
        except QRToken.DoesNotExist:
            AuditLog.objects.create(utilisateur=request.user, action='QR_INVALIDE',
                module='Restauration', detail=f'Token inconnu: {token_str[:8]}',
                ip=request.META.get('REMOTE_ADDR'))
            return Response({'valid': False, 'erreur': 'Token invalide'}, status=400)
        if qr.expire_le < now:
            return Response({'valid': False, 'erreur': 'Token expiré'}, status=400)
        if qr.utilise:
            AuditLog.objects.create(utilisateur=request.user, action='QR_FRAUDE',
                module='Restauration', detail=f'Double scan — {qr.resident} ({qr.residence})',
                ip=request.META.get('REMOTE_ADDR'))
            return Response({'valid': False, 'erreur': '🚨 FRAUDE — Double scan détecté'}, status=400)
        qr.utilise = True
        qr.utilise_le = now
        qr.device_id = device_id
        qr.save()
        RepasLog.objects.create(qr_token=qr, valide_par=request.user)
        AuditLog.objects.create(utilisateur=request.user, action='QR_VALIDE',
            module='Restauration', detail=f'Repas validé — {qr.resident} ({qr.residence})',
            ip=request.META.get('REMOTE_ADDR'))
        return Response({'valid': True, 'resident': qr.resident, 'residence': qr.residence})

class RepasLogViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = RepasLog.objects.select_related('qr_token').all()
    serializer_class = RepasLogSerializer

class AuditLogViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = AuditLog.objects.all()
    serializer_class = AuditLogSerializer
