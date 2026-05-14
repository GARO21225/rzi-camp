
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

        personnel = None
        qr_clean = qr_data.strip()

        # STRATÉGIE 1: Format numérique pur "0001", "0042" (NOUVEAU FORMAT)
        if qr_clean.isdigit():
            try:
                personnel = Personnel.objects.get(pk=int(qr_clean))
            except (Personnel.DoesNotExist, ValueError):
                # Chercher par qr_code_string exact
                personnel = Personnel.objects.filter(qr_code_string=qr_clean).first()

        # STRATÉGIE 2: Format RZI{id} (ancien format)
        if not personnel and qr_clean.upper().startswith("RZI"):
            num_part = qr_clean[3:]
            if num_part.isdigit():
                try:
                    personnel = Personnel.objects.get(pk=int(num_part))
                except Personnel.DoesNotExist:
                    pass

        # STRATÉGIE 3: Correspondance exacte qr_code_string
        if not personnel:
            personnel = Personnel.objects.filter(qr_code_string=qr_clean).first()

        # STRATÉGIE 4: Format NOM|PRENOM|... (très ancien)
        if not personnel and "|" in qr_clean:
            import unicodedata
            def norm(s):
                return "".join(c for c in unicodedata.normalize("NFD", str(s or "").upper()) if unicodedata.category(c) != "Mn")
            parts = [p.strip() for p in qr_clean.split("|")]
            if len(parts) >= 2:
                for p in Personnel.objects.all():
                    if norm(p.nom) == norm(parts[0]) and norm(p.prenom) == norm(parts[1]):
                        personnel = p
                        break

        if not personnel:
            return Response({
                "valid": False,
                "erreur": f"Code non reconnu: [{qr_clean}]"
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
        # Get residence safely
        residence = ""
        try:
            if hasattr(personnel, 'batiments') and personnel.batiments.exists():
                residence = personnel.batiments.first().residence or ""
        except Exception:
            residence = ""
        qr_token = QRToken.objects.create(
            token=token_str, personnel=personnel,
            residence=residence,
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
    def scanner_personnel(self, request):
        """Scanne le QR code du personnel (restaurant_flux) pour historiser les repas"""
        raw = request.data.get("qr_data", "")
        import unicodedata
        qr_data = unicodedata.normalize("NFC", raw).strip()
        type_repas = request.data.get("type_repas", "dejeuner")

        if not qr_data:
            return Response({"valid": False, "erreur": "QR vide"}, status=400)

        from residences.models import Personnel
        from django.utils.timezone import localdate
        today = localdate()

        personnel = None
        qr_clean = qr_data.strip()

        # STRATÉGIE 1: Format numérique pur "0001", "0042"
        if qr_clean.isdigit():
            try:
                personnel = Personnel.objects.get(pk=int(qr_clean))
            except (Personnel.DoesNotExist, ValueError):
                personnel = Personnel.objects.filter(qr_code_string=qr_clean).first()

        # STRATÉGIE 2: Format RZI{id}
        if not personnel and qr_clean.upper().startswith("RZI"):
            num_part = qr_clean[3:]
            if num_part.isdigit():
                try:
                    personnel = Personnel.objects.get(pk=int(num_part))
                except Personnel.DoesNotExist:
                    pass

        # STRATÉGIE 3: Correspondance exacte qr_code_string
        if not personnel:
            personnel = Personnel.objects.filter(qr_code_string=qr_clean).first()

        # STRATÉGIE 4: Format NOM|PRENOM|...
        if not personnel and "|" in qr_clean:
            def norm(s):
                return "".join(c for c in unicodedata.normalize("NFD", str(s or "").upper()) if unicodedata.category(c) != "Mn")
            parts = [p.strip() for p in qr_clean.split("|")]
            if len(parts) >= 2:
                for p in Personnel.objects.all():
                    if norm(p.nom) == norm(parts[0]) and norm(p.prenom) == norm(parts[1]):
                        personnel = p
                        break

        if not personnel:
            return Response({
                "valid": False,
                "erreur": f"Code personnel non reconnu: [{qr_clean}]"
            }, status=400)

        # Vérifier si repas déjà pris aujourd'hui
        already = RepasLog.objects.filter(
            qr_token__personnel=personnel,
            qr_token__type_repas=type_repas,
            cree_le__date=today
        ).exists()
        if already:
            return Response({
                "valid": False,
                "erreur": f"⚠️ {personnel.nom} {personnel.prenom} a déjà pris ce repas aujourd'hui"
            }, status=400)

        # Créer l'entrée d'historique
        from datetime import timedelta
        import secrets
        token_str = secrets.token_hex(8)
        # Get residence safely
        residence = ""
        try:
            if hasattr(personnel, 'batiments') and personnel.batiments.exists():
                residence = personnel.batiments.first().residence or ""
        except Exception:
            residence = ""
        qr_token = QRToken.objects.create(
            token=token_str, personnel=personnel,
            residence=residence,
            resident=f"{personnel.nom} {personnel.prenom}",
            type_repas=type_repas,
            genere_par=request.user,
            expire_le=timezone.now() + timedelta(minutes=1),
            utilise=True, utilise_le=timezone.now()
        )
        repas = RepasLog.objects.create(qr_token=qr_token, valide_par=request.user, personnel=personnel)

        return Response({
            "valid": True,
            "resident": f"{personnel.nom} {personnel.prenom}",
            "residence": qr_token.residence,
            "type_repas": type_repas,
            "type_repas_label": dict(QRToken.REPAS_CHOICES).get(type_repas, type_repas),
            "societe": personnel.societe,
            "type_personnel": personnel.get_type_personnel_display(),
            "date_validation": repas.date_validation.isoformat() if repas.date_validation else None,
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
        residence = ""
        try:
            if hasattr(personnel, 'batiments') and personnel.batiments.exists():
                residence = personnel.batiments.first().residence or ""
        except Exception:
            residence = ""
        qr_token = QRToken.objects.create(
            token=token_str,
            personnel=personnel,
            residence=residence,
            resident=f"{personnel.nom} {personnel.prenom}",
            type_repas=type_repas,
            genere_par=request.user,
            expire_le=timezone.now() + __import__('datetime').timedelta(minutes=1),
            utilise=True,
            utilise_le=timezone.now()
        )
        RepasLog.objects.create(qr_token=qr_token, valide_par=request.user, personnel=personnel)

        return Response({
            "valid":True,
            "resident":f"{personnel.nom} {personnel.prenom}",
            "residence":qr_token.residence,
            "type_repas":type_repas,
            "type_repas_label":dict(QRToken.REPAS_CHOICES).get(type_repas,type_repas),
            "societe":personnel.societe,
        })

    @action(detail=False, methods=["post"])
    def valider_par_numero(self, request):
        """Valide un repas via numéro de téléphone — fallback sans QR"""
        numero = str(request.data.get("numero","")).strip()
        type_repas = request.data.get("type_repas","dejeuner")
        if not numero:
            return Response({"valid":False,"erreur":"Numéro requis"}, status=400)
        from residences.models import Personnel
        from django.utils.timezone import localdate
        import secrets
        # Chercher par numéro exact
        p = Personnel.objects.filter(numero=numero).first()
        if not p:
            digits = ''.join(c for c in numero if c.isdigit())
            if len(digits) >= 6:
                p = Personnel.objects.filter(numero__endswith=digits[-8:]).first()
        if not p:
            return Response({"valid":False,"erreur":f"Aucun personnel avec numéro {numero}"}, status=400)
        today = localdate()
        already = RepasLog.objects.filter(
            qr_token__personnel=p, qr_token__type_repas=type_repas, cree_le__date=today
        ).exists()
        if already:
            return Response({"valid":False,"erreur":f"{p.nom} {p.prenom} a déjà pris ce repas"}, status=400)
        import datetime
        token_str = secrets.token_hex(8)
        residence = ""
        try:
            if hasattr(p, 'batiments') and p.batiments.exists():
                residence = p.batiments.first().residence or ""
        except Exception:
            residence = ""
        qr_token = QRToken.objects.create(
            token=token_str, personnel=p,
            residence=residence,
            resident=f"{p.nom} {p.prenom}", type_repas=type_repas,
            genere_par=request.user,
            expire_le=timezone.now()+datetime.timedelta(minutes=1),
            utilise=True, utilise_le=timezone.now()
        )
        RepasLog.objects.create(qr_token=qr_token, valide_par=request.user, personnel=p)
        return Response({
            "valid":True, "resident":f"{p.nom} {p.prenom}",
            "residence":qr_token.residence, "type_repas":type_repas,
            "type_repas_label":dict(QRToken.REPAS_CHOICES).get(type_repas,type_repas),
            "societe":p.societe,
        })


    @action(detail=False, methods=["delete"])
    def vider_historique(self, request):
        """Vider l'historique des repas (admin seulement)"""
        user = request.user
        is_admin = user.is_staff or user.is_superuser or (hasattr(user,"profile") and user.profile.role=="admin")
        if not is_admin:
            return Response({"error":"Admin uniquement"}, status=403)
        type_repas = request.query_params.get("type_repas")
        qs = RepasLog.objects.all()
        if type_repas:
            qs = qs.filter(qr_token__type_repas=type_repas)
        count = qs.count()
        qs.delete()
        return Response({"ok":True,"deleted":count})

class RepasLogViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = RepasLog.objects.select_related("qr_token","qr_token__personnel","valide_par","personnel").all()
    serializer_class = RepasLogSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        # Admin/resto sees all, others see only own
        is_admin = user.is_staff or user.is_superuser
        is_resto = hasattr(user,"profile") and user.profile.role in ["admin","restauration"]
        # Admins and restaurant role can see all data
        if is_admin or is_resto:
            # Return all, no filtering
            pass
        elif hasattr(user,"personnel"):
            qs = qs.filter(qr_token__personnel=user.personnel)
        else:
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
