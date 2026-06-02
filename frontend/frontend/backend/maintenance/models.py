from django.db import models
from django.contrib.auth.models import User
from simple_history.models import HistoricalRecords
from django.utils import timezone
import base64

# ── SLA par priorité (heures) ────────────────────────────────────
SLA_HEURES = {
    'critique': 2,
    'haute':    8,
    'moyenne':  24,
    'basse':    72,
}

class Incident(models.Model):
    PRIORITE = [
        ('critique', '🔴 Critique'),
        ('haute',    '🟠 Haute'),
        ('moyenne',  '🟡 Moyenne'),
        ('basse',    '🟢 Basse'),
    ]
    STATUT = [
        ('declare',       'Déclaré'),
        ('assigne',       'Assigné'),
        ('en_cours',      'En cours'),
        ('resolu',        'Résolu'),
        ('cloture',       'Clôturé'),
        ('annule',        'Annulé'),
    ]
    CATEGORIE = [
        ('Plomberie',     'Plomberie'),
        ('Electricite',   'Électricité'),
        ('Serrurerie',    'Serrurerie'),
        ('Climatisation', 'Climatisation'),
        ('Toiture',       'Toiture'),
        ('Informatique',  'Informatique'),
        ('Generateur',    'Générateur'),
        ('Vehicule',      'Véhicule'),
        ('Autre',         'Autre'),
    ]

    # Identité
    titre       = models.CharField(max_length=200)
    description = models.TextField()
    categorie   = models.CharField(max_length=50, choices=CATEGORIE)
    priorite    = models.CharField(max_length=20, choices=PRIORITE, default='moyenne')
    statut      = models.CharField(max_length=20, choices=STATUT, default='declare')

    # Localisation
    residence   = models.CharField(max_length=20)
    bloc        = models.CharField(max_length=30, blank=True)

    # Acteurs
    auteur      = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='incidents_crees')
    assigne_a   = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='incidents_assignes')

    # Photos
    photo_base64            = models.TextField(blank=True, default='')
    photo_mime              = models.CharField(max_length=50, blank=True, default='image/jpeg')
    photo_resolution_base64 = models.TextField(blank=True, default='')

    # GPS
    latitude  = models.FloatField(blank=True, null=True)
    longitude = models.FloatField(blank=True, null=True)

    # Dates workflow
    date_creation    = models.DateTimeField(auto_now_add=True)
    date_assignation = models.DateTimeField(blank=True, null=True)
    date_debut       = models.DateTimeField(blank=True, null=True)
    date_resolution  = models.DateTimeField(blank=True, null=True)
    date_cloture     = models.DateTimeField(blank=True, null=True)

    # SLA
    sla_echeance      = models.DateTimeField(blank=True, null=True)
    sla_depasse       = models.BooleanField(default=False)
    sla_notification_envoyee = models.BooleanField(default=False)

    # Commentaires
    commentaire_resolution = models.TextField(blank=True)
    commentaire_cloture    = models.TextField(blank=True)

    history = HistoricalRecords()

    class Meta:
        ordering = ['-date_creation']

    def __str__(self):
        return f"[{self.get_priorite_display()}] {self.titre}"

    def save(self, *args, **kwargs):
        # Calculer SLA à la création
        if not self.pk and not self.sla_echeance:
            heures = SLA_HEURES.get(self.priorite, 24)
            self.sla_echeance = timezone.now() + timezone.timedelta(hours=heures)
        # Vérifier dépassement SLA
        if self.sla_echeance and self.statut not in ('resolu', 'cloture', 'annule'):
            self.sla_depasse = timezone.now() > self.sla_echeance
        super().save(*args, **kwargs)

    @property
    def photo_data_url(self):
        if self.photo_base64:
            return f"data:{self.photo_mime};base64,{self.photo_base64}"
        return None

    @property
    def temps_ecoule_h(self):
        """Heures depuis la création"""
        delta = timezone.now() - self.date_creation
        return round(delta.total_seconds() / 3600, 1)

    @property
    def sla_restant_h(self):
        """Heures avant dépassement SLA (négatif si dépassé)"""
        if not self.sla_echeance:
            return None
        delta = self.sla_echeance - timezone.now()
        return round(delta.total_seconds() / 3600, 1)


class CommentaireIncident(models.Model):
    """Historique des interventions sur un incident"""
    TYPE_CHOICES = [
        ('info',        'Information'),
        ('assignation', 'Assignation'),
        ('debut',       'Début intervention'),
        ('photo_avant', '📷 Photo avant intervention'),
        ('photo_apres', '📷 Photo après intervention'),
        ('resolution',  'Résolution'),
        ('cloture',     'Clôture'),
        ('escalade',    'Escalade'),
        ('relance',     'Relance SLA'),
    ]
    incident      = models.ForeignKey(Incident, on_delete=models.CASCADE, related_name='commentaires')
    auteur        = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    type_comment  = models.CharField(max_length=20, choices=TYPE_CHOICES, default='info')
    contenu       = models.TextField()
    date_creation = models.DateTimeField(auto_now_add=True)
    photo_base64  = models.TextField(blank=True)

    class Meta:
        ordering = ['date_creation']

    def __str__(self):
        return f"[{self.get_type_comment_display()}] {self.incident.titre}"
