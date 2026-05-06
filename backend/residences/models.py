from django.db import models
from django.contrib.auth.models import User
from simple_history.models import HistoricalRecords

class Batiment(models.Model):
    STATUT_CHOICES = [
        ('Libre', 'Libre'),
        ('Occupé', 'Occupé'),
        ('Réservé', 'Réservé'),
        ('Maintenance', 'Maintenance'),
    ]
    residence = models.CharField(max_length=20, unique=True)
    bloc = models.CharField(max_length=30)
    statut = models.CharField(max_length=20, choices=STATUT_CHOICES, default='Libre')
    occupant = models.CharField(max_length=100, blank=True, null=True)
    societe = models.CharField(max_length=100, blank=True, null=True)
    date_affectation = models.DateField(blank=True, null=True)
    latitude = models.FloatField(blank=True, null=True)
    longitude = models.FloatField(blank=True, null=True)
    geojson_geometry = models.JSONField(blank=True, null=True)
    history = HistoricalRecords()

    class Meta:
        ordering = ['bloc', 'residence']
        verbose_name = 'Bâtiment'

    def __str__(self):
        return f"{self.residence} — {self.bloc} ({self.statut})"
