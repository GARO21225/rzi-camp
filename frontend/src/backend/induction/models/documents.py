"""
Documents obligatoires pour l'induction
"""
import uuid
from django.db import models
from django.utils import timezone
from .base import TimeStampMixin
from .employee import Employee


class DocumentType(models.Model):
    """Type de document requis (configurable par site)."""
    CATEGORIES = [
        ('identite',    'Pièce d\'identité'),
        ('medical',     'Document médical'),
        ('formation',   'Certification formation'),
        ('contrat',     'Contrat / Convention'),
        ('autre',       'Autre'),
    ]
    nom         = models.CharField(max_length=200)
    code        = models.CharField(max_length=30, unique=True)
    categorie   = models.CharField(max_length=20, choices=CATEGORIES, default='autre')
    obligatoire = models.BooleanField(default=True)
    description = models.TextField(blank=True)
    validite_jours = models.PositiveIntegerField(null=True, blank=True,
                    help_text="Validité en jours (null = pas d'expiration)")
    actif       = models.BooleanField(default=True)

    class Meta:
        app_label = 'induction'
        ordering = ['nom']
        verbose_name = 'Type de document'

    def __str__(self):
        return f"{self.nom} ({'obligatoire' if self.obligatoire else 'optionnel'})"


class EmployeeDocument(TimeStampMixin):
    """Document uploadé par ou pour un employé."""
    STATUTS = [
        ('soumis',   'Soumis — en attente de validation'),
        ('valide',   'Validé par RH'),
        ('refuse',   'Refusé'),
        ('expire',   'Expiré'),
    ]
    id          = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    employee    = models.ForeignKey(Employee, on_delete=models.CASCADE,
                    related_name='documents')
    type_doc    = models.ForeignKey(DocumentType, on_delete=models.PROTECT)
    # Fichier
    fichier     = models.FileField(upload_to='induction/documents/%Y/%m/', blank=True, null=True)
    nom_fichier = models.CharField(max_length=255, blank=True)
    taille_ko   = models.PositiveIntegerField(null=True, blank=True)
    mime_type   = models.CharField(max_length=100, blank=True)
    # Base64 pour mobile / offline
    fichier_base64 = models.TextField(blank=True, default='')
    # Validité
    date_emission   = models.DateField(null=True, blank=True)
    date_expiration = models.DateField(null=True, blank=True)
    numero_doc      = models.CharField(max_length=100, blank=True,
                        help_text="Numéro de passeport, CNI, etc.")
    # Validation RH
    statut          = models.CharField(max_length=20, choices=STATUTS, default='soumis')
    valide_par      = models.ForeignKey('auth.User', null=True, blank=True,
                        on_delete=models.SET_NULL, related_name='documents_valides')
    date_validation = models.DateTimeField(null=True, blank=True)
    commentaire     = models.TextField(blank=True)

    class Meta:
        app_label = 'induction'
        ordering = ['-created_at']
        verbose_name = 'Document employé'
        indexes = [
            models.Index(fields=['employee', 'statut']),
            models.Index(fields=['date_expiration']),
        ]

    def __str__(self):
        return f"{self.type_doc.nom} — {self.employee.nom_complet}"

    @property
    def est_expire(self):
        if self.date_expiration:
            return self.date_expiration < timezone.now().date()
        return False

    @property
    def est_valide(self):
        return self.statut == 'valide' and not self.est_expire

    def valider(self, validateur, commentaire=''):
        self.statut = 'valide'
        self.valide_par = validateur
        self.date_validation = timezone.now()
        self.commentaire = commentaire
        self.save(update_fields=['statut','valide_par','date_validation','commentaire'])

    def refuser(self, validateur, commentaire):
        self.statut = 'refuse'
        self.valide_par = validateur
        self.date_validation = timezone.now()
        self.commentaire = commentaire
        self.save(update_fields=['statut','valide_par','date_validation','commentaire'])
