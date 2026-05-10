
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
        raw = request.data.get("qr_data","")
        # Normalize: strip whitespace, normalize unicode
        import unicodedata
        qr_data = unicodedata.normalize("NFC", raw).strip()
        type_repas = request.data.get("type_repas","dejeuner")
        
        if not qr_data:
            return Response({"valid":False,"erreur":"QR vide"}, status=400)

        from residences.models import Personnel
        from django.utils.timezone import localdate
        today = localdate()

        import unicodedata
        def ascii_clean(s):
            s = str(s or "").strip()
            return ''.join(c for c in unicodedata.normalize('NFD', s)
                          if unicodedata.category(c) != 'Mn').upper()

        personnel = None

        # Stratégie 1: correspondance exacte
        try:
            personnel = Personnel.objects.get(qr_code_string=qr_data)
        except Personnel.DoesNotExist:
            pass

        # Stratégie 2: correspondance ASCII normalisée (ignore accents et casse)
        if not personnel:
            qr_ascii = ascii_clean(qr_data)
            for p in Personnel.objects.all():
                stored = ascii_clean(p.qr_code_string or "")
                if stored == qr_ascii:
                    personnel = p
                    break

        # Stratégie 3: parser NOM|PRENOM|NUMERO (nouveau format ASCII)
        if not personnel and "|" in qr_data:
            parts = [p.strip() for p in qr_data.split("|")]
            if len(parts) >= 1:
                nom = parts[0]
                # Chercher par nom ASCII
                for p in Personnel.objects.all():
                    if ascii_clean(p.nom) == ascii_clean(nom):
                        # Vérifier prenom si disponible
                        if len(parts) >= 2:
                            if ascii_clean(p.prenom) == ascii_clean(parts[1]):
                                personnel = p; break
                        else:
                            personnel = p; break

        # Stratégie 4: numero de téléphone dans le QR
        if not personnel:
            # Chercher un numéro de 10 chiffres dans le QR
            import re
            nums = re.findall(r'[0-9]{8,}', qr_data)
            for num in nums:
                p = Personnel.objects.filter(numero__icontains=num).first()
                if p: personnel = p; break

        if not personnel:
            return Response({
                "valid": False,
                "erreur": f"QR non reconnu. Code lu: '{qr_data[:80]}'"
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
