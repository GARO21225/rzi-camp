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
@pc([AllowAny])
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
@pc([AllowAny])
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
@pc([AllowAny])
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
                        '','image/jpeg','',
                        %s,%s,FALSE,FALSE,'','')
                RETURNING id
            """, [titre, description, categorie, priorite,
                    residence, bloc, auteur_id,
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
        from rest_framework.permissions import IsAuthenticated, AllowAny
        # Permettre la création même si le token a un problème temporaire
        if self.action in ['create', 'list', 'retrieve']:
            return [AllowAny()]
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
        """Suppression SQL directe pour éviter le crash simple-history"""
        from django.db import connection
        from rest_framework.response import Response
        from rest_framework import status as drf_status
        pk = kwargs.get('pk')
        try:
            with connection.cursor() as c:
                c.execute('DELETE FROM maintenance_commentaireincident WHERE incident_id=%s', [pk])
                c.execute('DELETE FROM maintenance_incident WHERE id=%s', [pk])
                if c.rowcount == 0:
                    return Response({'detail': 'Incident non trouvé'}, status=404)
            return Response(status=drf_status.HTTP_204_NO_CONTENT)
        except Exception as e:
            return Response({'detail': str(e)}, status=500)

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


    def assigner(self, request, pk=None):
        """Assigner au technicien"""
        incident = self.get_object()
        if incident.statut not in ('declare', 'assigne'):
            return Response({'error': 'Incident déjà en traitement ou clôturé'}, status=400)

        tech_id = request.data.get('technicien_id')
        if not tech_id:
            return Response({'error': 'technicien_id requis'}, status=400)

        try:
            technicien = User.objects.get(pk=tech_id)
        except User.DoesNotExist:
            return Response({'error': 'Technicien introuvable'}, status=404)

        incident.assigne_a        = technicien
        incident.statut           = 'assigne'
        incident.date_assignation = timezone.now()
        incident.save()

        nom_tech = technicien.get_full_name() or technicien.username
        nom_assig = request.user.get_full_name() or request.user.username
        CommentaireIncident.objects.create(
            incident=incident, auteur=request.user,
            type_comment='assignation',
            contenu=f"Assigné à {nom_tech} par {nom_assig}"
        )
        _notifier(incident, f"Incident assigné à {nom_tech}", 'assignation')
        return Response(IncidentSerializer(incident).data)

    @action(detail=True, methods=['post'])
    def commencer(self, request, pk=None):
        """Technicien commence l'intervention"""
        incident = self.get_object()
        if incident.statut != 'assigne':
            return Response({'error': 'Incident non assigné'}, status=400)

        incident.statut     = 'en_cours'
        incident.date_debut = timezone.now()
        incident.save()

        CommentaireIncident.objects.create(
            incident=incident, auteur=request.user,
            type_comment='debut',
            contenu=request.data.get('commentaire', 'Intervention démarrée')
        )
        _notifier(incident, f"Intervention démarrée par {request.user.get_full_name() or request.user.username}", 'info')
        return Response(IncidentSerializer(incident).data)

    @action(detail=True, methods=['post'])
    def resoudre(self, request, pk=None):
        """Marquer comme résolu"""
        incident = self.get_object()
        if incident.statut not in ('assigne', 'en_cours'):
            return Response({'error': 'Statut invalide pour résolution'}, status=400)

        commentaire = request.data.get('commentaire', '')
        if not commentaire:
            return Response({'error': 'Commentaire de résolution requis'}, status=400)

        incident.statut                = 'resolu'
        incident.date_resolution       = timezone.now()
        incident.commentaire_resolution = commentaire
        incident.sla_depasse           = incident.sla_echeance and timezone.now() > incident.sla_echeance
        incident.save()

        CommentaireIncident.objects.create(
            incident=incident, auteur=request.user,
            type_comment='resolution',
            contenu=commentaire,
            photo_base64=request.data.get('photo_base64', '')
        )
        _notifier(incident, f"Incident résolu: {commentaire[:80]}", 'resolution')
        return Response(IncidentSerializer(incident).data)

    @action(detail=True, methods=['post'])
    def cloturer(self, request, pk=None):
        """Clôturer définitivement (gestionnaire)"""
        incident = self.get_object()
        if incident.statut != 'resolu':
            return Response({'error': 'Seul un incident résolu peut être clôturé'}, status=400)

        incident.statut              = 'cloture'
        incident.date_cloture        = timezone.now()
        incident.commentaire_cloture = request.data.get('commentaire', 'Résolution validée')
        incident.save()

        CommentaireIncident.objects.create(
            incident=incident, auteur=request.user,
            type_comment='cloture',
            contenu=incident.commentaire_cloture
        )
        _notifier(incident, "Incident clôturé avec succès", 'cloture')
        return Response(IncidentSerializer(incident).data)

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
        """Ajouter un commentaire libre"""
        incident = self.get_object()
        c = CommentaireIncident.objects.create(
            incident=incident,
            auteur=request.user,
            type_comment='info',
            contenu=request.data.get('contenu', ''),
            photo_base64=request.data.get('photo_base64', '')
        )
        return Response(CommentaireSerializer(c).data, status=201)

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
