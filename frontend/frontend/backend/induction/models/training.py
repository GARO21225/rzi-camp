"""
Formation QHSE — Modules, Progression, Complétion
"""
import uuid
from django.db import models
from django.utils import timezone
from .base import Site, TimeStampMixin
from .employee import Employee


class Training(TimeStampMixin):
    """Formation QHSE (peut être liée à un ou plusieurs sites)."""
    TYPES = [
        ('video',       'Vidéo'),
        ('pdf',         'Document PDF'),
        ('presentation','Présentation'),
        ('mixte',       'Format mixte'),
    ]
    id          = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    titre       = models.CharField(max_length=300)
    code        = models.CharField(max_length=30, unique=True)
    description = models.TextField(blank=True)
    type_formation  = models.CharField(max_length=20, choices=TYPES, default='mixte')
    duree_estimee_min = models.PositiveIntegerField(default=30, help_text="Durée en minutes")
    obligatoire = models.BooleanField(default=True)
    ordre       = models.PositiveIntegerField(default=0, help_text="Ordre d'affichage")
    # Applicable à quels sites
    sites       = models.ManyToManyField(Site, blank=True, related_name='formations')
    actif       = models.BooleanField(default=True)
    version     = models.CharField(max_length=20, default='1.0')

    class Meta:
        app_label = 'induction'
        ordering = ['ordre', 'titre']
        verbose_name = 'Formation'

    def __str__(self):
        return f"[{self.code}] {self.titre}"


class TrainingModule(models.Model):
    """Module de contenu d'une formation (vidéo, PDF, etc.)."""
    id          = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    formation   = models.ForeignKey(Training, on_delete=models.CASCADE, related_name='modules')
    titre       = models.CharField(max_length=300)
    type_media  = models.CharField(max_length=20, choices=Training.TYPES, default='pdf')
    # Contenu
    fichier     = models.FileField(upload_to='induction/formations/%Y/', blank=True, null=True)
    url_externe = models.URLField(blank=True, help_text="URL YouTube, Vimeo, etc.")
    contenu_html = models.TextField(blank=True, help_text="Contenu HTML inline")
    duree_min   = models.PositiveIntegerField(default=10)
    ordre       = models.PositiveIntegerField(default=0)
    obligatoire = models.BooleanField(default=True)

    class Meta:
        app_label = 'induction'
        ordering = ['ordre']
        verbose_name = 'Module de formation'

    def __str__(self):
        return f"{self.formation.code} — {self.titre}"


class EmployeeTraining(TimeStampMixin):
    """Suivi de la progression d'un employé dans une formation."""
    STATUTS = [
        ('non_commence','Non commencé'),
        ('en_cours',   'En cours'),
        ('complete',   'Terminé'),
        ('expire',     'Expiré'),
    ]
    employee    = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name='formations')
    formation   = models.ForeignKey(Training, on_delete=models.CASCADE, related_name='participants')
    statut      = models.CharField(max_length=20, choices=STATUTS, default='non_commence')
    progression = models.PositiveIntegerField(default=0, help_text="0-100%")
    date_debut  = models.DateTimeField(null=True, blank=True)
    date_fin    = models.DateTimeField(null=True, blank=True)
    temps_passe_min = models.PositiveIntegerField(default=0)
    # Modules complétés
    modules_completes = models.ManyToManyField(TrainingModule, blank=True)
    certification_valide_jusqu = models.DateField(null=True, blank=True)

    class Meta:
        app_label = 'induction'
        unique_together = ('employee', 'formation')
        ordering = ['-created_at']
        verbose_name = 'Formation employé'

    def __str__(self):
        return f"{self.employee.nom_complet} — {self.formation.titre} ({self.progression}%)"

    def completer_module(self, module):
        self.modules_completes.add(module)
        total = self.formation.modules.filter(obligatoire=True).count()
        done  = self.modules_completes.filter(obligatoire=True).count()
        self.progression = int(done / total * 100) if total else 100
        if self.progression >= 100:
            self.statut = 'complete'
            self.date_fin = timezone.now()
        elif self.statut == 'non_commence':
            self.statut = 'en_cours'
            self.date_debut = timezone.now()
        self.save(update_fields=['progression','statut','date_debut','date_fin'])
