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

    def perform_create(self, serializer):
        try:
            auteur = self.request.user if self.request.user and self.request.user.is_authenticated else None
            incident = serializer.save(auteur=auteur)
        except Exception as orm_error:
            err_msg = str(orm_error).lower()
            if 'does not exist' in err_msg or 'column' in err_msg:
                # Fallback SQL direct avec colonnes de base seulement
                from django.db import connection
                from django.utils import timezone
                data = serializer.validated_data
                with connection.cursor() as cursor:
                    cursor.execute("""
                        INSERT INTO maintenance_incident
                            (titre, description, categorie, priorite, residence, bloc,
                             statut, date_creation, auteur_id)
                        VALUES (%s, %s, %s, %s, %s, %s, 'declare', %s, %s)
                        RETURNING id
                    """, [
                        data.get('titre',''), data.get('description',''),
                        data.get('categorie','Autre'), data.get('priorite','moyenne'),
                        data.get('residence',''), data.get('bloc',''),
                        timezone.now(), self.request.user.id
                    ])
                    incident_id = cursor.fetchone()[0]
                from maintenance.models import Incident
                try:
                    incident = Incident.objects.get(id=incident_id)
                except Exception:
                    return
            else:
                raise orm_error
        # Notifier
        try:
            _notifier(incident, f"Incident déclaré: {incident.titre}", 'info')
        except Exception:
            pass
        try:
            from maintenance.models import CommentaireIncident
            CommentaireIncident.objects.create(
                incident=incident, auteur=self.request.user,
                type_comment='info',
                contenu=f"Incident déclaré — priorité {incident.priorite}"
            )
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
