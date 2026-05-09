
from django.db import models
from django.contrib.auth.models import User
from simple_history.models import HistoricalRecords
import base64

class Incident(models.Model):
    PRIORITE = [("haute","Haute"),("moyenne","Moyenne"),("basse","Basse")]
    STATUT = [("Ouvert","Ouvert"),("En cours","En cours"),("Résolu","Résolu")]
    CATEGORIE = [("Plomberie","Plomberie"),("Électricité","Électricité"),
                 ("Serrurerie","Serrurerie"),("Climatisation","Climatisation"),
                 ("Toiture","Toiture"),("Autre","Autre")]

    titre = models.CharField(max_length=200)
    description = models.TextField()
    categorie = models.CharField(max_length=50, choices=CATEGORIE)
    priorite = models.CharField(max_length=20, choices=PRIORITE, default="moyenne")
    statut = models.CharField(max_length=20, choices=STATUT, default="Ouvert")
    residence = models.CharField(max_length=20)
    bloc = models.CharField(max_length=30, blank=True)
    auteur = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name="incidents")
    assigne_a = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name="incidents_assignes")
    # Store photo as base64 in DB — survives Render restarts
    photo_base64 = models.TextField(blank=True, default="")
    photo_mime = models.CharField(max_length=50, blank=True, default="image/jpeg")
    photo_resolution_base64 = models.TextField(blank=True, default="")
    latitude = models.FloatField(blank=True, null=True)
    longitude = models.FloatField(blank=True, null=True)
    date_creation = models.DateTimeField(auto_now_add=True)
    date_resolution = models.DateTimeField(blank=True, null=True)
    history = HistoricalRecords()

    class Meta:
        ordering = ["-date_creation"]

    def __str__(self):
        return f"[{self.priorite.upper()}] {self.titre}"

    @property
    def photo_data_url(self):
        if self.photo_base64:
            return f"data:{self.photo_mime};base64,{self.photo_base64}"
        return None
