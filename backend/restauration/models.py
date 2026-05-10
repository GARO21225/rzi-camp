
from django.db import models
from django.contrib.auth.models import User
from residences.models import Personnel
from simple_history.models import HistoricalRecords
import secrets, hashlib

class QRToken(models.Model):
    REPAS_CHOICES = [
        ("petit_dejeuner","Petit-déjeuner"),
        ("dejeuner","Déjeuner"),
        ("diner","Dîner"),
    ]
    token = models.CharField(max_length=64, unique=True)
    personnel = models.ForeignKey(Personnel, on_delete=models.SET_NULL, null=True, blank=True)
    residence = models.CharField(max_length=20, blank=True)
    resident = models.CharField(max_length=100)
    type_repas = models.CharField(max_length=20, choices=REPAS_CHOICES, default="dejeuner")
    genere_par = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name="qr_generes")
    cree_le = models.DateTimeField(auto_now_add=True)
    expire_le = models.DateTimeField()
    utilise = models.BooleanField(default=False)
    utilise_le = models.DateTimeField(blank=True, null=True)
    device_id = models.CharField(max_length=200, blank=True)

    def __str__(self):
        return f"QR {self.token[:8]} - {self.resident} ({self.type_repas})"


class RepasLog(models.Model):
    qr_token = models.OneToOneField(QRToken, on_delete=models.CASCADE, related_name="repas")
    personnel = models.ForeignKey(Personnel, on_delete=models.SET_NULL, null=True, blank=True, related_name="repas_pris")
    valide_par = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    date_validation = models.DateTimeField(auto_now_add=True)
    history = HistoricalRecords()

    class Meta:
        ordering = ["-date_validation"]

    def __str__(self):
        return f"{self.qr_token.resident} - {self.qr_token.type_repas} - {self.date_validation}"


class AuditLog(models.Model):
    utilisateur = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    action = models.CharField(max_length=100)
    module = models.CharField(max_length=50)
    detail = models.TextField(blank=True)
    ip = models.GenericIPAddressField(blank=True, null=True)
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-timestamp"]
