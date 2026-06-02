"""
Employee model — Employé/Sous-traitant/Visiteur/Consultant
"""
import uuid
from django.db import models
from django.contrib.auth import get_user_model
from .base import Site, Camp, Contractor, TimeStampMixin

User = get_user_model()


class Employee(TimeStampMixin):
    """Personne arrivant sur le site (induction requise)."""

    TYPE_CHOICES = [
        ('employe',     'Employé'),
        ('soustraitant','Sous-traitant'),
        ('visiteur',    'Visiteur'),
        ('consultant',  'Consultant'),
        ('stagiaire',   'Stagiaire'),
    ]
    GENRE_CHOICES = [('M','Masculin'),('F','Féminin'),('A','Autre')]
    STATUT_CHOICES = [
        ('en_attente', 'En attente'),
        ('en_cours',   'En cours d\'induction'),
        ('valide',     'Validé — accès autorisé'),
        ('refuse',     'Refusé — accès interdit'),
        ('expire',     'Expiré'),
        ('suspendu',   'Suspendu'),
    ]

    id              = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user            = models.OneToOneField(User, null=True, blank=True,
                        on_delete=models.SET_NULL, related_name='employee_profile')
    # Identité
    nom             = models.CharField(max_length=150)
    prenom          = models.CharField(max_length=150)
    genre           = models.CharField(max_length=1, choices=GENRE_CHOICES, blank=True)
    date_naissance  = models.DateField(null=True, blank=True)
    nationalite     = models.CharField(max_length=100, blank=True)
    # Contact
    email           = models.EmailField(unique=True)
    telephone       = models.CharField(max_length=50, blank=True)
    # Classification
    type_employe    = models.CharField(max_length=20, choices=TYPE_CHOICES, default='employe')
    matricule       = models.CharField(max_length=50, blank=True, unique=True, null=True)
    poste           = models.CharField(max_length=200, blank=True)
    departement     = models.CharField(max_length=200, blank=True)
    # Affectation
    site            = models.ForeignKey(Site, on_delete=models.PROTECT,
                        related_name='employees', null=True, blank=True)
    camp            = models.ForeignKey(Camp, on_delete=models.SET_NULL,
                        null=True, blank=True, related_name='residents')
    contractor      = models.ForeignKey(Contractor, on_delete=models.SET_NULL,
                        null=True, blank=True, related_name='employes')
    # Dates
    date_arrivee    = models.DateField(null=True, blank=True)
    date_depart_prevue = models.DateField(null=True, blank=True)
    # Photo
    photo           = models.ImageField(upload_to='induction/photos/%Y/%m/', blank=True, null=True)
    photo_base64    = models.TextField(blank=True, default='')  # fallback mobile
    # Statut global
    statut          = models.CharField(max_length=20, choices=STATUT_CHOICES, default='en_attente')
    actif           = models.BooleanField(default=True)

    class Meta:
        app_label = 'induction'
        ordering = ['nom', 'prenom']
        verbose_name = 'Employé'
        verbose_name_plural = 'Employés'
        indexes = [
            models.Index(fields=['email']),
            models.Index(fields=['matricule']),
            models.Index(fields=['site', 'statut']),
            models.Index(fields=['type_employe']),
        ]

    def __str__(self):
        return f"{self.nom} {self.prenom} ({self.get_type_employe_display()})"

    @property
    def nom_complet(self):
        return f"{self.prenom} {self.nom}"

    @property
    def induction_complete(self):
        try:
            return self.workflow.statut == 'complet'
        except Exception:
            return False


class EmergencyContact(models.Model):
    """Contact d'urgence pour un employé."""
    employee    = models.ForeignKey(Employee, on_delete=models.CASCADE,
                    related_name='contacts_urgence')
    nom_complet = models.CharField(max_length=200)
    relation    = models.CharField(max_length=100, help_text="Ex: Épouse, Parent, Ami")
    telephone   = models.CharField(max_length=50)
    telephone_2 = models.CharField(max_length=50, blank=True)
    email       = models.EmailField(blank=True)

    class Meta:
        app_label = 'induction'
        verbose_name = 'Contact d\'urgence'

    def __str__(self):
        return f"{self.nom_complet} ({self.relation}) — {self.employee}"
