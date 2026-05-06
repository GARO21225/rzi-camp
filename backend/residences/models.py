
from django.db import models
from django.contrib.auth.models import User
from simple_history.models import HistoricalRecords
import qrcode, io, base64, unicodedata, re

def slugify_fr(text):
    """Remove accents and special chars"""
    text = unicodedata.normalize("NFD", text)
    text = "".join(c for c in text if unicodedata.category(c) != "Mn")
    return re.sub(r"[^a-z0-9]", "", text.lower())

class Personnel(models.Model):
    TYPE_CHOICES = [
        ("roxgold", "Agent Roxgold"),
        ("sous_traitant", "Sous-traitant"),
        ("visiteur", "Visiteur temporaire"),
    ]
    TYPE_PREFIX = {"roxgold": "a", "sous_traitant": "s", "visiteur": "v"}

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
    user = models.OneToOneField(User, on_delete=models.SET_NULL, null=True, blank=True, related_name="personnel")
    login_genere = models.CharField(max_length=100, blank=True)
    password_genere = models.CharField(max_length=100, blank=True)
    history = HistoricalRecords()

    class Meta:
        ordering = ["nom", "prenom"]
        verbose_name = "Personnel"

    def __str__(self):
        return f"{self.nom} {self.prenom} - {self.societe}"

    def generer_login_password(self):
        prefix = self.TYPE_PREFIX.get(self.type_personnel, "u")
        prenom_slug = slugify_fr(self.prenom)
        nom_init = slugify_fr(self.nom[0]) if self.nom else "x"
        username = f"{prefix}_{nom_init}{prenom_slug}"
        digits = re.sub(r"\D", "", self.numero)[-4:] if self.numero else "0000"
        password = f"{self.nom[0].upper()}{self.prenom[0].upper()}{digits}"
        return username, password

    def creer_utilisateur(self):
        username, password = self.generer_login_password()
        base_username = username
        counter = 1
        while User.objects.filter(username=username).exclude(pk=self.user_id if self.user else None).exists():
            username = f"{base_username}{counter}"
            counter += 1
        if self.user:
            u = self.user
            u.username = username
            u.set_password(password)
            u.first_name = self.prenom
            u.last_name = self.nom
            u.save()
        else:
            u = User.objects.create_user(
                username=username, password=password,
                first_name=self.prenom, last_name=self.nom
            )
            from accounts.models import Profile
            Profile.objects.get_or_create(user=u, defaults={"role": "agent", "societe": self.societe})
            self.user = u
        self.login_genere = username
        self.password_genere = password
        self.save(update_fields=["user", "login_genere", "password_genere"])
        return username, password

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
        self.save(update_fields=["qr_code_data", "qr_code_string"])

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        if not self.qr_code_data and self.pk:
            self.generer_qr()


class Batiment(models.Model):
    STATUT_CHOICES = [
        ("Libre", "Libre"),
        ("Occupé", "Occupé"),
        ("Réservé", "Réservé"),
        ("Maintenance", "Maintenance"),
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
        ordering = ["residence"]
        verbose_name = "Batiment"

    def __str__(self):
        return f"{self.residence} ({self.statut})"


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
