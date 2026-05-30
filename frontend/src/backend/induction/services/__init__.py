"""
Services métier — Workflow, Badge, QR Code, Notifications, Audit
"""
import uuid
import base64
import datetime
import logging
from io import BytesIO
from django.utils import timezone
from django.conf import settings

logger = logging.getLogger('induction')


# ══════════════════════════════════════════════════════
# SERVICE WORKFLOW
# ══════════════════════════════════════════════════════

class WorkflowService:
    """Orchestrateur du workflow d'induction."""

    @classmethod
    def initialiser(cls, employee, site, user=None):
        """Créer ou réinitialiser le workflow pour un employé/site."""
        from induction.models import InductionWorkflow, WorkflowEvent
        wf, created = InductionWorkflow.objects.get_or_create(
            employee=employee, site=site,
            defaults={'statut': 'enregistrement'}
        )
        if not created and wf.statut in ('refuse', 'expire'):
            wf.statut = 'enregistrement'
            wf.etape_enregistrement = False
            wf.etape_documents = False
            wf.etape_formation = False
            wf.etape_quiz = False
            wf.etape_medical = False
            wf.badge = None
            wf.raison_refus = ''
            wf.save()
            WorkflowEvent.objects.create(
                workflow=wf, action='workflow_reset',
                description='Workflow réinitialisé',
                effectue_par=user
            )
        # Marquer enregistrement
        if not wf.etape_enregistrement:
            wf.marquer_etape('enregistrement')
            WorkflowEvent.objects.create(
                workflow=wf, action='etape_complete',
                description='Enregistrement complété',
                effectue_par=user
            )
        return wf

    @classmethod
    def verifier_documents(cls, workflow, user=None):
        """Vérifier si tous les documents obligatoires sont validés."""
        from induction.models import EmployeeDocument, DocumentType, WorkflowEvent
        types_obligatoires = DocumentType.objects.filter(obligatoire=True, actif=True)
        for doc_type in types_obligatoires:
            doc_ok = EmployeeDocument.objects.filter(
                employee=workflow.employee,
                type_doc=doc_type,
                statut='valide'
            ).exclude(date_expiration__lt=timezone.now().date()).exists()
            if not doc_ok:
                return False, f"Document manquant ou invalide: {doc_type.nom}"
        workflow.marquer_etape('documents')
        WorkflowEvent.objects.create(
            workflow=workflow, action='etape_complete',
            description='Documents validés', effectue_par=user
        )
        return True, "Documents OK"

    @classmethod
    def valider_formation(cls, workflow, formation, user=None):
        """Valider la complétion d'une formation."""
        from induction.models import EmployeeTraining, WorkflowEvent
        emp_training = EmployeeTraining.objects.filter(
            employee=workflow.employee,
            formation=formation,
            statut='complete'
        ).first()
        if not emp_training:
            return False, "Formation non complétée"
        # Vérifier si toutes les formations du site sont complètes
        formations_site = workflow.site.formations.filter(obligatoire=True, actif=True)
        toutes_ok = all(
            EmployeeTraining.objects.filter(
                employee=workflow.employee, formation=f, statut='complete'
            ).exists()
            for f in formations_site
        )
        if toutes_ok:
            workflow.marquer_etape('formation')
            WorkflowEvent.objects.create(
                workflow=workflow, action='etape_complete',
                description='Toutes les formations complétées', effectue_par=user
            )
        return toutes_ok, "Formations OK" if toutes_ok else "Formations incomplètes"

    @classmethod
    def valider_quiz(cls, workflow, tentative, user=None):
        """Traiter le résultat d'un quiz."""
        from induction.models import WorkflowEvent
        tentative.calculer_score()
        if tentative.reussi:
            workflow.marquer_etape('quiz')
            WorkflowEvent.objects.create(
                workflow=workflow, action='quiz_reussi',
                description=f'Quiz réussi: {tentative.score}%',
                effectue_par=user,
                metadata={'score': float(tentative.score), 'tentative_id': str(tentative.id)}
            )
            return True, f"Quiz réussi ({tentative.score}%)"
        else:
            WorkflowEvent.objects.create(
                workflow=workflow, action='quiz_echoue',
                description=f'Quiz échoué: {tentative.score}% (min {tentative.score_minimum}%)',
                effectue_par=user,
                metadata={'score': float(tentative.score)}
            )
            return False, f"Score insuffisant: {tentative.score}% (minimum {tentative.score_minimum}%)"

    @classmethod
    def valider_medical(cls, workflow, visite, user=None):
        """Traiter le résultat de la visite médicale."""
        from induction.models import WorkflowEvent
        if visite.resultat == 'FIT':
            workflow.marquer_etape('medical')
            WorkflowEvent.objects.create(
                workflow=workflow, action='medical_fit',
                description='Visite médicale FIT', effectue_par=user
            )
            return True, "Médical FIT"
        elif visite.resultat == 'UNFIT':
            workflow.statut = 'refuse'
            workflow.raison_refus = f"Médical UNFIT: {visite.observations}"
            workflow.save(update_fields=['statut', 'raison_refus'])
            WorkflowEvent.objects.create(
                workflow=workflow, action='medical_unfit',
                description=f'Visite médicale UNFIT: {visite.observations}',
                effectue_par=user
            )
            return False, "Médical UNFIT — accès refusé"
        return None, "En attente résultats médicaux"

    @classmethod
    def valider_finale(cls, workflow, user=None):
        """Validation finale — génère le badge si tout est OK."""
        from induction.models import WorkflowEvent
        if not workflow.peut_valider:
            return False, "Toutes les étapes ne sont pas complètes"
        # Générer le badge
        badge = BadgeService.generer(workflow, user)
        workflow.badge = badge
        workflow.statut = 'complet'
        workflow.date_validation = timezone.now()
        workflow.save(update_fields=['badge', 'statut', 'date_validation'])
        # Mettre à jour statut employee
        workflow.employee.statut = 'valide'
        workflow.employee.save(update_fields=['statut'])
        WorkflowEvent.objects.create(
            workflow=workflow, action='badge_genere',
            description=f'Badge généré: {badge.qr_code_string}',
            effectue_par=user,
            metadata={'badge_id': str(badge.id), 'qr': badge.qr_code_string}
        )
        # Notification
        try:
            NotificationService.badge_emis(workflow.employee, badge)
        except Exception as e:
            logger.warning(f"Notification badge échouée: {e}")
        return True, f"Induction validée — Badge: {badge.qr_code_string}"


# ══════════════════════════════════════════════════════
# SERVICE BADGE & QR CODE
# ══════════════════════════════════════════════════════

class BadgeService:
    """Génération des badges et QR codes."""

    @classmethod
    def generer(cls, workflow, user=None):
        """Créer un AccessBadge pour un workflow validé."""
        from induction.models import AccessBadge
        employee = workflow.employee
        site     = workflow.site
        # Désactiver les anciens badges
        AccessBadge.objects.filter(
            employee=employee, site=site, statut='actif'
        ).update(statut='expire')
        # Identifiant unique du QR
        qr_string = f"RZI-{site.code}-{str(uuid.uuid4())[:8].upper()}"
        # Calcul date expiration
        date_exp = (timezone.now() + datetime.timedelta(days=site.badge_validite_j)).date()
        badge = AccessBadge.objects.create(
            employee=employee,
            site=site,
            qr_code_string=qr_string,
            date_expiration=date_exp,
            statut='actif',
            created_by=user,
        )
        # Générer QR code image
        badge.qr_code_data = cls.generer_qr_base64(qr_string, employee)
        # Générer badge PDF
        badge.badge_base64 = cls.generer_badge_base64(badge)
        badge.save(update_fields=['qr_code_data', 'badge_base64'])
        return badge

    @classmethod
    def generer_qr_base64(cls, qr_string: str, employee=None) -> str:
        """Générer un QR code PNG encodé en base64."""
        try:
            import qrcode
            from PIL import Image, ImageDraw, ImageFont
            # QR code
            qr = qrcode.QRCode(version=2, box_size=8, border=2,
                error_correction=qrcode.constants.ERROR_CORRECT_H)
            qr.add_data(qr_string)
            qr.make(fit=True)
            img = qr.make_image(fill_color='#1e3a8a', back_color='white')
            buf = BytesIO()
            img.save(buf, format='PNG')
            return base64.b64encode(buf.getvalue()).decode()
        except ImportError:
            # Fallback si qrcode/PIL non installé
            return ''

    @classmethod
    def generer_badge_base64(cls, badge) -> str:
        """Générer un badge PDF en base64."""
        try:
            from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Image as RLImage, Table, TableStyle
            from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
            from reportlab.lib.pagesizes import A6, landscape
            from reportlab.lib import colors
            from reportlab.lib.units import mm

            buf = BytesIO()
            doc = SimpleDocTemplate(buf, pagesize=landscape(A6),
                                    topMargin=5*mm, bottomMargin=5*mm,
                                    leftMargin=5*mm, rightMargin=5*mm)
            styles = getSampleStyleSheet()
            story  = []
            # Header
            story.append(Paragraph(
                f"<b>{badge.site.nom}</b>",
                ParagraphStyle('header', fontSize=16, textColor=colors.HexColor('#1e3a8a'), spaceAfter=3)
            ))
            story.append(Paragraph("BADGE D'ACCÈS SITE", styles['Normal']))
            story.append(Spacer(1, 3*mm))
            # Contenu
            data = [
                ['Nom:', f"{badge.employee.nom} {badge.employee.prenom}"],
                ['Type:', badge.employee.get_type_employe_display()],
                ['Société:', badge.employee.contractor.nom if badge.employee.contractor else '-'],
                ['Badge N°:', badge.qr_code_string],
                ['Valide jusqu:', str(badge.date_expiration)],
            ]
            t = Table(data, colWidths=[30*mm, 60*mm])
            t.setStyle(TableStyle([
                ('FONTSIZE', (0,0), (-1,-1), 9),
                ('TEXTCOLOR', (0,0), (0,-1), colors.HexColor('#64748b')),
                ('FONTNAME', (1,0), (1,-1), 'Helvetica-Bold'),
            ]))
            story.append(t)
            doc.build(story)
            return base64.b64encode(buf.getvalue()).decode()
        except Exception as e:
            logger.warning(f"Badge PDF generation failed: {e}")
            return ''


# ══════════════════════════════════════════════════════
# SERVICE CONTRÔLE D'ACCÈS
# ══════════════════════════════════════════════════════

class AccessControlService:
    """Vérification d'accès lors du scan QR."""

    @classmethod
    def verifier_qr(cls, qr_string: str, site_id, zone_id=None, agent=None) -> dict:
        """Vérifier un QR scanné et retourner le résultat d'accès."""
        from induction.models import AccessBadge, AccessLog, Site, Zone
        resultat = {
            'autorise': False,
            'employee': None,
            'badge': None,
            'raison': '',
            'statut_medical': None,
            'date_expiration': None,
        }
        try:
            site = Site.objects.get(id=site_id)
            zone = Zone.objects.get(id=zone_id) if zone_id else None
        except Exception:
            return {**resultat, 'raison': 'Site ou zone inconnu'}

        try:
            badge = (AccessBadge.objects
                     .select_related('employee', 'employee__contractor')
                     .prefetch_related('zones_autorisees')
                     .get(qr_code_string=qr_string))
        except AccessBadge.DoesNotExist:
            AccessLog.objects.create(
                site=site, zone=zone, qr_scanne=qr_string,
                resultat='inconnnu', raison_refus='QR code inconnu', agent_scan=agent
            )
            return {**resultat, 'raison': 'QR code inconnu'}

        employee = badge.employee
        raison_refus = ''

        # Vérifications
        if badge.statut == 'revoque':
            raison_refus = f"Badge révoqué: {badge.raison_revocation}"
        elif badge.statut == 'suspendu':
            raison_refus = "Badge suspendu"
        elif not badge.est_actif:
            raison_refus = f"Badge expiré le {badge.date_expiration}"
        elif zone and zone.induction_requise and not employee.induction_complete:
            raison_refus = "Induction non complétée pour cette zone"
        elif zone and zone not in badge.zones_autorisees.all() and zone.type_zone == 'restricted':
            raison_refus = f"Zone restreinte — accès non autorisé pour ce badge"
        else:
            # Vérifier validité médicale
            derniere_visite = (employee.visites_medicales
                               .filter(resultat='FIT')
                               .order_by('-date_examen').first())
            if not derniere_visite or not derniere_visite.est_valide:
                raison_refus = "Visite médicale expirée ou absente"

        acces_ok = not raison_refus
        AccessLog.objects.create(
            badge=badge, employee=employee, site=site, zone=zone,
            qr_scanne=qr_string,
            resultat='autorise' if acces_ok else 'refuse',
            raison_refus=raison_refus,
            agent_scan=agent
        )

        return {
            'autorise': acces_ok,
            'employee': {
                'id': str(employee.id),
                'nom_complet': employee.nom_complet,
                'type': employee.get_type_employe_display(),
                'photo_base64': employee.photo_base64,
                'societe': employee.contractor.nom if employee.contractor else '',
            },
            'badge': {
                'id': str(badge.id),
                'code': badge.qr_code_string,
                'valide_jusqu': str(badge.date_expiration),
                'statut': badge.statut,
            },
            'raison': raison_refus or 'Accès autorisé',
        }


# ══════════════════════════════════════════════════════
# SERVICE NOTIFICATIONS
# ══════════════════════════════════════════════════════

class NotificationService:
    """Envoi de notifications email / WhatsApp."""

    @classmethod
    def badge_emis(cls, employee, badge):
        """Notifier l'employé que son badge est prêt."""
        if not employee.email:
            return
        try:
            from django.core.mail import send_mail
            send_mail(
                subject=f'[RZI ERP] Votre badge d\'accès est prêt — {badge.site.nom}',
                message=(
                    f"Bonjour {employee.prenom},\n\n"
                    f"Votre induction est validée sur {badge.site.nom}.\n"
                    f"Badge N°: {badge.qr_code_string}\n"
                    f"Valide jusqu'au: {badge.date_expiration}\n\n"
                    "Présentez ce badge lors de chaque accès au site.\n"
                ),
                from_email=getattr(settings, 'DEFAULT_FROM_EMAIL', 'erp@rzi.com'),
                recipient_list=[employee.email],
                fail_silently=True,
            )
        except Exception as e:
            logger.error(f"Email badge échoué pour {employee.email}: {e}")

    @classmethod
    def document_refuse(cls, employee, document, commentaire):
        """Notifier l'employé qu'un document a été refusé."""
        if not employee.email:
            return
        try:
            from django.core.mail import send_mail
            send_mail(
                subject='[RZI ERP] Document refusé — Action requise',
                message=(
                    f"Bonjour {employee.prenom},\n\n"
                    f"Votre document '{document.type_doc.nom}' a été refusé.\n"
                    f"Motif: {commentaire}\n\n"
                    "Veuillez soumettre un nouveau document.\n"
                ),
                from_email=getattr(settings, 'DEFAULT_FROM_EMAIL', 'erp@rzi.com'),
                recipient_list=[employee.email],
                fail_silently=True,
            )
        except Exception as e:
            logger.error(f"Email refus doc échoué: {e}")

    @classmethod
    def expiration_imminente(cls, employee, badge, jours_restants):
        """Alerter si le badge expire bientôt."""
        if not employee.email:
            return
        try:
            from django.core.mail import send_mail
            send_mail(
                subject=f'[RZI ERP] ⚠️ Badge expire dans {jours_restants} jours',
                message=(
                    f"Bonjour {employee.prenom},\n\n"
                    f"Votre badge {badge.qr_code_string} expire le {badge.date_expiration}.\n"
                    "Veuillez renouveler votre induction.\n"
                ),
                from_email=getattr(settings, 'DEFAULT_FROM_EMAIL', 'erp@rzi.com'),
                recipient_list=[employee.email],
                fail_silently=True,
            )
        except Exception as e:
            logger.error(f"Email expiration échoué: {e}")


# ══════════════════════════════════════════════════════
# SERVICE STATISTIQUES
# ══════════════════════════════════════════════════════

class StatisticsService:
    """Calcul des KPIs du tableau de bord."""

    @classmethod
    def dashboard(cls, site_id=None):
        from induction.models import (Employee, AccessBadge, AccessLog,
                                            QuizAttempt, MedicalCheck, InductionWorkflow)
        from django.db.models import Count, Q
        today = timezone.now().date()
        qs_emp = Employee.objects.filter(actif=True)
        if site_id:
            qs_emp = qs_emp.filter(site_id=site_id)

        # Expirations prochaines (30 jours)
        expire_soon = today + datetime.timedelta(days=30)
        badges_expirant = AccessBadge.objects.filter(
            statut='actif',
            date_expiration__lte=expire_soon,
            date_expiration__gte=today
        )
        if site_id:
            badges_expirant = badges_expirant.filter(site_id=site_id)

        return {
            'total_employes': qs_emp.count(),
            'statuts': dict(qs_emp.values_list('statut').annotate(n=Count('id'))),
            'badges_actifs': AccessBadge.objects.filter(statut='actif', **({'site_id':site_id} if site_id else {})).count(),
            'badges_expirant_30j': badges_expirant.count(),
            'quiz_echoues_7j': QuizAttempt.objects.filter(
                statut='echoue',
                created_at__gte=timezone.now()-datetime.timedelta(days=7)
            ).count(),
            'acces_refuses_24h': AccessLog.objects.filter(
                resultat='refuse',
                timestamp__gte=timezone.now()-datetime.timedelta(hours=24)
            ).count(),
            'medicaux_expirés': MedicalCheck.objects.filter(
                resultat='FIT',
                date_expiration__lt=today
            ).count(),
            'conformite_pct': cls._calcul_conformite(site_id),
        }

    @classmethod
    def _calcul_conformite(cls, site_id=None):
        from induction.models import Employee
        qs = Employee.objects.filter(actif=True)
        if site_id:
            qs = qs.filter(site_id=site_id)
        total = qs.count()
        if not total:
            return 0
        valides = qs.filter(statut='valide').count()
        return round(valides / total * 100, 1)
