
from django.db import models
from django.contrib.auth.models import User
from simple_history.models import HistoricalRecords
import qrcode, io, base64

class Personnel(models.Model):
    TYPE_CHOICES = [
        ("roxgold","Agent Roxgold"),
        ("sous_traitant","Sous-traitant"),
        ("visiteur","Visiteur temporaire"),
    ]
    nom = models.CharField(max_length=100)
    prenom = models.CharField(max_length=100)
    societe = models.CharField(max_length=100)
    numero = models.CharField(max_length=20, blank=True)
    type_personnel = models.CharField(max_length=20, choices=TYPE_CHOICES, default="roxgold")
    email = models.EmailField(blank=True)
    qr_code_data = models.TextField(blank=True)
    qr_code_string = models.CharField(max_length=500, blank=True)
    actif = models.BooleanField(default=True)
    date_creation = models.DateTimeField(auto_now_add=True)
    history = HistoricalRecords()

    class Meta:
        ordering = ["nom","prenom"]
        verbose_name = "Personnel"

    def __str__(self):
        return f"{self.nom} {self.prenom} - {self.societe}"

    def generer_qr(self):
        qr_string = f"{self.nom}|{self.prenom}|{self.societe}|{self.numero}|{self.type_personnel}"
        self.qr_code_string = qr_string
        qr = qrcode.QRCode(version=1, box_size=8, border=2)
        qr.add_data(qr_string)
        qr.make(fit=True)
        img = qr.make_image(fill_color="black", back_color="white")
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        self.qr_code_data = base64.b64encode(buf.getvalue()).decode()
        self.save()

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        if not self.qr_code_data:
            self.generer_qr()


class Batiment(models.Model):
    STATUT_CHOICES = [
        ("Libre","Libre"),
        ("Occupé","Occupé"),
        ("Réservé","Réservé"),
        ("Maintenance","Maintenance"),
    ]
    residence = models.CharField(max_length=20, unique=True)
    bloc = models.CharField(max_length=30)
    statut = models.CharField(max_length=20, choices=STATUT_CHOICES, default="Libre")
    personnel = models.ForeignKey(Personnel, on_delete=models.SET_NULL, null=True, blank=True, related_name="batiments")
    occupant = models.CharField(max_length=100, blank=True, null=True)
    societe = models.CharField(max_length=100, blank=True, null=True)
    date_arrivee = models.DateField(blank=True, null=True)
    date_depart = models.DateField(blank=True, null=True)
    latitude = models.FloatField(blank=True, null=True)
    longitude = models.FloatField(blank=True, null=True)
    geojson_geometry = models.JSONField(blank=True, null=True)
    history = HistoricalRecords()

    class Meta:
        ordering = ["bloc","residence"]
        verbose_name = "Batiment"

    def __str__(self):
        return f"{self.residence} - {self.bloc} ({self.statut})"


class OccupationHistory(models.Model):
    batiment = models.ForeignKey(Batiment, on_delete=models.CASCADE, related_name="historique")
    personnel = models.ForeignKey(Personnel, on_delete=models.SET_NULL, null=True, blank=True, related_name="historique_residence")
    occupant_nom = models.CharField(max_length=200)
    societe = models.CharField(max_length=100, blank=True)
    date_arrivee = models.DateField()
    date_depart = models.DateField(blank=True, null=True)
    motif_depart = models.CharField(max_length=200, blank=True)
    enregistre_par = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-date_arrivee"]
        verbose_name = "Historique occupation"

    def __str__(self):
        return f"{self.batiment.residence} - {self.occupant_nom} ({self.date_arrivee})"
