from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters, viewsets
from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework import serializers as drf_serializers
from django.utils import timezone
from django.db import connection
from .models import MenuJour, QRToken, RepasLog, AuditLog, ArticleBoutique, ConsommationBoutique, BonCaisse
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
            from .models import MenuJour, QRToken, RepasLog, AuditLog, ArticleBoutique, ConsommationBoutique, BonCaisse
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
            from .models import MenuJour, QRToken, RepasLog, AuditLog, ArticleBoutique, ConsommationBoutique, BonCaisse
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
from .models import MenuJour, QRToken, RepasLog, AuditLog, ArticleBoutique, ConsommationBoutique, BonCaisse

class ArticleSerializer(drf_serializers.ModelSerializer):
    """Sérialiseur robuste — image_url accepte URL ou base64 data URI"""

    class Meta:
        model  = ArticleBoutique
        fields = ['id','nom','categorie','prix','stock','unite','actif','image_url','cree_le']
        extra_kwargs = {'image_url': {'required': False, 'default': '', 'allow_blank': True}}

    def to_representation(self, obj):
        data = super().to_representation(obj)
        # Protection si la colonne n'existe pas encore en DB
        try:
            data['image_url'] = obj.image_url or ''
        except Exception:
            data['image_url'] = ''
        return data

    def create(self, validated_data):
        img = validated_data.pop('image_url', '') or ''
        try:
            obj = ArticleBoutique.objects.create(**validated_data)
            if img:
                try:
                    obj.image_url = img
                    obj.save(update_fields=['image_url'])
                except Exception:
                    pass
        except Exception as e:
            if 'image_url' in str(e):
                # Colonne absente → créer sans image
                obj = ArticleBoutique.objects.create(**validated_data)
            else:
                raise
        return obj

    def update(self, instance, validated_data):
        img = validated_data.pop('image_url', None)
        for attr, val in validated_data.items():
            setattr(instance, attr, val)
        instance.save()
        if img is not None:
            try:
                instance.image_url = img
                instance.save(update_fields=['image_url'])
            except Exception:
                pass
        return instance

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

    @action(detail=True, methods=['post'])
    def stock_update(self, request, pk=None):
        """Modifier le stock d'un article."""
        article = self.get_object()
        operation = request.data.get('operation', 'set')  # set | add | subtract
        quantite = int(request.data.get('quantite', 0))
        raison = request.data.get('raison', '')
        
        stock_avant = article.stock
        if operation == 'set':
            article.stock = quantite
        elif operation == 'add':
            article.stock += quantite
        elif operation == 'subtract':
            article.stock = max(0, article.stock - quantite)
        article.save(update_fields=['stock'])
        
        return Response({
            'ok': True,
            'article': article.nom,
            'stock_avant': stock_avant,
            'stock_apres': article.stock,
            'operation': operation,
            'quantite': quantite,
        })
    
    @action(detail=False, methods=['get'])
    def alertes_stock(self, request):
        """Articles dont le stock est bas (< 20)."""
        seuil = int(request.query_params.get('seuil', 20))
        articles = ArticleBoutique.objects.filter(stock__lte=seuil, actif=True)
        return Response(ArticleSerializer(articles, many=True).data)

class ConsommationBoutiqueViewSet(viewsets.ModelViewSet):
    queryset = ConsommationBoutique.objects.select_related('personnel','article','valide_par').order_by('-date_conso')
    serializer_class = ConsommationSerializer
    filter_backends = [filters.SearchFilter]
    search_fields = ['article__nom','personnel__nom']
    permission_classes = [AllowAny]

    def perform_create(self, serializer):
        valide_par = self.request.user if self.request.user and self.request.user.is_authenticated else None
        serializer.save(valide_par=valide_par)

    def create(self, request, *args, **kwargs):
        from django.db import connection
        from django.utils import timezone as tz
        from rest_framework.response import Response
        from rest_framework import status as st
        data = request.data
        article_id   = data.get('article')
        personnel_id = data.get('personnel')
        quantite     = int(data.get('quantite', 1))
        mode         = data.get('mode_paiement', 'especes')
        valide_id    = request.user.id if request.user and request.user.is_authenticated else None
        try:
            with connection.cursor() as c:
                c.execute('SELECT prix FROM restauration_articleboutique WHERE id=%s', [article_id])
                row = c.fetchone()
                if not row:
                    return Response({'detail': 'Article introuvable'}, status=404)
                montant = row[0] * quantite
                c.execute("SELECT EXISTS(SELECT FROM information_schema.columns WHERE table_name='restauration_consommationboutique' AND column_name='mode_paiement')")
                has_mode = c.fetchone()[0]
                if has_mode:
                    c.execute("INSERT INTO restauration_consommationboutique (article_id,personnel_id,quantite,montant,mode_paiement,notes,valide_par_id,date_conso) VALUES (%s,%s,%s,%s,%s,'', %s,NOW()) RETURNING id",
                              [article_id, personnel_id, quantite, montant, mode, valide_id])
                else:
                    c.execute("INSERT INTO restauration_consommationboutique (article_id,personnel_id,quantite,montant,notes,valide_par_id,date_conso) VALUES (%s,%s,%s,%s,'', %s,NOW()) RETURNING id",
                              [article_id, personnel_id, quantite, montant, valide_id])
                conso_id = c.fetchone()[0]
                if mode == 'bon' and personnel_id:
                    try:
                        c.execute("UPDATE restauration_boncaisse SET credit_utilise=credit_utilise+%s WHERE personnel_id=%s AND annee=%s",
                                  [montant, personnel_id, tz.now().year])
                    except Exception:
                        pass
            return Response({'id': conso_id, 'montant': float(montant), 'mode_paiement': mode}, status=st.HTTP_201_CREATED)
        except Exception as e:
            return Response({'detail': str(e)}, status=500)

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

    @action(detail=False, methods=['get'], url_path='analyses')
    def analyses(self, request):
        from django.db.models import Sum, Count, DecimalField, ExpressionWrapper, F
        from django.db.models.functions import TruncDate
        from django.utils import timezone
        import datetime

        periode = request.query_params.get('periode', '30j')
        now = timezone.now()
        delta = {'7j':7,'30j':30,'90j':90}.get(periode, 30)
        debut = now - datetime.timedelta(days=delta) if periode != 'annee' else now.replace(month=1,day=1,hour=0,minute=0,second=0)

        montant = ExpressionWrapper(F('quantite')*F('article__prix'), output_field=DecimalField())
        consos  = ConsommationBoutique.objects.filter(date_conso__gte=debut)

        def qs(q):
            try: return list(q)
            except: return []

        top_art = qs(consos.values('article__nom','article__categorie')
            .annotate(qte=Sum('quantite'),ca=Sum(montant)).order_by('-ca')[:15])
        top_art = [{'article__nom':a['article__nom'],'article__categorie':a['article__categorie'],
                    'qte':int(a['qte'] or 0),'ca':int(a['ca'] or 0)} for a in top_art]

        top_ag = qs(consos.filter(personnel__isnull=False)
            .values('personnel__nom','personnel__prenom','personnel__societe')
            .annotate(qte=Sum('quantite'),ca=Sum(montant)).order_by('-ca')[:10])
        top_ag = [{'personnel__nom':a['personnel__nom'],'personnel__prenom':a['personnel__prenom'],
                   'personnel__societe':a['personnel__societe'],'qte':int(a['qte'] or 0),'ca':int(a['ca'] or 0)} for a in top_ag]

        par_cat = qs(consos.values('article__categorie')
            .annotate(qte=Sum('quantite'),ca=Sum(montant)).order_by('-ca'))
        par_cat = [{'article__categorie':c['article__categorie'],'qte':int(c['qte'] or 0),'ca':int(c['ca'] or 0)} for c in par_cat]

        evo = qs(ConsommationBoutique.objects.filter(date_conso__gte=now-datetime.timedelta(days=30))
            .annotate(jour=TruncDate('date_conso')).values('jour')
            .annotate(ca=Sum(montant),nb=Count('id')).order_by('jour'))
        evo = [{'jour':str(e['jour']),'ca':int(e['ca'] or 0),'nb':e['nb']} for e in evo]

        try: total_ca = int(consos.aggregate(s=Sum(montant))['s'] or 0)
        except: total_ca = 0
        total_qte = int(consos.aggregate(s=Sum('quantite'))['s'] or 0)

        return Response({'periode':periode,'total_ca':total_ca,'total_qte':total_qte,
            'nb_transactions':consos.count(),'top_articles':top_art,'top_agents':top_ag,
            'par_categorie':par_cat,'evolution':evo})



# ═══════════════════════════════════════════════════════
# BONS DE CAISSE — Tickets annuels 100K FCFA
# ═══════════════════════════════════════════════════════

class BonCaisseSerializer(drf_serializers.ModelSerializer):
    personnel_nom  = drf_serializers.SerializerMethodField()
    personnel_info = drf_serializers.SerializerMethodField()
    credit_utilise = drf_serializers.SerializerMethodField()
    pourcentage    = drf_serializers.SerializerMethodField()

    def get_personnel_nom(self, obj):
        return f"{obj.personnel.nom} {obj.personnel.prenom}"

    def get_personnel_info(self, obj):
        return {'id':obj.personnel.id,'nom':obj.personnel.nom,
                'prenom':obj.personnel.prenom,'societe':obj.personnel.societe}

    def get_credit_utilise(self, obj):
        return int(obj.credit_initial - obj.credit_restant)

    def get_pourcentage(self, obj):
        if obj.credit_initial == 0: return 0
        return int(((obj.credit_initial - obj.credit_restant) / obj.credit_initial) * 100)

    class Meta:
        model  = BonCaisse
        fields = ['id','personnel','personnel_nom','personnel_info',
                  'annee','credit_initial','credit_restant','credit_utilise',
                  'pourcentage','cree_le','mis_a_jour']
        read_only_fields = ['credit_restant','cree_le','mis_a_jour']


class BonCaisseViewSet(viewsets.ModelViewSet):
    serializer_class   = BonCaisseSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        from django.utils import timezone
        annee = self.request.query_params.get('annee', timezone.now().year)
        qs    = BonCaisse.objects.filter(annee=annee).select_related('personnel').order_by('personnel__nom')
        pid   = self.request.query_params.get('personnel')
        if pid:
            qs = qs.filter(personnel_id=pid)
        return qs

    @action(detail=False, methods=['post'])
    def crediter(self, request):
        """Créditer ou créer le bon d'un personnel"""
        from django.utils import timezone
        from residences.models import Personnel
        pid     = request.data.get('personnel_id')
        montant = int(request.data.get('montant', 100000))
        annee   = int(request.data.get('annee', timezone.now().year))

        if not pid:
            return Response({'error':'personnel_id requis'}, status=400)
        if not (1000 <= montant <= 500000):
            return Response({'error':'Montant invalide (1 000 – 500 000 FCFA)'}, status=400)

        try:
            p = Personnel.objects.get(id=pid)
        except Personnel.DoesNotExist:
            return Response({'error':'Personnel introuvable'}, status=404)

        bon, created = BonCaisse.objects.get_or_create(
            personnel=p, annee=annee,
            defaults={'credit_initial':montant, 'credit_restant':montant}
        )
        if not created:
            # Reset complet du crédit
            bon.credit_initial = montant
            bon.credit_restant = montant
            bon.save(update_fields=['credit_initial','credit_restant','mis_a_jour'])

        return Response({
            'ok':      True,
            'message': f"Bon {'créé' if created else 'rechargé'} — {montant:,} FCFA pour {p.nom} {p.prenom}",
            'bon':     BonCaisseSerializer(bon).data,
            'created': created,
        })

    @action(detail=False, methods=['post'], url_path='crediter_tous')
    def crediter_tous(self, request):
        """Créditer TOUS les personnels actifs"""
        from django.utils import timezone
        from residences.models import Personnel
        montant = int(request.data.get('montant', 100000))
        annee   = int(request.data.get('annee', timezone.now().year))

        actifs = Personnel.objects.filter(actif=True, type_personnel='roxgold')
        created_n = updated_n = 0
        for p in actifs:
            bon, created = BonCaisse.objects.get_or_create(
                personnel=p, annee=annee,
                defaults={'credit_initial':montant,'credit_restant':montant}
            )
            if not created:
                bon.credit_initial = montant
                bon.credit_restant = montant
                bon.save(update_fields=['credit_initial','credit_restant','mis_a_jour'])
                updated_n += 1
            else:
                created_n += 1

        return Response({'ok':True,
            'message':f"{created_n} bons créés, {updated_n} rechargés — {montant:,} FCFA/an",
            'annee':annee, 'total':actifs.count()})

    @action(detail=False, methods=['get'], url_path='solde_personnel')
    def solde_personnel(self, request):
        """Solde du bon d'un personnel pour l'année"""
        from django.utils import timezone
        from residences.models import Personnel
        pid   = request.query_params.get('personnel_id')
        annee = int(request.query_params.get('annee', timezone.now().year))
        if not pid:
            return Response({'error':'personnel_id requis'}, status=400)
        try:
            p   = Personnel.objects.get(id=pid)
            bon, _ = BonCaisse.objects.get_or_create(
                personnel=p, annee=annee,
                defaults={'credit_initial':100000,'credit_restant':100000}
            )
            return Response(BonCaisseSerializer(bon).data)
        except Personnel.DoesNotExist:
            return Response({'error':'Personnel introuvable'}, status=404)

    @action(detail=False, methods=['get'], url_path='stats_consommation')
    def stats_consommation(self, request):
        """Stats globales consommation boutique"""
        from django.utils import timezone
        from django.db.models import Sum, Count, Avg
        annee = int(request.query_params.get('annee', timezone.now().year))
        bons  = BonCaisse.objects.filter(annee=annee)
        total_credits  = bons.aggregate(s=Sum('credit_initial'))['s'] or 0
        total_restants = bons.aggregate(s=Sum('credit_restant'))['s'] or 0
        total_utilise  = total_credits - total_restants
        return Response({
            'annee':         annee,
            'nb_bons':       bons.count(),
            'total_credits': int(total_credits),
            'total_utilise': int(total_utilise),
            'total_restant': int(total_restants),
            'taux_utilisation': round(total_utilise/total_credits*100,1) if total_credits else 0,
        })


class BonCaisseSerializer(drf_serializers.ModelSerializer):
    personnel_nom  = drf_serializers.SerializerMethodField()
    personnel_info = drf_serializers.SerializerMethodField()
    credit_utilise = drf_serializers.ReadOnlyField()
    pourcentage    = drf_serializers.ReadOnlyField(source='pourcentage_utilise')

    def get_personnel_nom(self, obj):
        return f"{obj.personnel.nom} {obj.personnel.prenom}"

    def get_personnel_info(self, obj):
        return {
            'id':      obj.personnel.id,
            'nom':     obj.personnel.nom,
            'prenom':  obj.personnel.prenom,
            'societe': obj.personnel.societe,
            'numero':  obj.personnel.numero,
        }

    class Meta:
        model  = BonCaisse
        fields = ['id','personnel','personnel_nom','personnel_info',
                  'annee','credit_initial','credit_restant','credit_utilise',
                  'pourcentage','cree_le','mis_a_jour']
        read_only_fields = ['credit_restant','cree_le','mis_a_jour']


class BonCaisseViewSet(viewsets.ModelViewSet):
    serializer_class   = BonCaisseSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        from django.utils import timezone
        annee = self.request.query_params.get('annee', timezone.now().year)
        qs = BonCaisse.objects.filter(annee=annee).select_related('personnel')
        # Filtrer par personnel si demandé
        personnel_id = self.request.query_params.get('personnel')
        if personnel_id:
            qs = qs.filter(personnel_id=personnel_id)
        return qs

    @action(detail=False, methods=['post'], url_path='crediter')
    def crediter(self, request):
        """Créditer/créer le bon d'un personnel pour l'année courante"""
        from django.utils import timezone
        personnel_id = request.data.get('personnel_id')
        montant      = int(request.data.get('montant', 100000))
        annee        = int(request.data.get('annee', timezone.now().year))

        if not personnel_id:
            return Response({'error': 'personnel_id requis'}, status=400)
        if montant <= 0 or montant > 500000:
            return Response({'error': 'Montant invalide (1 – 500 000 FCFA)'}, status=400)

        from residences.models import Personnel
        try:
            p = Personnel.objects.get(id=personnel_id)
        except Personnel.DoesNotExist:
            return Response({'error': 'Personnel introuvable'}, status=404)

        bon, created = BonCaisse.objects.get_or_create(
            personnel=p, annee=annee,
            defaults={'credit_initial': montant, 'credit_restant': montant}
        )
        if not created:
            # Mise à jour du crédit initial uniquement
            bon.credit_initial = montant
            bon.credit_restant = min(bon.credit_restant, montant)
            bon.save(update_fields=['credit_initial','credit_restant','mis_a_jour'])

        return Response({
            'ok': True,
            'message': f"Bon {'créé' if created else 'mis à jour'} — {montant:,} FCFA pour {p.nom} {p.prenom}",
            'bon': BonCaisseSerializer(bon).data
        })

    @action(detail=False, methods=['post'], url_path='crediter_tous')
    def crediter_tous(self, request):
        """Créditer TOUS les personnels actifs — début d'année"""
        from django.utils import timezone
        from residences.models import Personnel
        montant = int(request.data.get('montant', 100000))
        annee   = int(request.data.get('annee', timezone.now().year))

        actifs  = Personnel.objects.filter(actif=True)
        created_count = 0
        updated_count = 0
        for p in actifs:
            bon, created = BonCaisse.objects.get_or_create(
                personnel=p, annee=annee,
                defaults={'credit_initial': montant, 'credit_restant': montant}
            )
            if not created:
                bon.credit_initial = montant
                bon.credit_restant = montant  # reset complet
                bon.save(update_fields=['credit_initial','credit_restant','mis_a_jour'])
                updated_count += 1
            else:
                created_count += 1

        return Response({
            'ok':     True,
            'message': f"{created_count} bons créés, {updated_count} réinitialisés — {montant:,} FCFA",
            'annee':  annee, 'total': actifs.count()
        })

    @action(detail=False, methods=['get'], url_path='solde_personnel')
    def solde_personnel(self, request):
        """Obtenir le solde du bon d'un personnel pour l'année courante"""
        from django.utils import timezone
        personnel_id = request.query_params.get('personnel_id')
        annee        = int(request.query_params.get('annee', timezone.now().year))

        if not personnel_id:
            return Response({'error': 'personnel_id requis'}, status=400)

        bon, _ = BonCaisse.get_or_create_for_year(
            personnel_id=personnel_id,
            annee=annee
        ) if False else (None, False)

        try:
            from residences.models import Personnel
            p   = Personnel.objects.get(id=personnel_id)
            bon, created = BonCaisse.objects.get_or_create(
                personnel=p, annee=annee,
                defaults={'credit_initial': 100000, 'credit_restant': 100000}
            )
            return Response(BonCaisseSerializer(bon).data)
        except Exception as e:
            return Response({'error': str(e)}, status=400)


class MenuJourSerializer(drf_serializers.ModelSerializer):
    type_label  = drf_serializers.CharField(source='get_type_plat_display', read_only=True)
    repas_label = drf_serializers.CharField(source='get_repas_display', read_only=True)
    class Meta:
        model  = MenuJour
        fields = '__all__'

class MenuJourViewSet(viewsets.ModelViewSet):
    queryset           = MenuJour.objects.all()
    serializer_class   = MenuJourSerializer
    permission_classes = [IsAuthenticated]
    filter_backends    = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields   = ['date_service', 'repas', 'disponible']
    ordering           = ['date_service', 'repas']

    @action(detail=False, methods=['get'])
    def today(self, request):
        from django.utils import timezone
        menus = self.get_queryset().filter(
            date_service=timezone.now().date(), disponible=True
        )
        return Response(self.get_serializer(menus, many=True).data)
