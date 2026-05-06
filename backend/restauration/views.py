
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils import timezone
from datetime import timedelta
from .models import QRToken, RepasLog, AuditLog
from .serializers import QRTokenSerializer, RepasLogSerializer, AuditLogSerializer
import secrets, hashlib, qrcode, io, base64

class QRTokenViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = QRToken.objects.all()
    serializer_class = QRTokenSerializer

    @action(detail=False, methods=["post"])
    def generer(self, request):
        personnel_id = request.data.get("personnel_id")
        residence = request.data.get("residence","")
        resident = request.data.get("resident","")
        type_repas = request.data.get("type_repas","dejeuner")
        duree = int(request.data.get("duree",300))  # 5 minutes

        from residences.models import Personnel
        personnel = None
        if personnel_id:
            try:
                personnel = Personnel.objects.get(id=personnel_id)
                resident = f"{personnel.nom} {personnel.prenom}"
            except: pass

        # Verifier pas deja mange ce repas aujourd hui
        from django.utils.timezone import localdate
        today = localdate()
        already = RepasLog.objects.filter(
            qr_token__personnel=personnel,
            qr_token__type_repas=type_repas,
            date_validation__date=today
        ).exists() if personnel else False
        if already:
            return Response({"error":f"Ce personnel a deja pris son {type_repas} aujourd'hui"}, status=400)

        # Generer token HMAC
        raw = secrets.token_hex(12)
        sig = hashlib.sha256((raw+"rzi-camp-2026").encode()).hexdigest()[:12]
        token_str = f"{raw[:8]}-{sig}"
        expire = timezone.now() + timedelta(seconds=duree)

        qr_obj = QRToken.objects.create(
            token=token_str, personnel=personnel, residence=residence,
            resident=resident, type_repas=type_repas,
            genere_par=request.user, expire_le=expire
        )

        # Generer image QR
        qr = qrcode.QRCode(version=1, box_size=10, border=2)
        qr.add_data(token_str)
        qr.make(fit=True)
        img = qr.make_image(fill_color="black", back_color="white")
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        qr_b64 = base64.b64encode(buf.getvalue()).decode()

        AuditLog.objects.create(utilisateur=request.user, action="QR_GENERE",
            module="Restauration", detail=f"{type_repas} pour {resident} ({residence})",
            ip=request.META.get("REMOTE_ADDR"))

        data = QRTokenSerializer(qr_obj).data
        data["qr_image"] = qr_b64
        return Response(data, status=201)

    @action(detail=False, methods=["post"])
    def scanner(self, request):
        token_str = request.data.get("token","")
        device_id = request.data.get("device_id","")
        now = timezone.now()
        try:
            qr = QRToken.objects.get(token=token_str)
        except QRToken.DoesNotExist:
            AuditLog.objects.create(utilisateur=request.user, action="QR_INVALIDE",
                module="Restauration", detail=f"Token inconnu: {token_str[:8]}",
                ip=request.META.get("REMOTE_ADDR"))
            return Response({"valid":False,"erreur":"Token invalide"}, status=400)

        if qr.expire_le < now:
            return Response({"valid":False,"erreur":"Token expire"}, status=400)
        if qr.utilise:
            AuditLog.objects.create(utilisateur=request.user, action="QR_FRAUDE",
                module="Restauration", detail=f"Double scan - {qr.resident}",
                ip=request.META.get("REMOTE_ADDR"))
            return Response({"valid":False,"erreur":"FRAUDE - Double scan detecte"}, status=400)

        qr.utilise = True
        qr.utilise_le = now
        qr.device_id = device_id
        qr.save()
        RepasLog.objects.create(qr_token=qr, personnel=qr.personnel, valide_par=request.user)
        AuditLog.objects.create(utilisateur=request.user, action="QR_VALIDE",
            module="Restauration", detail=f"Repas valide - {qr.resident} ({qr.type_repas})",
            ip=request.META.get("REMOTE_ADDR"))

        return Response({
            "valid":True,"resident":qr.resident,"residence":qr.residence,
            "type_repas":qr.get_type_repas_display(),
            "personnel_id":qr.personnel_id
        })


class RepasLogViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = RepasLog.objects.select_related("qr_token","qr_token__personnel","valide_par").all()
    serializer_class = RepasLogSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        personnel = self.request.query_params.get("personnel")
        type_repas = self.request.query_params.get("type_repas")
        date = self.request.query_params.get("date")
        if personnel: qs = qs.filter(qr_token__personnel_id=personnel)
        if type_repas: qs = qs.filter(qr_token__type_repas=type_repas)
        if date: qs = qs.filter(date_validation__date=date)
        return qs


class AuditLogViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = AuditLog.objects.all()
    serializer_class = AuditLogSerializer
