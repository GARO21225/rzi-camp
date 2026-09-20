
from django.db import models
from django.contrib.auth.models import User
from residences.models import Personnel, Batiment
from simple_history.models import HistoricalRecords

class Evenement(models.Model):
    TYPE_CHOICES = [
        ("reunion","Réunion"),("securite","Sécurité"),("formation","Formation"),
        ("social","Social / Loisir"),("sport","Sport"),("alerte","Alerte"),
        ("maintenance","Maintenance campus"),("autre","Autre"),
    ]
    STATUT = [("planifie","Planifié"),("en_cours","En cours"),("termine","Terminé"),("annule","Annulé")]

    titre = models.CharField(max_length=200)
    description = models.TextField()
    type_event = models.CharField(max_length=30, choices=TYPE_CHOICES, default="reunion")
    statut = models.CharField(max_length=20, choices=STATUT, default="planifie")
    date_debut = models.DateTimeField()
    date_fin = models.DateTimeField(blank=True, null=True)
    lieu = models.CharField(max_length=200, blank=True)
    image_base64 = models.TextField(blank=True, default="")
    obligatoire = models.BooleanField(default=False)
    qr_requis = models.BooleanField(default=False,
                 help_text="Genere un QR individuel a usage unique par personne pour l'acces a cet evenement (ex: barbecue) - une fois scanne, le code ne peut plus etre reutilise")
    propose_boisson = models.BooleanField(default=False,
                 help_text="Proposer un choix alcool/sucrerie a la generation du QR de chaque personne, pour la logistique de l'evenement")
    cree_par = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name="evenements_crees")
    date_creation = models.DateTimeField(auto_now_add=True)
    history = HistoricalRecords()

    class Meta:
        ordering = ["-date_debut"]
        verbose_name = "Evenement"

    def __str__(self):
        return self.titre

    def notifier_residents(self):
        """Crée une notification pour tous les résidents actifs"""
        residents = Personnel.objects.filter(
            batiments__statut="Occupé"
        ).distinct()
        created = 0
        for p in residents:
            _, ok = Notification.objects.get_or_create(
                evenement=self, personnel=p,
                defaults={"envoye_par": self.cree_par}
            )
            if ok: created += 1
        return created


class Notification(models.Model):
    evenement = models.ForeignKey(Evenement, on_delete=models.CASCADE, related_name="notifications")
    personnel = models.ForeignKey(Personnel, on_delete=models.CASCADE, related_name="notifications")
    lu = models.BooleanField(default=False)
    date_lecture = models.DateTimeField(blank=True, null=True)
    envoye_par = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    date_envoi = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-date_envoi"]
        unique_together = [["evenement","personnel"]]

    def __str__(self):
        return f"Notif {self.personnel} — {self.evenement.titre}"


class AlerteCampus(models.Model):
    """Messages d'alerte urgents affichés à tous les connectés"""
    TYPE = [("info","Info"),("warning","Attention"),("danger","Urgent"),("success","OK")]
    message = models.TextField()
    type_alerte = models.CharField(max_length=20, choices=TYPE, default="info")
    active = models.BooleanField(default=True)
    cree_par = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    date_creation = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-date_creation"]

    def __str__(self):
        return f"[{self.type_alerte}] {self.message[:50]}"


class SimpleNotification(models.Model):
    """System notification not tied to a specific event"""
    TYPE_CHOICES = [
        ("systeme","Système"),
        ("demande","Demande"),
        ("alerte","Alerte"),
        ("info","Info"),
    ]
    personnel = models.ForeignKey(
        "residences.Personnel", on_delete=models.CASCADE,
        related_name="simple_notifications", null=True, blank=True
    )
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="simple_notifications", null=True, blank=True)
    titre = models.CharField(max_length=200)
    message = models.TextField(blank=True)
    type_notif = models.CharField(max_length=20, choices=TYPE_CHOICES, default="systeme")
    lu = models.BooleanField(default=False)
    date_lecture = models.DateTimeField(blank=True, null=True)
    date_envoi = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-date_envoi"]

    def marquer_lue(self):
        from django.utils import timezone
        self.lu = True
        self.date_lecture = timezone.now()
        self.save(update_fields=["lu","date_lecture"])


class QREvenement(models.Model):
    """
    QR individuel a usage unique donnant acces a un evenement (ex:
    barbecue) - meme principe que QRToken/RepasLog en restauration : un
    token par personne, marque "utilise" des le premier scan, tout scan
    suivant du meme code est refuse ("deja scanne").
    """
    BOISSON_CHOICES = [("alcool","🍺 Alcool"),("sucrerie","🥤 Sucrerie / Sans alcool")]

    evenement   = models.ForeignKey(Evenement, on_delete=models.CASCADE, related_name="qr_codes")
    personnel   = models.ForeignKey(Personnel, on_delete=models.CASCADE, related_name="qr_evenements")
    token       = models.CharField(max_length=64, unique=True)
    preference_boisson = models.CharField(max_length=20, choices=BOISSON_CHOICES, blank=True, default="")
    cree_le     = models.DateTimeField(auto_now_add=True)
    utilise     = models.BooleanField(default=False)
    utilise_le  = models.DateTimeField(blank=True, null=True)
    valide_par  = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name="qr_evenements_valides")

    class Meta:
        ordering = ["-cree_le"]
        unique_together = [["evenement", "personnel"]]  # un seul QR par personne par evenement

    def __str__(self):
        return f"QR {self.evenement.titre} - {self.personnel}"

