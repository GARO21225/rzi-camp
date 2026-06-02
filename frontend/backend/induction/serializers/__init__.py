"""
Serializers DRF — Induction Module
"""
from rest_framework import serializers
from django.contrib.auth import get_user_model
from induction.models import (
    Site, Camp, Zone, Contractor,
    Employee, EmergencyContact,
    EmployeeDocument, DocumentType,
    Training, TrainingModule, EmployeeTraining,
    QuizQuestion, QuizChoice, QuizAttempt, QuizAnswer,
    MedicalCheck, AccessBadge, AccessLog,
    InductionWorkflow, WorkflowEvent,
)

User = get_user_model()


# ── Base Serializers ─────────────────────────────────

class UserBriefSerializer(serializers.ModelSerializer):
    nom_complet = serializers.SerializerMethodField()
    def get_nom_complet(self, obj):
        return f"{obj.first_name} {obj.last_name}".strip() or obj.username
    class Meta:
        model  = User
        fields = ['id', 'username', 'email', 'nom_complet']


class SiteSerializer(serializers.ModelSerializer):
    nb_employes  = serializers.SerializerMethodField()
    nb_badges    = serializers.SerializerMethodField()
    conformite   = serializers.SerializerMethodField()

    def get_nb_employes(self, obj):
        return obj.employees.filter(actif=True).count()

    def get_nb_badges(self, obj):
        return obj.accessbadge_set.filter(statut='actif').count()

    def get_conformite(self, obj):
        total = obj.employees.filter(actif=True).count()
        if not total: return 0
        return round(obj.employees.filter(statut='valide').count() / total * 100, 1)

    class Meta:
        model  = Site
        fields = '__all__'


class CampSerializer(serializers.ModelSerializer):
    site_nom = serializers.CharField(source='site.nom', read_only=True)
    class Meta:
        model  = Camp
        fields = '__all__'


class ZoneSerializer(serializers.ModelSerializer):
    site_nom = serializers.CharField(source='site.nom', read_only=True)
    class Meta:
        model  = Zone
        fields = '__all__'


class ContractorSerializer(serializers.ModelSerializer):
    nb_employes = serializers.SerializerMethodField()
    def get_nb_employes(self, obj):
        return obj.employes.filter(actif=True).count()
    class Meta:
        model  = Contractor
        fields = '__all__'


# ── Employee ─────────────────────────────────────────

class EmergencyContactSerializer(serializers.ModelSerializer):
    class Meta:
        model  = EmergencyContact
        fields = '__all__'
        read_only_fields = ['employee']


class EmployeeListSerializer(serializers.ModelSerializer):
    """Serializer léger pour les listes."""
    nom_complet   = serializers.ReadOnlyField()
    site_nom      = serializers.CharField(source='site.nom', read_only=True)
    contractor_nom = serializers.CharField(source='contractor.nom', read_only=True)
    statut_label  = serializers.CharField(source='get_statut_display', read_only=True)
    progression   = serializers.SerializerMethodField()

    def get_progression(self, obj):
        try:
            return obj.workflow.progression_pct
        except Exception:
            return 0

    class Meta:
        model  = Employee
        fields = ['id','nom','prenom','nom_complet','email','type_employe','statut',
                  'statut_label','site_nom','contractor_nom','progression',
                  'photo_base64','created_at']


class EmployeeDetailSerializer(serializers.ModelSerializer):
    """Serializer complet avec contacts urgence et workflow."""
    nom_complet      = serializers.ReadOnlyField()
    contacts_urgence = EmergencyContactSerializer(many=True, read_only=True)
    statut_label     = serializers.CharField(source='get_statut_display', read_only=True)
    workflow_statut  = serializers.SerializerMethodField()
    progression      = serializers.SerializerMethodField()
    badge_actif      = serializers.SerializerMethodField()

    def get_workflow_statut(self, obj):
        try: return obj.workflow.get_statut_display()
        except: return 'Non commencé'

    def get_progression(self, obj):
        try: return obj.workflow.progression_pct
        except: return 0

    def get_badge_actif(self, obj):
        badge = obj.badges.filter(statut='actif').order_by('-date_emission').first()
        if badge:
            return {
                'code': badge.qr_code_string,
                'expire': str(badge.date_expiration),
                'actif': badge.est_actif,
            }
        return None

    class Meta:
        model  = Employee
        fields = '__all__'


class EmployeeCreateSerializer(serializers.ModelSerializer):
    contacts_urgence = EmergencyContactSerializer(many=True, required=False)

    class Meta:
        model  = Employee
        exclude = ['statut', 'created_by']

    def create(self, validated_data):
        contacts_data = validated_data.pop('contacts_urgence', [])
        request = self.context.get('request')
        if request:
            validated_data['created_by'] = request.user
        employee = Employee.objects.create(**validated_data)
        for contact_data in contacts_data:
            EmergencyContact.objects.create(employee=employee, **contact_data)
        return employee


# ── Documents ────────────────────────────────────────

class DocumentTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model  = DocumentType
        fields = '__all__'


class EmployeeDocumentSerializer(serializers.ModelSerializer):
    type_doc_nom    = serializers.CharField(source='type_doc.nom', read_only=True)
    statut_label    = serializers.CharField(source='get_statut_display', read_only=True)
    est_expire      = serializers.ReadOnlyField()
    valide_par_nom  = serializers.SerializerMethodField()

    def get_valide_par_nom(self, obj):
        if obj.valide_par:
            return f"{obj.valide_par.first_name} {obj.valide_par.last_name}".strip()
        return None

    class Meta:
        model  = EmployeeDocument
        fields = '__all__'
        read_only_fields = ['valide_par','date_validation','created_by']


class DocumentValidationSerializer(serializers.Serializer):
    """Pour valider ou refuser un document."""
    action      = serializers.ChoiceField(choices=['valider','refuser'])
    commentaire = serializers.CharField(required=False, allow_blank=True)


# ── Formation ────────────────────────────────────────

class TrainingModuleSerializer(serializers.ModelSerializer):
    class Meta:
        model  = TrainingModule
        fields = '__all__'


class TrainingSerializer(serializers.ModelSerializer):
    modules     = TrainingModuleSerializer(many=True, read_only=True)
    nb_participants = serializers.SerializerMethodField()
    def get_nb_participants(self, obj):
        return obj.participants.filter(statut='complete').count()
    class Meta:
        model  = Training
        fields = '__all__'


class EmployeeTrainingSerializer(serializers.ModelSerializer):
    formation_titre = serializers.CharField(source='formation.titre', read_only=True)
    statut_label    = serializers.CharField(source='get_statut_display', read_only=True)
    class Meta:
        model  = EmployeeTraining
        fields = '__all__'
        read_only_fields = ['created_by']


# ── Quiz ─────────────────────────────────────────────

class QuizChoiceSerializer(serializers.ModelSerializer):
    class Meta:
        model  = QuizChoice
        fields = ['id','texte','ordre']  # NE PAS exposer est_correcte


class QuizChoiceAdminSerializer(serializers.ModelSerializer):
    """Pour les admins — expose la bonne réponse."""
    class Meta:
        model  = QuizChoice
        fields = '__all__'


class QuizQuestionSerializer(serializers.ModelSerializer):
    choix = QuizChoiceSerializer(many=True, read_only=True)
    class Meta:
        model  = QuizQuestion
        exclude = ['actif']


class QuizAnswerSerializer(serializers.Serializer):
    question_id = serializers.UUIDField()
    choix_id    = serializers.UUIDField()


class QuizSubmitSerializer(serializers.Serializer):
    """Soumission d'une tentative complète."""
    reponses = QuizAnswerSerializer(many=True)


class QuizAttemptSerializer(serializers.ModelSerializer):
    statut_label    = serializers.CharField(source='get_statut_display', read_only=True)
    employee_nom    = serializers.CharField(source='employee.nom_complet', read_only=True)
    formation_titre = serializers.CharField(source='formation.titre', read_only=True)
    class Meta:
        model  = QuizAttempt
        fields = '__all__'


# ── Médical ──────────────────────────────────────────

class MedicalCheckSerializer(serializers.ModelSerializer):
    resultat_label  = serializers.CharField(source='get_resultat_display', read_only=True)
    employee_nom    = serializers.CharField(source='employee.nom_complet', read_only=True)
    est_valide      = serializers.ReadOnlyField()

    class Meta:
        model  = MedicalCheck
        fields = '__all__'
        read_only_fields = ['created_by']


# ── Badge & Accès ─────────────────────────────────────

class AccessBadgeSerializer(serializers.ModelSerializer):
    employee_nom = serializers.CharField(source='employee.nom_complet', read_only=True)
    site_nom     = serializers.CharField(source='site.nom', read_only=True)
    est_actif    = serializers.ReadOnlyField()

    class Meta:
        model  = AccessBadge
        fields = '__all__'


class AccessLogSerializer(serializers.ModelSerializer):
    employee_nom = serializers.CharField(source='employee.nom_complet', read_only=True)
    site_nom     = serializers.CharField(source='site.nom', read_only=True)
    zone_nom     = serializers.CharField(source='zone.nom', read_only=True)
    resultat_label = serializers.CharField(source='get_resultat_display', read_only=True)

    class Meta:
        model  = AccessLog
        fields = '__all__'


class QRScanSerializer(serializers.Serializer):
    """Pour le scan QR au contrôle d'accès."""
    qr_string = serializers.CharField(max_length=200)
    zone_id   = serializers.UUIDField(required=False)
    latitude  = serializers.DecimalField(max_digits=10, decimal_places=7, required=False)
    longitude = serializers.DecimalField(max_digits=10, decimal_places=7, required=False)


# ── Workflow ──────────────────────────────────────────

class WorkflowEventSerializer(serializers.ModelSerializer):
    effectue_par_nom = serializers.SerializerMethodField()
    def get_effectue_par_nom(self, obj):
        if obj.effectue_par:
            return f"{obj.effectue_par.first_name} {obj.effectue_par.last_name}".strip()
        return 'Système'
    class Meta:
        model  = WorkflowEvent
        fields = '__all__'


class InductionWorkflowSerializer(serializers.ModelSerializer):
    employee_detail = EmployeeListSerializer(source='employee', read_only=True)
    statut_label    = serializers.CharField(source='get_statut_display', read_only=True)
    progression_pct = serializers.ReadOnlyField()
    peut_valider    = serializers.ReadOnlyField()
    events          = WorkflowEventSerializer(many=True, read_only=True)
    badge_info      = serializers.SerializerMethodField()

    def get_badge_info(self, obj):
        if obj.badge:
            return {
                'code': obj.badge.qr_code_string,
                'expire': str(obj.badge.date_expiration),
                'qr_image': obj.badge.qr_code_data,
                'badge_pdf': obj.badge.badge_base64,
            }
        return None

    class Meta:
        model  = InductionWorkflow
        fields = '__all__'


# ── Dashboard ─────────────────────────────────────────

class DashboardSerializer(serializers.Serializer):
    """Stats pour le tableau de bord admin."""
    total_employes       = serializers.IntegerField()
    statuts              = serializers.DictField()
    badges_actifs        = serializers.IntegerField()
    badges_expirant_30j  = serializers.IntegerField()
    quiz_echoues_7j      = serializers.IntegerField()
    acces_refuses_24h    = serializers.IntegerField()
    medicaux_expirés     = serializers.IntegerField()
    conformite_pct       = serializers.FloatField()
