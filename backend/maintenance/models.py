from django.db import models
from django.contrib.auth.models import User
from simple_history.models import HistoricalRecords

class Incident(models.Model):
    PRIORITE = [('haute','Haute'),('moyenne','Moyenne'),('basse','Basse')]
    STATUT = [('Ouvert','Ouvert'),('En cours','En cours'),('Résolu','Résolu')]
    CATEGORIE = [('Plomberie','Plomberie'),('Électricité','Électricité'),('Serrurerie','Serrurerie'),('Climatisation','Climatisation'),('Toiture','Toiture'),('Autre','Autre')]

    titre = models.CharField(max_length=200)
    description = models.TextField()
    categorie = models.CharField(max_length=50, choices=CATEGORIE)
    priorite = models.CharField(max_length=20, choices=PRIORITE, default='moyenne')
    statut = models.CharField(max_length=20, choices=STATUT, default='Ouvert')
    residence = models.CharField(max_length=20)
    bloc = models.CharField(max_length=30, blank=True)
    auteur = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='incidents')
    assigne_a = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='incidents_assignes')
    photo = models.ImageField(upload_to='incidents/', blank=True, null=True)
    latitude = models.FloatField(blank=True, null=True)
    longitude = models.FloatField(blank=True, null=True)
    date_creation = models.DateTimeField(auto_now_add=True)
    date_resolution = models.DateTimeField(blank=True, null=True)
    history = HistoricalRecords()

    class Meta:
        ordering = ['-date_creation']

    def __str__(self):
        return f"[{self.priorite.upper()}] {self.titre}"
