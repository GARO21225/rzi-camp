"""
Django Admin — Induction Module
"""
from django.contrib import admin
from induction.models import (
    Site, Camp, Zone, Contractor,
    Employee, EmergencyContact,
    EmployeeDocument, DocumentType,
    Training, TrainingModule, EmployeeTraining,
    QuizQuestion, QuizChoice, QuizAttempt,
    MedicalCheck, AccessBadge, AccessLog,
    InductionWorkflow, WorkflowEvent,
)


@admin.register(Site)
class SiteAdmin(admin.ModelAdmin):
    list_display  = ['code','nom','pays','quiz_score_min','medical_validite_j','actif']
    list_filter   = ['actif','pays']
    search_fields = ['code','nom','pays']
    filter_horizontal = ['superviseurs']


@admin.register(Camp)
class CampAdmin(admin.ModelAdmin):
    list_display  = ['site','nom','code','capacite','actif']
    list_filter   = ['site','actif']


@admin.register(Zone)
class ZoneAdmin(admin.ModelAdmin):
    list_display  = ['site','nom','type_zone','induction_requise','actif']
    list_filter   = ['type_zone','induction_requise']


@admin.register(Contractor)
class ContractorAdmin(admin.ModelAdmin):
    list_display  = ['code','nom','contact_nom','contact_tel','actif']
    search_fields = ['code','nom']


class EmergencyContactInline(admin.TabularInline):
    model = EmergencyContact
    extra = 1


@admin.register(Employee)
class EmployeeAdmin(admin.ModelAdmin):
    list_display  = ['nom','prenom','email','type_employe','statut','site','contractor','created_at']
    list_filter   = ['type_employe','statut','site','actif']
    search_fields = ['nom','prenom','email','matricule']
    inlines       = [EmergencyContactInline]
    readonly_fields = ['created_at','updated_at']


@admin.register(DocumentType)
class DocumentTypeAdmin(admin.ModelAdmin):
    list_display  = ['nom','code','categorie','obligatoire','validite_jours','actif']
    list_filter   = ['categorie','obligatoire']


@admin.register(EmployeeDocument)
class EmployeeDocumentAdmin(admin.ModelAdmin):
    list_display  = ['employee','type_doc','statut','date_expiration','valide_par']
    list_filter   = ['statut','type_doc']
    search_fields = ['employee__nom','employee__prenom']
    readonly_fields = ['valide_par','date_validation','created_at']


class TrainingModuleInline(admin.TabularInline):
    model = TrainingModule
    extra = 0


@admin.register(Training)
class TrainingAdmin(admin.ModelAdmin):
    list_display  = ['code','titre','type_formation','duree_estimee_min','obligatoire','actif']
    list_filter   = ['type_formation','obligatoire']
    inlines       = [TrainingModuleInline]
    filter_horizontal = ['sites']


class QuizChoiceInline(admin.TabularInline):
    model = QuizChoice
    extra = 4


@admin.register(QuizQuestion)
class QuizQuestionAdmin(admin.ModelAdmin):
    list_display  = ['texte','formation','niveau','points','actif']
    list_filter   = ['niveau','actif']
    inlines       = [QuizChoiceInline]


@admin.register(QuizAttempt)
class QuizAttemptAdmin(admin.ModelAdmin):
    list_display  = ['employee','formation','statut','score','score_minimum','date_debut']
    list_filter   = ['statut','formation']
    readonly_fields = ['score','points_obtenus','points_total','date_fin','duree_secondes']


@admin.register(MedicalCheck)
class MedicalCheckAdmin(admin.ModelAdmin):
    list_display  = ['employee','site','resultat','date_examen','date_expiration','medecin_nom']
    list_filter   = ['resultat','site']
    search_fields = ['employee__nom']


@admin.register(AccessBadge)
class AccessBadgeAdmin(admin.ModelAdmin):
    list_display  = ['qr_code_string','employee','site','statut','date_emission','date_expiration']
    list_filter   = ['statut','site']
    search_fields = ['qr_code_string','employee__nom']
    readonly_fields = ['qr_code_data','badge_base64','created_at']


@admin.register(AccessLog)
class AccessLogAdmin(admin.ModelAdmin):
    list_display  = ['employee','site','zone','resultat','timestamp','agent_scan']
    list_filter   = ['resultat','site']
    readonly_fields = ['timestamp']
    date_hierarchy = 'timestamp'


@admin.register(InductionWorkflow)
class InductionWorkflowAdmin(admin.ModelAdmin):
    list_display  = ['employee','site','statut','progression_pct','etape_documents',
                     'etape_formation','etape_quiz','etape_medical','date_validation']
    list_filter   = ['statut','site']
    readonly_fields = ['progression_pct','peut_valider','created_at','updated_at']
