
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


# ── Bar & Boutique ──────────────────────────────────────────────────
class ArticleBoutique(models.Model):
    nom        = models.CharField(max_length=150)
    categorie  = models.CharField(max_length=50, default='autre')
    prix       = models.DecimalField(max_digits=10, decimal_places=0, default=0)
    stock      = models.IntegerField(default=0)
    unite      = models.CharField(max_length=30, default='pièce')
    actif      = models.BooleanField(default=True)
    image_url  = models.TextField(blank=True, default='')   # URL externe OU data:image/... base64
    cree_le    = models.DateTimeField(auto_now_add=True)

    def __str__(self): return f"{self.nom} ({self.prix} FCFA)"

class ConsommationBoutique(models.Model):
    from residences.models import Personnel
    personnel  = models.ForeignKey('residences.Personnel', on_delete=models.SET_NULL, null=True, blank=True)
    article    = models.ForeignKey(ArticleBoutique, on_delete=models.CASCADE)
    quantite   = models.IntegerField(default=1)
    montant    = models.DecimalField(max_digits=10, decimal_places=0, default=0)
    notes      = models.TextField(blank=True)
    valide_par = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    date_conso = models.DateTimeField(auto_now_add=True)

    def save(self, *args, **kwargs):
        self.montant = self.article.prix * self.quantite
        super().save(*args, **kwargs)

    def __str__(self): return f"{self.article.nom} x{self.quantite}"


class BonCaisse(models.Model):
    """Ticket de caisse annuel — 100 000 FCFA par résident"""
    personnel      = models.ForeignKey('residences.Personnel', on_delete=models.CASCADE, related_name='bons_caisse')
    annee          = models.IntegerField(default=2026)
    credit_initial = models.DecimalField(max_digits=10, decimal_places=0, default=100000)
    credit_restant = models.DecimalField(max_digits=10, decimal_places=0, default=100000)
    cree_le        = models.DateTimeField(auto_now_add=True)
    mis_a_jour     = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('personnel', 'annee')
        ordering = ['-annee']

    def __str__(self):
        return f"{self.personnel} — {self.annee} — {self.credit_restant} FCFA restants"

    @property
    def credit_utilise(self):
        return self.credit_initial - self.credit_restant

    @property
    def pourcentage_utilise(self):
        if self.credit_initial == 0: return 0
        return int((self.credit_utilise / self.credit_initial) * 100)

    @classmethod
    def get_or_create_for_year(cls, personnel, annee=None):
        """Obtenir ou créer le bon de l'année courante"""
        from django.utils import timezone
        if annee is None:
            annee = timezone.now().year
        bon, created = cls.objects.get_or_create(
            personnel=personnel, annee=annee,
            defaults={'credit_initial': 100000, 'credit_restant': 100000}
        )
        return bon, created

    def deduire(self, montant):
        """Déduire un montant du crédit restant"""
        self.credit_restant = max(0, self.credit_restant - montant)
        self.save(update_fields=['credit_restant', 'mis_a_jour'])
        return self.credit_restant


class MenuJour(models.Model):
    """Menu du jour/semaine pour la restauration."""
    TYPES = [
        ('entree',   'Entrée'),
        ('plat',     'Plat principal'),
        ('dessert',  'Dessert'),
        ('boisson',  'Boisson'),
        ('special',  'Plat spécial'),
    ]
    nom         = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    type_plat   = models.CharField(max_length=20, choices=TYPES, default='plat')
    date_service = models.DateField()
    repas        = models.CharField(max_length=20, choices=[
        ('matin','Petit déjeuner'), ('midi','Déjeuner'), ('soir','Dîner')
    ], default='midi')
    disponible  = models.BooleanField(default=True)
    image_url   = models.URLField(blank=True)
    created_at  = models.DateTimeField(auto_now_add=True)
    updated_at  = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['date_service', 'repas', 'type_plat']
        verbose_name = 'Menu du jour'

    def __str__(self):
        return f"{self.date_service} — {self.get_repas_display()} — {self.nom}"
