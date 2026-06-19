from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils import timezone
from django.contrib.auth.models import User
from .models import Incident, CommentaireIncident, SLA_HEURES
from .serializers import IncidentSerializer, CommentaireSerializer
from django.db.models import Q, Count


def _notifier(incident, message, type_notif='info'):
    """Créer une notification simple pour les admins et le technicien"""
    try:
        from evenements.models import SimpleNotification
        from accounts.models import Profile
        dest = set()
        # Admins
        for p in Profile.objects.filter(role__in=['admin','technicien']).select_related('user'):
            dest.add(p.user)
        # Auteur
        if incident.auteur:
            dest.add(incident.auteur)
        # Technicien assigné
        if incident.assigne_a:
            dest.add(incident.assigne_a)
        for user in dest:
            SimpleNotification.objects.create(
                user=user,
                titre=f"🔧 Incident #{incident.id} — {incident.titre[:40]}",
                message=message,
                type_notif=type_notif,
            )
    except Exception:
        pass


from rest_framework.decorators import api_view, permission_classes as pc
from rest_framework.permissions import AllowAny

@api_view(['GET'])
@pc([IsAuthenticated])
def detail_incident(request, pk):
    """Detail complet avec commentaires et photos"""
    from django.db import connection
    from rest_framework.response import Response
    try:
        with connection.cursor() as c:
            c.execute(
                "SELECT i.id,i.titre,i.description,i.categorie,i.priorite,i.statut,i.residence,i.bloc,"
                "i.date_creation,i.sla_echeance,i.sla_depasse,i.commentaire_resolution,i.commentaire_cloture,"
                "COALESCE(i.photo_base64,'') as photo_base64, COALESCE(i.photo_mime,'image/jpeg') as photo_mime,"
                "COALESCE(u.first_name||' '||u.last_name,u.username,'—') as auteur_nom,"
                "COALESCE(a.first_name||' '||a.last_name,a.username,NULL) as assigne_nom,"
                "i.auteur_id,i.assigne_a_id "
                "FROM maintenance_incident i "
                "LEFT JOIN auth_user u ON u.id=i.auteur_id "
                "LEFT JOIN auth_user a ON a.id=i.assigne_a_id "
                "WHERE i.id=%s", [pk]
            )
            cols = [d[0] for d in c.description]
            row = c.fetchone()
        if not row:
            return Response({'detail': 'Non trouvé'}, status=404)
        inc = dict(zip(cols, row))
        for k in ['date_creation', 'sla_echeance']:
            if inc.get(k) and hasattr(inc[k], 'isoformat'):
                inc[k] = inc[k].isoformat()
        inc['statut_label'] = inc['statut']
        inc['priorite_label'] = inc['priorite']
        inc['sla_restant_h'] = 0
        inc['temps_ecoule_h'] = 0

        with connection.cursor() as c:
            c.execute(
                "SELECT ci.id,ci.type_comment,ci.contenu,ci.date_creation,"
                "COALESCE(ci.photo_base64,'') as photo_base64,"
                "COALESCE(u.first_name||' '||u.last_name,u.username,'—') as auteur_nom "
                "FROM maintenance_commentaireincident ci "
                "LEFT JOIN auth_user u ON u.id=ci.auteur_id "
                "WHERE ci.incident_id=%s ORDER BY ci.date_creation ASC", [pk]
            )
            cc = [d[0] for d in c.description]
            comments = []
            for r in c.fetchall():
                d = dict(zip(cc, r))
                if d.get('date_creation') and hasattr(d['date_creation'], 'isoformat'):
                    d['date_creation'] = d['date_creation'].isoformat()
                d['type_label'] = d['type_comment']
                comments.append(d)
        inc['commentaires'] = comments
        return Response(inc)
    except Exception as e:
        return Response({'detail': str(e)}, status=500)


@api_view(['GET'])
@pc([IsAuthenticated])
def stats_incidents(request):
    """Stats incidents via SQL direct"""
    from django.db import connection
    from rest_framework.response import Response
    try:
        with connection.cursor() as c:
            c.execute("""
                SELECT
                    COUNT(*) as total,
                    COUNT(*) FILTER (WHERE statut='declare') as declare,
                    COUNT(*) FILTER (WHERE statut='assigne') as assigne,
                    COUNT(*) FILTER (WHERE statut='en_cours') as en_cours,
                    COUNT(*) FILTER (WHERE statut='resolu') as resolu,
                    COUNT(*) FILTER (WHERE statut='cloture') as cloture,
                    COUNT(*) FILTER (WHERE sla_depasse=TRUE AND statut NOT IN ('cloture','annule')) as sla_depasse,
                    COUNT(*) FILTER (WHERE priorite='critique' AND statut NOT IN ('cloture','annule')) as critique
                FROM maintenance_incident
            """)
            row = c.fetchone()
            cols = [d[0] for d in c.description]
            stats = dict(zip(cols, row))
            stats['ouverts'] = stats['total'] - stats['cloture']
        return Response(stats)
    except Exception as e:
        return Response({'total':0,'declare':0,'assigne':0,'en_cours':0,
                         'resolu':0,'cloture':0,'sla_depasse':0,'critique':0,'ouverts':0})


@api_view(['GET'])
@pc([IsAuthenticated])
def list_incidents(request):
    """Liste des incidents via SQL direct - bypass ORM/historique"""
    from django.db import connection
    from rest_framework.response import Response

    params = request.query_params
    statut    = params.get('statut', '')
    priorite  = params.get('priorite', '')
    categorie = params.get('categorie', '')

    where = ['1=1']
    args  = []
    if statut:    where.append('i.statut = %s');    args.append(statut)
    if priorite:  where.append('i.priorite = %s');  args.append(priorite)
    if categorie: where.append('i.categorie = %s'); args.append(categorie)

    where_sql = ' AND '.join(where)

    try:
        with connection.cursor() as c:
            c.execute(f"""
                SELECT i.id, i.titre, i.description, i.categorie, i.priorite,
                       i.statut, i.residence, i.bloc,
                       i.date_creation, i.sla_echeance, i.sla_depasse,
                       i.commentaire_resolution, i.commentaire_cloture,
                       COALESCE(u.first_name || ' ' || u.last_name, u.username, '—') as auteur_nom,
                       COALESCE(a.first_name || ' ' || a.last_name, a.username, NULL) as assigne_nom,
                       i.auteur_id, i.assigne_a_id
                FROM maintenance_incident i
                LEFT JOIN auth_user u ON u.id = i.auteur_id
                LEFT JOIN auth_user a ON a.id = i.assigne_a_id
                WHERE {where_sql}
                ORDER BY i.date_creation DESC
                LIMIT 200
            """, args)
            cols = [d[0] for d in c.description]
            rows = c.fetchall()

        incidents = []
        for row in rows:
            d = dict(zip(cols, row))
            # Convertir datetimes en strings
            for k in ['date_creation', 'sla_echeance']:
                if d.get(k):
                    d[k] = d[k].isoformat() if hasattr(d[k], 'isoformat') else str(d[k])
            d['commentaires']   = []
            d['statut_label']   = d['statut']
            d['priorite_label'] = d['priorite']
            d['sla_restant_h']  = 0
            d['temps_ecoule_h'] = 0
            d['photo_base64']   = ''
            d['photo_mime']     = 'image/jpeg'
            d['photo_resolution_base64'] = ''
            incidents.append(d)

        return Response({'results': incidents, 'count': len(incidents)})
    except Exception as e:
        return Response({'results': [], 'count': 0, 'error': str(e)})


@api_view(['POST'])
@pc([IsAuthenticated])
def declarer_incident(request):
    """Endpoint simplifié pour déclarer un incident - bypass ORM complet"""
    from django.db import connection
    from django.utils import timezone as tz
    from rest_framework.response import Response
    from rest_framework import status as drf_status

    data = request.data
    titre = data.get('titre', '').strip()
    description = data.get('description', '').strip()

    if not titre or not description:
        return Response({'detail': 'Titre et description requis'}, status=400)

    residence = data.get('residence', '').strip()
    if not residence:
        return Response({'detail': 'Résidence requise'}, status=400)

    now = tz.now()
    sla_map = {'critique': 2, 'haute': 8, 'moyenne': 24, 'basse': 72}
    priorite = data.get('priorite', 'moyenne')
    categorie = data.get('categorie', 'Autre')
    bloc = data.get('bloc', '')
    sla_echeance = now + tz.timedelta(hours=sla_map.get(priorite, 24))
    auteur_id = request.user.id if request.user and request.user.is_authenticated else None

    photo_b64  = data.get('photo_base64', '')
    photo_mime = data.get('photo_mime', 'image/jpeg') or 'image/jpeg'

    try:
        with connection.cursor() as c:
            c.execute("""
                INSERT INTO maintenance_incident
                    (titre, description, categorie, priorite, statut,
                     residence, bloc, auteur_id,
                     photo_base64, photo_mime, photo_resolution_base64,
                     date_creation, sla_echeance, sla_depasse,
                     sla_notification_envoyee,
                     commentaire_resolution, commentaire_cloture)
                VALUES (%s,%s,%s,%s,'declare',%s,%s,%s,
                        %s,%s,'',
                        %s,%s,FALSE,FALSE,'','')
                RETURNING id
            """, [titre, description, categorie, priorite,
                    residence, bloc, auteur_id,
                    photo_b64, photo_mime,
                    now, sla_echeance])
            incident_id = c.fetchone()[0]

            # Commentaire initial
            try:
                c.execute("""
                    INSERT INTO maintenance_commentaireincident
                        (incident_id, auteur_id, type_comment, contenu, date_creation, photo_base64)
                    VALUES (%s, %s, 'info', %s, %s, '')
                """, [incident_id, auteur_id,
                        f'Incident déclaré — priorité {priorite}', now])
            except Exception:
                pass

        return Response({
            'id': incident_id,
            'titre': titre,
            'statut': 'declare',
            'priorite': priorite,
            'message': 'Incident déclaré avec succès'
        }, status=drf_status.HTTP_201_CREATED)

    except Exception as e:
        return Response({'detail': f'Erreur: {str(e)}'}, status=500)


class IncidentViewSet(viewsets.ModelViewSet):
    queryset = Incident.objects.select_related('auteur', 'assigne_a').prefetch_related('commentaires').all()
    serializer_class = IncidentSerializer
    filter_backends  = [filters.SearchFilter, filters.OrderingFilter]
    search_fields    = ['titre', 'description', 'residence', 'bloc', 'categorie']
    ordering_fields  = ['date_creation', 'priorite', 'statut']
    ordering         = ['-date_creation']

    def get_permissions(self):
        from rest_framework.permissions import IsAuthenticated
        return [IsAuthenticated()]

    def get_queryset(self):
        qs  = super().get_queryset()
        req = self.request

        # Filtres query params
        statut   = req.query_params.get('statut')
        priorite = req.query_params.get('priorite')
        categorie= req.query_params.get('categorie')
        sla_only = req.query_params.get('sla_depasse')
        assigne  = req.query_params.get('assigne')

        if statut:    qs = qs.filter(statut=statut)
        if priorite:  qs = qs.filter(priorite=priorite)
        if categorie: qs = qs.filter(categorie=categorie)
        if sla_only:  qs = qs.filter(sla_depasse=True)
        if assigne:   qs = qs.filter(assigne_a_id=assigne)

        # Techniciens ne voient que leurs incidents + déclarés
        role = getattr(getattr(req.user, 'profile', None), 'role', None)
        if not req.user.is_staff and not req.user.is_superuser and role == 'technicien':
            qs = qs.filter(Q(assigne_a=req.user) | Q(statut='declare'))

        return qs

    def destroy(self, request, *args, **kwargs):
        """Suppression complète via SQL - tous les DELETE en séquence"""
        from django.db import connection
        from rest_framework.response import Response
        from rest_framework import status as drf_status
        pk = kwargs.get('pk')
        errors = []
        try:
            with connection.cursor() as c:
                # 1. Table historique simple_history (peut ne pas exister)
                for hist_table in ['maintenance_historicalincident']:
                    try:
                        c.execute(f'DELETE FROM {hist_table} WHERE id=%s', [pk])
                    except Exception as e:
                        errors.append(f'hist: {e}')

                # 2. Commentaires (FK CASCADE mais on force)
                try:
                    c.execute('DELETE FROM maintenance_commentaireincident WHERE incident_id=%s', [pk])
                except Exception as e:
                    errors.append(f'comments: {e}')

                # 3. L'incident lui-même
                c.execute('DELETE FROM maintenance_incident WHERE id=%s', [pk])
                deleted = c.rowcount

            if deleted == 0:
                return Response({'detail': f'Non trouvé (errors: {errors})'}, status=404)
            return Response(status=drf_status.HTTP_204_NO_CONTENT)
        except Exception as e:
            return Response({'detail': f'{str(e)} | sub-errors: {errors}'}, status=500)

    def partial_update(self, request, *args, **kwargs):
        """Mise à jour SQL directe"""
        from django.db import connection
        from rest_framework.response import Response
        pk = kwargs.get('pk')
        data = request.data
        fields = []
        values = []
        allowed = ['titre','description','categorie','priorite','residence','bloc','statut']
        for f in allowed:
            if f in data:
                fields.append(f'{f}=%s')
                values.append(data[f])
        if not fields:
            return Response({'detail': 'Aucun champ à modifier'}, status=400)
        values.append(pk)
        try:
            with connection.cursor() as c:
                c.execute(f'UPDATE maintenance_incident SET {", ".join(fields)} WHERE id=%s', values)
            return Response({'id': pk, 'message': 'Mis à jour'})
        except Exception as e:
            return Response({'detail': str(e)}, status=500)

    def perform_create(self, serializer):
        from django.db import connection
        from django.utils import timezone as tz
        from maintenance.models import Incident, CommentaireIncident

        auteur = self.request.user if self.request.user and self.request.user.is_authenticated else None
        auteur_id = auteur.id if auteur else None
        data = serializer.validated_data

        # Toujours utiliser INSERT SQL direct pour éviter les erreurs ORM/historique
        now = tz.now()
        sla_map = {'critique': 2, 'haute': 8, 'moyenne': 24, 'basse': 72}
        priorite = data.get('priorite', 'moyenne')
        sla_h = sla_map.get(priorite, 24)
        sla_echeance = now + tz.timedelta(hours=sla_h)

        incident = None
        try:
            with connection.cursor() as c:
                c.execute("""
                    INSERT INTO maintenance_incident
                        (titre, description, categorie, priorite, statut,
                         residence, bloc, auteur_id,
                         photo_base64, photo_mime, photo_resolution_base64,
                         latitude, longitude,
                         date_creation, sla_echeance, sla_depasse,
                         sla_notification_envoyee,
                         commentaire_resolution, commentaire_cloture)
                    VALUES (%s,%s,%s,%s,'declare',%s,%s,%s,'','image/jpeg','',
                            NULL,NULL,%s,%s,FALSE,FALSE,'','')
                    RETURNING id
                """, [
                    data.get('titre', ''),
                    data.get('description', ''),
                    data.get('categorie', 'Autre'),
                    priorite,
                    data.get('residence', ''),
                    data.get('bloc', ''),
                    auteur_id,
                    now,
                    sla_echeance,
                ])
                incident_id = c.fetchone()[0]
            incident = Incident.objects.get(id=incident_id)
        except Exception as e:
            from rest_framework.exceptions import ValidationError
            raise ValidationError({'detail': f'Erreur création incident: {str(e)}'})

        # Commentaire initial (optionnel)
        try:
            CommentaireIncident.objects.create(
                incident=incident, auteur=auteur,
                type_comment='info',
                contenu=f"Incident déclaré — priorité {incident.priorite}"
            )
        except Exception:
            pass

        # Notification (optionnel)
        try:
            _notifier(incident, f"Incident déclaré: {incident.titre}", 'info')
        except Exception:
            pass


    @action(detail=True, methods=['post'])
    def assigner(self, request, pk=None):
        """Assigner au technicien via SQL"""
        from django.db import connection
        tech_id = request.data.get('technicien_id')
        if not tech_id:
            return Response({'error': 'technicien_id requis'}, status=400)
        try:
            with connection.cursor() as c:
                c.execute('UPDATE maintenance_incident SET statut=%s, assigne_a_id=%s, date_assignation=NOW() WHERE id=%s',
                          ['assigne', tech_id, pk])
                auteur_id = request.user.id if request.user and request.user.is_authenticated else None
                try:
                    c.execute('INSERT INTO maintenance_commentaireincident (incident_id,auteur_id,type_comment,contenu,date_creation,photo_base64) VALUES (%s,%s,%s,%s,NOW(),%s)',
                              [pk, auteur_id, 'assignation', 'Incident assigné', ''])
                except Exception:
                    pass
            return Response({'id': pk, 'statut': 'assigne'})
        except Exception as e:
            return Response({'error': str(e)}, status=500)

    @action(detail=True, methods=['post'])
    def commencer(self, request, pk=None):
        from django.db import connection
        auteur_id = request.user.id if request.user and request.user.is_authenticated else None
        commentaire = request.data.get('commentaire', 'Intervention démarrée')
        try:
            with connection.cursor() as c:
                c.execute("UPDATE maintenance_incident SET statut='en_cours', date_debut=NOW() WHERE id=%s", [pk])
                try:
                    c.execute('INSERT INTO maintenance_commentaireincident (incident_id,auteur_id,type_comment,contenu,date_creation,photo_base64) VALUES (%s,%s,%s,%s,NOW(),%s)', [pk, auteur_id, 'debut', commentaire, ''])
                except Exception: pass
            return Response({'id': pk, 'statut': 'en_cours'})
        except Exception as e:
            return Response({'error': str(e)}, status=500)
    @action(detail=True, methods=['post'])
    def resoudre(self, request, pk=None):
        from django.db import connection
        auteur_id = request.user.id if request.user and request.user.is_authenticated else None
        commentaire = request.data.get('commentaire', 'Incident résolu')
        try:
            with connection.cursor() as c:
                c.execute("UPDATE maintenance_incident SET statut='resolu', date_resolution=NOW(), commentaire_resolution=%s WHERE id=%s", [commentaire, pk])
                try:
                    c.execute('INSERT INTO maintenance_commentaireincident (incident_id,auteur_id,type_comment,contenu,date_creation,photo_base64) VALUES (%s,%s,%s,%s,NOW(),%s)', [pk, auteur_id, 'resolution', commentaire, ''])
                except Exception: pass
            return Response({'id': pk, 'statut': 'resolu'})
        except Exception as e:
            return Response({'error': str(e)}, status=500)
    @action(detail=True, methods=['post'])
    def cloturer(self, request, pk=None):
        from django.db import connection
        auteur_id = request.user.id if request.user and request.user.is_authenticated else None
        commentaire = request.data.get('commentaire', 'Incident clôturé')
        try:
            with connection.cursor() as c:
                c.execute("UPDATE maintenance_incident SET statut='cloture', date_cloture=NOW(), commentaire_cloture=%s WHERE id=%s", [commentaire, pk])
                try:
                    c.execute('INSERT INTO maintenance_commentaireincident (incident_id,auteur_id,type_comment,contenu,date_creation,photo_base64) VALUES (%s,%s,%s,%s,NOW(),%s)', [pk, auteur_id, 'cloture', commentaire, ''])
                except Exception: pass
            return Response({'id': pk, 'statut': 'cloture'})
        except Exception as e:
            return Response({'error': str(e)}, status=500)
    @action(detail=True, methods=['post'])
    def escalader(self, request, pk=None):
        """Escalader la priorité"""
        incident = self.get_object()
        ancien   = incident.priorite
        mapping  = {'basse':'moyenne', 'moyenne':'haute', 'haute':'critique', 'critique':'critique'}
        nouvelle = mapping.get(ancien, 'haute')

        if nouvelle == ancien:
            return Response({'error': 'Déjà au niveau critique'}, status=400)

        incident.priorite     = nouvelle
        heures                = SLA_HEURES[nouvelle]
        incident.sla_echeance = timezone.now() + timezone.timedelta(hours=heures)
        incident.save()

        raison = request.data.get('raison', 'Escalade demandée')
        CommentaireIncident.objects.create(
            incident=incident, auteur=request.user,
            type_comment='escalade',
            contenu=f"Escalade {ancien} → {nouvelle}: {raison}"
        )
        _notifier(incident, f"⚠️ Escalade priorité: {ancien} → {nouvelle}", 'escalade')
        return Response(IncidentSerializer(incident).data)

    @action(detail=True, methods=['post'])
    def commenter(self, request, pk=None):
        from django.db import connection
        auteur_id = request.user.id if request.user and request.user.is_authenticated else None
        contenu = request.data.get('contenu', '')
        type_c = request.data.get('type_comment', 'info')
        photo = request.data.get('photo_base64', '')
        try:
            with connection.cursor() as c:
                c.execute('INSERT INTO maintenance_commentaireincident (incident_id,auteur_id,type_comment,contenu,date_creation,photo_base64) VALUES (%s,%s,%s,%s,NOW(),%s)',
                          [pk, auteur_id, type_c, contenu, photo])
                cid = c.lastrowid
            return Response({'id': pk, 'message': 'Commentaire ajouté'})
        except Exception as e:
            return Response({'error': str(e)}, status=500)
    @action(detail=True, methods=['post'])
    def annuler(self, request, pk=None):
        incident = self.get_object()
        incident.statut = 'annule'
        incident.save()
        CommentaireIncident.objects.create(
            incident=incident, auteur=request.user,
            type_comment='info',
            contenu=f"Incident annulé: {request.data.get('raison','—')}"
        )
        return Response({'ok': True})

    # ── Stats ─────────────────────────────────────────────────────

    @action(detail=False, methods=['get'])
    def stats(self, request):
        qs  = self.get_queryset()
        now = timezone.now()
        return Response({
            'total':     qs.count(),
            'declare':   qs.filter(statut='declare').count(),
            'assigne':   qs.filter(statut='assigne').count(),
            'en_cours':  qs.filter(statut='en_cours').count(),
            'resolu':    qs.filter(statut='resolu').count(),
            'cloture':   qs.filter(statut='cloture').count(),
            'ouverts':   qs.exclude(statut__in=['cloture','annule']).count(),
            'sla_depasse': qs.filter(sla_depasse=True).exclude(statut__in=['cloture','annule']).count(),
            'critique':  qs.filter(priorite='critique').exclude(statut__in=['cloture','annule']).count(),
        })

    @action(detail=False, methods=['get'])
    def techniciens(self, request):
        """Liste des techniciens disponibles"""
        from accounts.models import Profile
        techs = Profile.objects.filter(
            role__in=['technicien','admin']
        ).select_related('user')
        return Response([{
            'id':       t.user.id,
            'nom':      t.user.get_full_name() or t.user.username,
            'username': t.user.username,
            'role':     t.role,
            'incidents_actifs': Incident.objects.filter(
                assigne_a=t.user,
                statut__in=['assigne','en_cours']
            ).count()
        } for t in techs])

    @action(detail=False, methods=['post'])
    def verifier_sla(self, request):
        """Vérifie et notifie les incidents en dépassement SLA"""
        now      = timezone.now()
        expires  = Incident.objects.filter(
            sla_echeance__lt=now,
            statut__in=['declare','assigne','en_cours'],
            sla_depasse=False
        )
        count = expires.count()
        expires.update(sla_depasse=True)
        for inc in expires:
            _notifier(inc, f"⏰ SLA dépassé — Incident #{inc.id}: {inc.titre}", 'relance')
        return Response({'alertes_generees': count})
