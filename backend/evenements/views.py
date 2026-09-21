
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def envoyer_notification(request):
    """Envoyer une notification à un ou plusieurs utilisateurs"""
    from rest_framework.response import Response
    u = request.user
    is_admin = u.is_staff or u.is_superuser or (hasattr(u,"profile") and getattr(u.profile,"role","")=="admin")
    if not is_admin:
        # Peut cibler des utilisateurs precis ou un profil ENTIER
        # (tous les agents d'un role) avec un titre/message libres - une
        # capacite de diffusion qui doit rester admin-only, meme logique
        # que les alertes campus/evenements deja corriges.
        return Response({"error":"Admin requis pour envoyer une notification"}, status=403)
    from django.contrib.auth.models import User
    try:
        destinataires = request.data.get('destinataires', [])  # liste de user_id
        titre = request.data.get('titre', '')
        message = request.data.get('message', '')
        type_notif = request.data.get('type', 'info')
        target_profil = request.data.get('profil', None)  # envoyer à tous les agents d'un profil

        users_to_notify = []
        if destinataires:
            users_to_notify = User.objects.filter(id__in=destinataires)
        elif target_profil:
            from residences.models import Personnel
            persos = Personnel.objects.filter(profil=target_profil).select_related('user')
            users_to_notify = [p.user for p in persos if p.user]

        count = 0
        for user in users_to_notify:
            try:
                SimpleNotification.objects.create(
                    user=user, titre=titre, message=message, type_notif=type_notif, lu=False
                )
                count += 1
            except Exception:
                pass

        return Response({'sent': count, 'titre': titre})
    except Exception as e:
        return Response({'detail': str(e)}, status=500)


from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from .models import Evenement, Notification, AlerteCampus, SimpleNotification, GroupeDiffusion
from .serializers import EvenementSerializer, NotificationSerializer, AlerteSerializer, GroupeDiffusionSerializer
import datetime


class EvenementViewSet(viewsets.ModelViewSet):
    serializer_class = EvenementSerializer
    queryset = Evenement.objects.all()  # requis par DRF pour déduire le basename du router
                                          # (get_queryset() ci-dessous prime à l'exécution réelle)

    def get_queryset(self):
        from django.db.models import Count
        # select_related('cree_par') + annotation Count : élimine le N+1
        # (était 2 requêtes par événement avant ce fix, voir ERROR_LOG.md #7 pour le pattern jumeau)
        return (Evenement.objects
            .select_related('cree_par')
            .annotate(nb_notifies_annot=Count('notifications'))
            .order_by("-date_debut"))

    def _is_admin(self, u):
        return u.is_staff or u.is_superuser or (hasattr(u,"profile") and getattr(u.profile,"role","")=="admin")

    def create(self, request, *args, **kwargs):
        if not self._is_admin(request.user):
            return Response({"error":"Admin uniquement"}, status=403)
        return super().create(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        if not self._is_admin(request.user):
            return Response({"error":"Admin uniquement"}, status=403)
        return super().update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        if not self._is_admin(request.user):
            return Response({"error":"Admin uniquement"}, status=403)
        return super().partial_update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        if not self._is_admin(request.user):
            return Response({"error":"Admin uniquement"}, status=403)
        return super().destroy(request, *args, **kwargs)

    @action(detail=True, methods=["post"])
    def generer_qr(self, request, pk=None):
        """
        Genere (ou renvoie si deja genere) le QR individuel a usage unique
        de L'UTILISATEUR CONNECTE pour cet evenement - jamais pour
        quelqu'un d'autre (self-service, comme rejoindre_rotation). Refuse
        si l'evenement n'a pas qr_requis actif.
        """
        from .models import QREvenement
        from residences.models import Personnel
        import uuid

        evenement = self.get_object()
        if not evenement.qr_requis:
            return Response({"error":"Cet évènement ne nécessite pas de QR d'accès."}, status=400)

        pers = Personnel.objects.filter(user=request.user).first()
        if not pers:
            return Response({"error":"Aucune fiche personnel associée à votre compte."}, status=404)

        preference = request.data.get("preference_boisson", "")
        if evenement.propose_boisson and preference not in ("alcool", "sucrerie"):
            return Response({"error":"Merci de choisir une préférence : alcool ou sucrerie."}, status=400)

        qr, cree = QREvenement.objects.get_or_create(
            evenement=evenement, personnel=pers,
            defaults={"token": uuid.uuid4().hex, "preference_boisson": preference if evenement.propose_boisson else ""},
        )
        if not cree and evenement.propose_boisson and preference and qr.preference_boisson != preference:
            qr.preference_boisson = preference
            qr.save(update_fields=["preference_boisson"])
        from .serializers import QREvenementSerializer
        # Image QR generee a la volee (meme motif que les badges Personnel,
        # residences/views.py) - pas stockee, le token suffit a la
        # regenerer identique a chaque appel.
        import qrcode, io, base64
        qr_img = qrcode.make(qr.token, box_size=10, border=2)
        buf = io.BytesIO()
        qr_img.save(buf, format="PNG")
        data = QREvenementSerializer(qr).data
        data["qr_image_base64"] = base64.b64encode(buf.getvalue()).decode()
        return Response(data, status=201 if cree else 200)

    @action(detail=True, methods=["post"])
    def scanner_qr(self, request, pk=None):
        """
        Valide un QR d'evenement a l'entree - reserve au personnel
        autorise a controler l'acces (admin, ou role avec permission
        d'ecriture sur /evenements). Usage unique strict, verrouillage
        transactionnel identique au scan repas (empeche un double-scan
        simultane de compter deux fois la meme personne).
        """
        from django.db import transaction
        from django.utils import timezone
        from .models import QREvenement

        if not self._is_admin(request.user):
            return Response({"error":"Seul le personnel autorisé peut scanner les accès."}, status=403)

        token = (request.data.get("token") or "").strip()
        if not token:
            return Response({"valid": False, "erreur": "Token requis"}, status=400)

        with transaction.atomic():
            qr = QREvenement.objects.select_for_update().filter(token=token, evenement_id=pk).first()
            if not qr:
                return Response({"valid": False, "erreur": "Code invalide pour cet évènement."}, status=404)
            if qr.utilise:
                return Response({
                    "valid": False,
                    "erreur": f"Ce code a déjà été scanné ({qr.utilise_le.strftime('%d/%m/%Y à %H:%M') if qr.utilise_le else ''}).",
                    "personnel_nom": f"{qr.personnel.nom} {qr.personnel.prenom}",
                }, status=400)
            qr.utilise = True
            qr.utilise_le = timezone.now()
            qr.valide_par = request.user
            qr.save(update_fields=["utilise","utilise_le","valide_par"])

        return Response({
            "valid": True,
            "personnel_nom": f"{qr.personnel.nom} {qr.personnel.prenom}",
            "personnel_societe": qr.personnel.societe,
            "preference_boisson": qr.get_preference_boisson_display() if qr.preference_boisson else None,
        })

    @action(detail=True, methods=["post"])
    def notifier(self, request, pk=None):
        # Diffuse une notification a TOUS les residents - une capacite de
        # "broadcast" qui doit rester admin-only, d'autant plus que les
        # evenements incluent des types 'Alerte'/'Securite' (un abus ici
        # equivaudrait a une fausse alerte generale envoyee a tout le camp).
        if not self._is_admin(request.user):
            return Response({"error":"Admin uniquement"}, status=403)
        evt = self.get_object()
        n = evt.notifier_residents()
        return Response({"ok":True,"residents_notifies":n})

    @action(detail=True, methods=["patch"])
    def changer_statut(self, request, pk=None):
        if not self._is_admin(request.user):
            return Response({"error":"Admin uniquement"}, status=403)
        evt = self.get_object()
        statut = request.data.get("statut")
        if statut not in [s[0] for s in Evenement.STATUT]:
            return Response({"error":"Statut invalide"}, status=400)
        evt.statut = statut
        evt.save(update_fields=["statut"])
        return Response(EvenementSerializer(evt).data)

    @action(detail=False, methods=["get"])
    def agenda(self, request):
        import django.utils.timezone as tz
        from django.db.models import Count
        qs = (Evenement.objects
            .select_related('cree_par')
            .annotate(nb_notifies_annot=Count('notifications'))
            .filter(date_debut__gte=tz.now(), statut__in=["planifie","en_cours"])
            .order_by("date_debut")[:10])
        return Response(EvenementSerializer(qs, many=True).data)


class NotificationViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = NotificationSerializer
    queryset = Notification.objects.none()

    def get_queryset(self):
        user = self.request.user
        if hasattr(user, "personnel"):
            return Notification.objects.filter(personnel=user.personnel).order_by("-date_envoi")
        return Notification.objects.none()

    @action(detail=True, methods=["post"])
    def marquer_lu(self, request, pk=None):
        n = self.get_object()
        n.marquer_lue()
        return Response({"ok":True})

    @action(detail=False, methods=["post"])
    def tout_lire(self, request):
        from django.utils import timezone
        if hasattr(request.user, "personnel"):
            Notification.objects.filter(
                personnel=request.user.personnel, lu=False
            ).update(lu=True, date_lecture=timezone.now())
        SimpleNotification.objects.filter(user=request.user, lu=False).update(
            lu=True, date_lecture=timezone.now()
        )
        return Response({"ok":True})

    @action(detail=False, methods=["get"])
    def compteur(self, request):
        try:
            count = 0
            alertes_data = []
            prochain = None
            all_notifs = []

            # Event-based notifications
            try:
                if hasattr(request.user, 'personnel'):
                    ev_notifs = Notification.objects.filter(
                        personnel=request.user.personnel
                    ).select_related('evenement').order_by('-date_envoi')[:10]
                    count += ev_notifs.filter(lu=False).count()
                    for n in ev_notifs:
                        all_notifs.append({
                            'id': str(n.id),
                            'evenement_titre': n.evenement.titre if n.evenement else 'Événement',
                            'evenement_type': n.evenement.type_event if n.evenement else 'evenement',
                            'evenement_date': n.evenement.date_debut.isoformat() if n.evenement else None,
                            'evenement_lieu': n.evenement.lieu if n.evenement else '',
                            'lu': n.lu,
                            'date_envoi': n.date_envoi.isoformat(),
                            'source': 'event',
                        })
            except Exception:
                pass

            # System notifications
            try:
                sys_notifs = SimpleNotification.objects.filter(
                    user=request.user
                ).order_by('-date_envoi')[:10]
                count += sys_notifs.filter(lu=False).count()
                for n in sys_notifs:
                    all_notifs.append({
                        'id': f's{n.id}',
                        'evenement_titre': n.titre,
                        'evenement_type': n.type_notif,
                        'evenement_date': None,
                        'evenement_lieu': '',
                        'lu': n.lu,
                        'date_envoi': n.date_envoi.isoformat(),
                        'message': n.message,
                        'source': 'system',
                    })
            except Exception:
                pass

            # Alertes expiration induction (>11 mois = expire dans 30j)
            try:
                from django.db import connection
                from datetime import datetime, timedelta
                seuil = datetime.now() - timedelta(days=335)
                with connection.cursor() as c:
                    c.execute("SELECT EXISTS(SELECT FROM information_schema.tables WHERE table_name='residences_inductionrecord')")
                    if c.fetchone()[0]:
                        c.execute(
                            "SELECT COUNT(*) FROM residences_inductionrecord ir "
                            "JOIN residences_personnel p ON p.id=ir.personnel_id "
                            "WHERE ir.statut='valide' AND ir.mis_a_jour<%s", [seuil])
                        nb_expiring = c.fetchone()[0]
                        if nb_expiring > 0:
                            count += 1
                            all_notifs.insert(0, {
                                'id': 'induction_expiry',
                                'evenement_titre': f'{nb_expiring} induction(s) expirent dans 30 jours',
                                'evenement_type': 'alerte_induction',
                                'evenement_date': None,
                                'evenement_lieu': '',
                                'lu': False,
                                'date_envoi': datetime.now().isoformat(),
                                'message': f'{nb_expiring} membre(s) du personnel ont une induction valide depuis plus de 11 mois. Renouvellement requis.',
                                'source': 'induction_expiry',
                            })
            except Exception:
                pass

            all_notifs.sort(key=lambda x: x['date_envoi'], reverse=True)

            try:
                alertes = AlerteCampus.objects.filter(active=True).order_by('-date_creation')[:3]
                alertes_data = [{'id':a.id,'message':a.message,'type_alerte':a.type_alerte} for a in alertes]
            except Exception:
                pass

            try:
                import django.utils.timezone as tz
                evt = Evenement.objects.filter(
                    date_debut__gte=tz.now(), statut__in=['planifie','en_cours']
                ).order_by('date_debut').first()
                if evt:
                    prochain = {'id':evt.id,'titre':evt.titre,'date_debut':evt.date_debut.isoformat(),'lieu':evt.lieu}
            except Exception:
                pass

            return Response({'non_lues':count,'alertes':alertes_data,'prochain_evenement':prochain,'notifications':all_notifs[:20]})
        except Exception as e:
            return Response({'non_lues':0,'alertes':[],'prochain_evenement':None,'notifications':[],'error':str(e)})


class GroupeDiffusionViewSet(viewsets.ModelViewSet):
    """
    Groupes de diffusion configurables depuis Parametrage - remplace le
    ciblage code en dur ('residents actifs uniquement') des notifications
    d'evenement. Lecture ouverte (necessaire pour peupler le selecteur a
    la creation d'un evenement), ecriture admin-only.
    """
    serializer_class = GroupeDiffusionSerializer
    queryset = GroupeDiffusion.objects.all()

    def _is_admin(self, u):
        return u.is_staff or u.is_superuser or (hasattr(u,"profile") and getattr(u.profile,"role","")=="admin")

    def create(self, request, *args, **kwargs):
        if not self._is_admin(request.user):
            return Response({"error":"Admin uniquement"}, status=403)
        return super().create(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        if not self._is_admin(request.user):
            return Response({"error":"Admin uniquement"}, status=403)
        return super().update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        if not self._is_admin(request.user):
            return Response({"error":"Admin uniquement"}, status=403)
        return super().partial_update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        if not self._is_admin(request.user):
            return Response({"error":"Admin uniquement"}, status=403)
        return super().destroy(request, *args, **kwargs)


class AlerteViewSet(viewsets.ModelViewSet):
    serializer_class = AlerteSerializer
    queryset = AlerteCampus.objects.all()

    def get_queryset(self):
        return AlerteCampus.objects.filter(active=True).order_by("-date_creation")

    def _is_admin(self, u):
        return u.is_staff or u.is_superuser or (hasattr(u,"profile") and getattr(u.profile,"role","")=="admin")

    def create(self, request, *args, **kwargs):
        # Une alerte campus est diffusee a tout le monde - meme logique
        # que les evenements de type Alerte/Securite, admin-only pour
        # eviter qu'une fausse alerte generale puisse etre declenchee par
        # n'importe quel utilisateur authentifie.
        if not self._is_admin(request.user):
            return Response({"error":"Admin uniquement"}, status=403)
        return super().create(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        if not self._is_admin(request.user):
            return Response({"error":"Admin uniquement"}, status=403)
        return super().update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        if not self._is_admin(request.user):
            return Response({"error":"Admin uniquement"}, status=403)
        return super().partial_update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        if not self._is_admin(request.user):
            return Response({"error":"Admin uniquement"}, status=403)
        return super().destroy(request, *args, **kwargs)

    @action(detail=True, methods=["post"])
    def desactiver(self, request, pk=None):
        if not self._is_admin(request.user):
            return Response({"error":"Admin uniquement"}, status=403)
        a = self.get_object()
        a.active = False
        a.save(update_fields=["active"])
        return Response({"ok":True})
