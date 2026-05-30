"""
Base models: Site, Camp, Zone, Contractor
Compatible PostGIS + Render PostgreSQL
"""
import uuid
from django.db import models
from django.contrib.auth import get_user_model

User = get_user_model()



class TimeStampMixin(models.Model):
    """Mixin audit trail pour tous les modèles."""
    created_at  = models.DateTimeField(auto_now_add=True)
    updated_at  = models.DateTimeField(auto_now=True)
    created_by  = models.ForeignKey(User, null=True, blank=True,
                    on_delete=models.SET_NULL, related_name='%(class)s_created')

    class Meta:
        app_label = 'induction'
        abstract = True


class Site(TimeStampMixin):
    """Site minier principal."""
    id          = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    code        = models.CharField(max_length=20, unique=True, help_text="Ex: SGO-01")
    nom         = models.CharField(max_length=200)
    pays        = models.CharField(max_length=100, default='Côte d\'Ivoire')
    region      = models.CharField(max_length=100, blank=True)
    adresse     = models.TextField(blank=True)
    # Coordonnées (PostGIS optionnel)
    latitude    = models.DecimalField(max_digits=10, decimal_places=7, null=True, blank=True)
    longitude   = models.DecimalField(max_digits=10, decimal_places=7, null=True, blank=True)
    # Config induction
    quiz_score_min      = models.PositiveIntegerField(default=80, help_text="Score minimum quiz QHSE (%)")
    medical_validite_j  = models.PositiveIntegerField(default=365, help_text="Validité médicale en jours")
    badge_validite_j    = models.PositiveIntegerField(default=365, help_text="Validité badge en jours")
    induction_obligatoire = models.BooleanField(default=True)
    actif       = models.BooleanField(default=True)
    # Responsables
    superviseurs = models.ManyToManyField(User, blank=True, related_name='sites_supervises')

    class Meta:
        app_label = 'induction'
        ordering = ['nom']
        verbose_name = 'Site minier'
        verbose_name_plural = 'Sites miniers'

    def __str__(self):
        return f"[{self.code}] {self.nom}"


class Camp(TimeStampMixin):
    """Camp d'hébergement rattaché à un site."""
    id      = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    site    = models.ForeignKey(Site, on_delete=models.CASCADE, related_name='camps')
    nom     = models.CharField(max_length=200)
    code    = models.CharField(max_length=20)
    capacite = models.PositiveIntegerField(default=0)
    actif   = models.BooleanField(default=True)

    class Meta:
        app_label = 'induction'
        unique_together = ('site', 'code')
        ordering = ['nom']
        verbose_name = 'Camp'

    def __str__(self):
        return f"{self.site.code} / {self.nom}"


class Zone(TimeStampMixin):
    """Zone d'accès (mine, bureau, zone restreinte)."""
    TYPES = [
        ('open',       'Zone ouverte'),
        ('restricted', 'Zone restreinte'),
        ('hazardous',  'Zone dangereuse'),
        ('admin',      'Zone administrative'),
    ]
    id          = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    site        = models.ForeignKey(Site, on_delete=models.CASCADE, related_name='zones')
    nom         = models.CharField(max_length=200)
    type_zone   = models.CharField(max_length=20, choices=TYPES, default='open')
    description = models.TextField(blank=True)
    induction_requise = models.BooleanField(default=True)
    actif       = models.BooleanField(default=True)

    class Meta:
        app_label = 'induction'
        ordering = ['nom']
        verbose_name = 'Zone'

    def __str__(self):
        return f"{self.site.code} / {self.nom}"


class Contractor(TimeStampMixin):
    """Société sous-traitante."""
    id          = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    nom         = models.CharField(max_length=200)
    code        = models.CharField(max_length=20, unique=True)
    pays        = models.CharField(max_length=100, blank=True)
    contact_nom = models.CharField(max_length=200, blank=True)
    contact_tel = models.CharField(max_length=50, blank=True)
    contact_email = models.EmailField(blank=True)
    actif       = models.BooleanField(default=True)
    sites       = models.ManyToManyField(Site, blank=True, related_name='contractors')

    class Meta:
        app_label = 'induction'
        ordering = ['nom']
        verbose_name = 'Sous-traitant'
        verbose_name_plural = 'Sous-traitants'

    def __str__(self):
        return f"[{self.code}] {self.nom}"
