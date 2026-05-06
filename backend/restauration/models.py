from django.db import models
from django.contrib.auth.models import User
from simple_history.models import HistoricalRecords
import secrets, hashlib, time

class QRToken(models.Model):
    token = models.CharField(max_length=64, unique=True)
    residence = models.CharField(max_length=20)
    resident = models.CharField(max_length=100)
    genere_par = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    cree_le = models.DateTimeField(auto_now_add=True)
    expire_le = models.DateTimeField()
    utilise = models.BooleanField(default=False)
    utilise_le = models.DateTimeField(blank=True, null=True)
    device_id = models.CharField(max_length=200, blank=True)

    @staticmethod
    def generer(residence, resident, genere_par, duree_secondes=45):
        from django.utils import timezone
        from datetime import timedelta
        raw = secrets.token_hex(16)
        sig = hashlib.hmac_new('sha256', raw.encode(), b'rzi-camp-secret').hexdigest()[:16]
        token = f"{raw[:8]}-{sig}"
        expire = timezone.now() + timedelta(seconds=duree_secondes)
        return QRToken.objects.create(token=token, residence=residence, resident=resident,
                                      genere_par=genere_par, expire_le=expire)

    def __str__(self):
        return f"QR {self.token[:8]}... — {self.resident} ({self.residence})"

class RepasLog(models.Model):
    qr_token = models.OneToOneField(QRToken, on_delete=models.CASCADE, related_name='repas')
    valide_par = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    date_validation = models.DateTimeField(auto_now_add=True)
    history = HistoricalRecords()

    class Meta:
        ordering = ['-date_validation']

class AuditLog(models.Model):
    utilisateur = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    action = models.CharField(max_length=100)
    module = models.CharField(max_length=50)
    detail = models.TextField(blank=True)
    ip = models.GenericIPAddressField(blank=True, null=True)
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-timestamp']

    def __str__(self):
        return f"[{self.timestamp}] {self.action} — {self.utilisateur}"
