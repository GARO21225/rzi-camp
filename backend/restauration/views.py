from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from django.utils import timezone
from django.db import connection
from .models import QRToken, RepasLog, AuditLog
from .serializers import QRTokenSerializer, RepasLogSerializer, AuditLogSerializer

class QRTokenViewSet(viewsets.ViewSet):
    """ViewSet pour QR Token avec scan POST"""
    permission_classes = [AllowAny]  # Permettre scan sans auth

    @action(detail=False, methods=["post"], permission_classes=[AllowAny])
    def scan(self, request):
        """Scan QR personnel — version ultra-simplifiée sans risque 500"""
        try:
            # 1. Extraire les données
            qr_raw = request.data.get("qr_data", "") or ""
            type_repas = request.data.get("type_repas", "dejeuner") or "dejeuner"

            if not qr_raw or len(qr_raw.strip()) == 0:
                return Response({"valid": False, "erreur": "QR vide"}, status=400)

            qr_clean = str(qr_raw).strip()

            # 2. Chercher le personnel par ID numérique (format: "0001", "0042")
            personnel_id = None
            if qr_clean.isdigit():
                personnel_id = int(qr_clean)

            # 3. Requête SQL directe pour éviter tout problème ORM
            with connection.cursor() as cursor:
                if personnel_id:
                    # Chercher par ID exact
                    cursor.execute(
                        "SELECT id, nom, prenom, societe, type_personnel FROM residences_personnel WHERE id = %s AND actif = true",
                        [personnel_id]
                    )
                else:
                    # Chercher par qr_code_string
                    cursor.execute(
                        "SELECT id, nom, prenom, societe, type_personnel FROM residences_personnel WHERE qr_code_string = %s AND actif = true",
                        [qr_clean]
                    )

                row = cursor.fetchone()

            if not row:
                return Response({
                    "valid": False,
                    "erreur": f"Personnel non trouvé: [{qr_clean}]"
                }, status=400)

            pers_id, nom, prenom, societe, type_pers = row

            # 4. Vérifier si repas déjà pris aujourd'hui (SQL direct)
            from datetime import date
            today = date.today()

            with connection.cursor() as cursor:
                cursor.execute("""
                    SELECT COUNT(*) FROM restauration_repaslog r
                    JOIN restauration_qrtoken q ON r.qr_token_id = q.id
                    WHERE q.personnel_id = %s AND q.type_repas = %s AND DATE(r.date_validation) = %s
                """, [pers_id, type_repas, today])
                count = cursor.fetchone()[0]

            if count > 0:
                return Response({
                    "valid": False,
                    "erreur": f"{nom} {prenom} a déjà pris ce repas aujourd'hui"
                }, status=400)

            # 5. Créer le token et le log via Django ORM (compatible SQLite + PostgreSQL)
            from .models import QRToken, RepasLog
            from residences.models import Personnel as P

            now = timezone.now()
            valide_par = request.user if request.user and request.user.is_authenticated else None
            pers_obj   = P.objects.filter(pk=pers_id).first()

            # Créer QRToken
            import uuid as _uuid
            qt = QRToken.objects.create(
                token      = _uuid.uuid4().hex,
                personnel  = pers_obj,
                resident   = f"{nom} {prenom}",
                residence  = "",
                type_repas = type_repas,
                genere_par = valide_par,
                cree_le    = now,
                expire_le  = now,
                utilise    = True,
                utilise_le = now,
            )

            # Créer RepasLog
            RepasLog.objects.create(
                qr_token     = qt,
                personnel    = pers_obj,
                valide_par   = valide_par,
                date_validation = now,
            )

            return Response({
                "valid": True,
                "resident": f"{nom} {prenom}",
                "residence": "",
                "type_repas": type_repas,
                "societe": societe or "",
                "type_personnel": type_pers or "Agent",
            })

        except Exception as e:
            return Response({
                "valid": False,
                "erreur": f"Erreur serveur: {str(e)[:100]}"
            }, status=400)

    @action(detail=False, methods=["post"], permission_classes=[AllowAny])
    def scanner_personnel(self, request):
        """Alias de scan pour compatibilité"""
        return self.scan(request)

    @action(detail=False, methods=["post"], permission_classes=[AllowAny])
    def valider_par_personnel(self, request):
        """Valide un repas via ID personnel direct"""
        try:
            personnel_id = request.data.get("personnel_id")
            type_repas = request.data.get("type_repas", "dejeuner") or "dejeuner"

            if not personnel_id:
                return Response({"valid": False, "erreur": "ID requis"}, status=400)

            # Chercher le personnel
            with connection.cursor() as cursor:
                cursor.execute(
                    "SELECT id, nom, prenom, societe, type_personnel FROM residences_personnel WHERE id = %s AND actif = true",
                    [int(personnel_id)]
                )
                row = cursor.fetchone()

            if not row:
                return Response({"valid": False, "erreur": "Personnel non trouvé"}, status=400)

            pers_id, nom, prenom, societe, type_pers = row

            # Vérifier repas déjà pris
            from datetime import date
            today = date.today()

            with connection.cursor() as cursor:
                cursor.execute("""
                    SELECT COUNT(*) FROM restauration_repaslog r
                    JOIN restauration_qrtoken q ON r.qr_token_id = q.id
                    WHERE q.personnel_id = %s AND q.type_repas = %s AND DATE(r.date_validation) = %s
                """, [pers_id, type_repas, today])
                count = cursor.fetchone()[0]

            if count > 0:
                return Response({
                    "valid": False,
                    "erreur": f"{nom} {prenom} a déjà pris ce repas aujourd'hui"
                }, status=400)

            # Créer QRToken + RepasLog via ORM (compatible SQLite ET PostgreSQL)
            import uuid
            from .models import QRToken as QT, RepasLog as RL
            from residences.models import Personnel as P

            now       = timezone.now()
            pers_obj  = P.objects.filter(pk=pers_id).first()
            valide_by = request.user if request.user and request.user.is_authenticated else None

            qt = QT.objects.create(
                token      = str(uuid.uuid4()).replace("-",""),
                personnel  = pers_obj,
                resident   = f"{nom} {prenom}",
                residence  = "",
                type_repas = type_repas,
                genere_par = valide_by,
                cree_le    = now,
                expire_le  = now,
                utilise    = True,
                utilise_le = now,
            )
            RL.objects.create(
                qr_token        = qt,
                personnel       = pers_obj,
                valide_par      = valide_by,
                date_validation = now,
            )

            return Response({
                "valid":    True,
                "resident": f"{nom} {prenom}",
                "societe":  societe or "",
                "type_repas": type_repas,
            })

        except Exception as e:
            return Response({
                "valid": False,
                "erreur": f"Erreur: {str(e)[:100]}"
            }, status=400)

    @action(detail=False, methods=["delete"])
    def vider_historique(self, request):
        """Vider l'historique (admin seulement)"""
        user = request.user
        is_admin = user.is_staff or user.is_superuser or (hasattr(user, "profile") and user.profile.role == "admin")
        if not is_admin:
            return Response({"error": "Admin requis"}, status=403)

        type_repas = request.query_params.get("type_repas")

        with connection.cursor() as cursor:
            if type_repas:
                cursor.execute("""
                    DELETE FROM restauration_repaslog
                    WHERE qr_token_id IN (SELECT id FROM restauration_qrtoken WHERE type_repas = %s)
                """, [type_repas])
            else:
                cursor.execute("DELETE FROM restauration_repaslog")

        return Response({"ok": True})


class RepasLogViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = RepasLog.objects.select_related("qr_token", "qr_token__personnel", "valide_par", "personnel").all()
    serializer_class = RepasLogSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        is_admin = user.is_staff or user.is_superuser
        is_resto = hasattr(user, "profile") and user.profile.role in ["admin", "restauration"]

        if is_admin or is_resto:
            pass  # Voir tout
        elif hasattr(user, "personnel"):
            qs = qs.filter(qr_token__personnel=user.personnel)
        else:
            name = user.get_full_name().strip()
            if name:
                qs = qs.filter(qr_token__resident__icontains=name.split()[0])
            else:
                qs = qs.none()

        type_repas = self.request.query_params.get("type_repas")
        if type_repas:
            qs = qs.filter(qr_token__type_repas=type_repas)

        return qs


class AuditLogViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = AuditLog.objects.all()
    serializer_class = AuditLogSerializer

# ── Bar & Boutique ──────────────────────────────────────────────────
from .models import ArticleBoutique, ConsommationBoutique
from rest_framework import serializers as drf_serializers

class ArticleSerializer(drf_serializers.ModelSerializer):
    categorie_label = drf_serializers.CharField(source='get_categorie_display', read_only=True)
    class Meta:
        model = ArticleBoutique
        fields = '__all__'

class ConsommationSerializer(drf_serializers.ModelSerializer):
    article_nom    = drf_serializers.CharField(source='article.nom', read_only=True)
    article_prix   = drf_serializers.CharField(source='article.prix', read_only=True)
    personnel_nom  = drf_serializers.SerializerMethodField()
    valide_par_nom = drf_serializers.CharField(source='valide_par.username', read_only=True, default='—')

    def get_personnel_nom(self, obj):
        if obj.personnel: return f"{obj.personnel.nom} {obj.personnel.prenom}"
        return "—"

    class Meta:
        model = ConsommationBoutique
        fields = '__all__'

class ArticleBoutiqueViewSet(viewsets.ModelViewSet):
    queryset = ArticleBoutique.objects.order_by('categorie','nom')
    serializer_class = ArticleSerializer

    @action(detail=False, methods=['get'])
    def stats(self, request):
        from django.utils import timezone
        from django.db.models import Sum
        today = timezone.now().date()
        qs = ConsommationBoutique.objects.filter(date_conso__date=today)
        return Response({
            'total': qs.count(),
            'montant_total': float(qs.aggregate(t=Sum('montant'))['t'] or 0),
        })

class ConsommationBoutiqueViewSet(viewsets.ModelViewSet):
    queryset = ConsommationBoutique.objects.select_related('personnel','article','valide_par').order_by('-date_conso')
    serializer_class = ConsommationSerializer
    filter_backends = [filters.SearchFilter]
    search_fields = ['article__nom','personnel__nom']

    def perform_create(self, serializer):
        serializer.save(valide_par=self.request.user)

    @action(detail=False, methods=['get'])
    def stats_jour(self, request):
        from django.utils import timezone
        from django.db.models import Sum
        today = timezone.now().date()
        qs = self.get_queryset().filter(date_conso__date=today)
        par_art = qs.values('article__nom','article__categorie').annotate(
            qte=Sum('quantite'), total=Sum('montant')
        ).order_by('-total')
        return Response({
            'date': str(today),
            'total': qs.count(),
            'montant': float(qs.aggregate(t=Sum('montant'))['t'] or 0),
            'par_article': list(par_art)[:10],
        })
