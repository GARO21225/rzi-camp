"""
Visite médicale, Badge d'accès, Log d'accès, Workflow
"""
import uuid
from django.db import models
from django.utils import timezone
from .base import Site, Zone, TimeStampMixin
from .employee import Employee


# ══════════════════════════════════════════════════════
# VISITE MÉDICALE
# ══════════════════════════════════════════════════════

class MedicalCheck(TimeStampMixin):
    """Visite médicale obligatoire avant accès site."""
    RESULTATS = [
        ('FIT',     '✅ Apte — accès autorisé'),
        ('UNFIT',   '❌ Inapte — accès interdit'),
        ('PENDING', '⏳ En attente de résultats'),
    ]
    id              = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    employee        = models.ForeignKey(Employee, on_delete=models.CASCADE,
                        related_name='visites_medicales')
    site            = models.ForeignKey(Site, on_delete=models.CASCADE, null=True, blank=True)
    # Constantes vitales
    temperature     = models.DecimalField(max_digits=4, decimal_places=1,
                        null=True, blank=True, help_text="°C")
    tension_systolique  = models.PositiveIntegerField(null=True, blank=True, help_text="mmHg")
    tension_diastolique = models.PositiveIntegerField(null=True, blank=True, help_text="mmHg")
    pouls           = models.PositiveIntegerField(null=True, blank=True, help_text="bpm")
    # Tests
    test_alcool     = models.BooleanField(default=False, help_text="Test alcool positif")
    taux_alcool     = models.DecimalField(max_digits=4, decimal_places=2,
                        null=True, blank=True, help_text="g/L")
    test_drogue     = models.BooleanField(default=False, help_text="Test drogue positif")
    substances_detectees = models.CharField(max_length=500, blank=True)
    # Questionnaire
    probleme_cardiaque = models.BooleanField(default=False)
    diabete         = models.BooleanField(default=False)
    epilepsie       = models.BooleanField(default=False)
    hypertension    = models.BooleanField(default=False)
    medicaments_en_cours = models.TextField(blank=True)
    allergies       = models.TextField(blank=True)
    # Résultat
    resultat        = models.CharField(max_length=10, choices=RESULTATS, default='PENDING')
    observations    = models.TextField(blank=True)
    recommandations = models.TextField(blank=True)
    # Médecin
    medecin_nom     = models.CharField(max_length=200, blank=True)
    medecin_matricule = models.CharField(max_length=100, blank=True)
    signature_medecin = models.TextField(blank=True, help_text="Signature base64")
    # Validité
    date_examen     = models.DateField(default=timezone.now)
    date_expiration = models.DateField(null=True, blank=True)
    validite_jours  = models.PositiveIntegerField(default=365)

    class Meta:
        app_label = 'induction'
        ordering = ['-date_examen']
        verbose_name = 'Visite médicale'
        indexes = [
            models.Index(fields=['employee', 'resultat']),
            models.Index(fields=['date_expiration']),
        ]

    def __str__(self):
        return f"{self.employee.nom_complet} — {self.resultat} ({self.date_examen})"

    @property
    def est_valide(self):
        if self.resultat != 'FIT':
            return False
        if self.date_expiration:
            return self.date_expiration >= timezone.now().date()
        return True

    def save(self, *args, **kwargs):
        if not self.date_expiration and self.date_examen:
            import datetime
            self.date_expiration = self.date_examen + datetime.timedelta(days=self.validite_jours)
        super().save(*args, **kwargs)


# ══════════════════════════════════════════════════════
# BADGE D'ACCÈS
# ══════════════════════════════════════════════════════

class AccessBadge(TimeStampMixin):
    """Badge d'accès généré après validation complète de l'induction."""
    STATUTS = [
        ('actif',    '✅ Actif'),
        ('expire',   '❌ Expiré'),
        ('suspendu', '⚠️ Suspendu'),
        ('revoque',  '🚫 Révoqué'),
    ]
    id              = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    employee        = models.ForeignKey(Employee, on_delete=models.CASCADE,
                        related_name='badges')
    site            = models.ForeignKey(Site, on_delete=models.CASCADE)
    # QR Code
    qr_code_data    = models.TextField(blank=True, help_text="Base64 PNG du QR code")
    qr_code_string  = models.CharField(max_length=200, unique=True,
                        help_text="Identifiant unique encodé dans le QR")
    # Badge PDF
    badge_pdf       = models.FileField(upload_to='induction/badges/', blank=True, null=True)
    badge_base64    = models.TextField(blank=True, help_text="Badge PDF en base64")
    # Validité
    statut          = models.CharField(max_length=20, choices=STATUTS, default='actif')
    date_emission   = models.DateField(default=timezone.now)
    date_expiration = models.DateField()
    # Zones accessibles
    zones_autorisees = models.ManyToManyField(Zone, blank=True)
    # Révocation
    raison_revocation = models.TextField(blank=True)
    revoque_par     = models.ForeignKey('auth.User', null=True, blank=True,
                        on_delete=models.SET_NULL, related_name='badges_revoques')
    date_revocation = models.DateTimeField(null=True, blank=True)

    class Meta:
        app_label = 'induction'
        ordering = ['-date_emission']
        verbose_name = 'Badge d\'accès'
        indexes = [
            models.Index(fields=['qr_code_string']),
            models.Index(fields=['employee', 'statut']),
            models.Index(fields=['date_expiration']),
        ]

    def __str__(self):
        return f"Badge {self.qr_code_string} — {self.employee.nom_complet} [{self.statut}]"

    @property
    def est_actif(self):
        return (self.statut == 'actif' and
                self.date_expiration >= timezone.now().date())

    def revoquer(self, par, raison):
        self.statut = 'revoque'
        self.raison_revocation = raison
        self.revoque_par = par
        self.date_revocation = timezone.now()
        self.save(update_fields=['statut','raison_revocation','revoque_par','date_revocation'])


class AccessLog(models.Model):
    """Historique de tous les passages (scan QR) sur les sites."""
    RESULTATS = [
        ('autorise',  '✅ Accès autorisé'),
        ('refuse',    '❌ Accès refusé'),
        ('expire',    '⏰ Badge expiré'),
        ('inconnnu',  '❓ Inconnu'),
        ('urgence',   '🚨 Accès urgence'),
    ]
    id          = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    badge       = models.ForeignKey(AccessBadge, on_delete=models.SET_NULL,
                    null=True, blank=True, related_name='acces')
    employee    = models.ForeignKey(Employee, on_delete=models.SET_NULL,
                    null=True, blank=True, related_name='historique_acces')
    site        = models.ForeignKey(Site, on_delete=models.CASCADE)
    zone        = models.ForeignKey(Zone, on_delete=models.SET_NULL, null=True, blank=True)
    qr_scanne   = models.CharField(max_length=200, blank=True)
    resultat    = models.CharField(max_length=20, choices=RESULTATS, default='refuse')
    raison_refus = models.CharField(max_length=500, blank=True)
    # Localisation scan
    agent_scan  = models.ForeignKey('auth.User', null=True, blank=True,
                    on_delete=models.SET_NULL, related_name='scans_effectues')
    latitude    = models.DecimalField(max_digits=10, decimal_places=7, null=True, blank=True)
    longitude   = models.DecimalField(max_digits=10, decimal_places=7, null=True, blank=True)
    timestamp   = models.DateTimeField(default=timezone.now)

    class Meta:
        app_label = 'induction'
        ordering = ['-timestamp']
        verbose_name = 'Log d\'accès'
        indexes = [
            models.Index(fields=['employee', 'timestamp']),
            models.Index(fields=['site', 'resultat']),
            models.Index(fields=['timestamp']),
        ]

    def __str__(self):
        emp = self.employee.nom_complet if self.employee else self.qr_scanne
        return f"{emp} — {self.resultat} — {self.timestamp.strftime('%d/%m/%Y %H:%M')}"


# ══════════════════════════════════════════════════════
# WORKFLOW INDUCTION
# ══════════════════════════════════════════════════════

class InductionWorkflow(TimeStampMixin):
    """État global du workflow d'induction d'un employé sur un site."""
    STATUTS = [
        ('non_commence',  '⬜ Non commencé'),
        ('enregistrement','📝 Enregistrement'),
        ('documents',     '📄 Documents'),
        ('formation',     '🎓 Formation'),
        ('quiz',          '📋 Quiz'),
        ('medical',       '🏥 Visite médicale'),
        ('validation',    '✅ Validation finale'),
        ('complet',       '🎉 Induction complète'),
        ('refuse',        '❌ Refusé'),
        ('expire',        '⏰ Expiré'),
    ]
    id          = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    employee    = models.OneToOneField(Employee, on_delete=models.CASCADE,
                    related_name='workflow')
    site        = models.ForeignKey(Site, on_delete=models.CASCADE)
    statut      = models.CharField(max_length=20, choices=STATUTS, default='non_commence')
    # Étapes complètes
    etape_enregistrement = models.BooleanField(default=False)
    etape_documents      = models.BooleanField(default=False)
    etape_formation      = models.BooleanField(default=False)
    etape_quiz           = models.BooleanField(default=False)
    etape_medical        = models.BooleanField(default=False)
    # Dates de complétion
    date_enregistrement  = models.DateTimeField(null=True, blank=True)
    date_documents       = models.DateTimeField(null=True, blank=True)
    date_formation       = models.DateTimeField(null=True, blank=True)
    date_quiz            = models.DateTimeField(null=True, blank=True)
    date_medical         = models.DateTimeField(null=True, blank=True)
    date_validation      = models.DateTimeField(null=True, blank=True)
    # Résultat
    badge               = models.OneToOneField(AccessBadge, null=True, blank=True,
                            on_delete=models.SET_NULL, related_name='workflow')
    raison_refus        = models.TextField(blank=True)
    notes_admin         = models.TextField(blank=True)

    class Meta:
        app_label = 'induction'
        ordering = ['-created_at']
        verbose_name = 'Workflow induction'

    def __str__(self):
        return f"Induction {self.employee.nom_complet} — {self.get_statut_display()}"

    @property
    def progression_pct(self):
        etapes = [self.etape_enregistrement, self.etape_documents,
                  self.etape_formation, self.etape_quiz, self.etape_medical]
        return int(sum(etapes) / len(etapes) * 100)

    @property
    def peut_valider(self):
        return all([self.etape_enregistrement, self.etape_documents,
                    self.etape_formation, self.etape_quiz, self.etape_medical])

    def marquer_etape(self, etape: str):
        """Marquer une étape comme complète et avancer le workflow."""
        mapping = {
            'enregistrement': ('etape_enregistrement', 'date_enregistrement', 'documents'),
            'documents':      ('etape_documents',      'date_documents',      'formation'),
            'formation':      ('etape_formation',      'date_formation',      'quiz'),
            'quiz':           ('etape_quiz',           'date_quiz',           'medical'),
            'medical':        ('etape_medical',        'date_medical',        'validation'),
        }
        if etape not in mapping:
            return
        flag_field, date_field, next_statut = mapping[etape]
        setattr(self, flag_field, True)
        setattr(self, date_field, timezone.now())
        if self.peut_valider:
            self.statut = 'validation'
        else:
            self.statut = next_statut
        self.save()


class WorkflowEvent(models.Model):
    """Audit trail de toutes les actions du workflow."""
    ACTIONS = [
        ('etape_complete', 'Étape complétée'),
        ('document_valide','Document validé'),
        ('document_refuse','Document refusé'),
        ('quiz_reussi',    'Quiz réussi'),
        ('quiz_echoue',    'Quiz échoué'),
        ('medical_fit',    'Médical FIT'),
        ('medical_unfit',  'Médical UNFIT'),
        ('badge_genere',   'Badge généré'),
        ('acces_autorise', 'Accès autorisé'),
        ('acces_refuse',   'Accès refusé'),
        ('badge_revoque',  'Badge révoqué'),
        ('workflow_reset', 'Workflow réinitialisé'),
    ]
    workflow    = models.ForeignKey(InductionWorkflow, on_delete=models.CASCADE,
                    related_name='events')
    action      = models.CharField(max_length=30, choices=ACTIONS)
    description = models.TextField(blank=True)
    effectue_par = models.ForeignKey('auth.User', null=True, blank=True,
                    on_delete=models.SET_NULL)
    metadata    = models.JSONField(default=dict, blank=True)
    timestamp   = models.DateTimeField(default=timezone.now)

    class Meta:
        app_label = 'induction'
        ordering = ['-timestamp']
        verbose_name = 'Événement workflow'

    def __str__(self):
        return f"{self.workflow.employee.nom_complet} — {self.action} ({self.timestamp:%d/%m %H:%M})"
