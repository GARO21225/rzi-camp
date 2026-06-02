
from django.db import models
from django.contrib.auth.models import User
from simple_history.models import HistoricalRecords

class Demande(models.Model):
    TYPE_CHOICES = [
        ("reservation_residence", "Réservation de résidence"),
        ("voyage", "Planification de voyage"),
        ("maintenance", "Signalement maintenance"),
    ]
    STATUT_CHOICES = [
        ("en_attente", "En attente de validation"),
        ("validee", "Validée par l'admin"),
        ("rejetee", "Rejetée par l'admin"),
        ("proposition", "Proposition admin — En attente réponse"),
        ("acceptee", "Proposition acceptée"),
        ("annulee", "Annulée par le demandeur"),
    ]

    type_demande = models.CharField(max_length=30, choices=TYPE_CHOICES)
    statut = models.CharField(max_length=20, choices=STATUT_CHOICES, default="en_attente")
    demandeur = models.ForeignKey(User, on_delete=models.CASCADE, related_name="demandes_soumises")
    traite_par = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name="demandes_traitees")

    # Payload JSON: contient les détails de la demande
    donnees = models.JSONField(default=dict)

    # Résidence demandée
    residence_souhaitee = models.CharField(max_length=20, blank=True)
    residence_attribuee = models.CharField(max_length=20, blank=True)

    # Message & commentaires
    message_demandeur = models.TextField(blank=True)
    commentaire_admin = models.TextField(blank=True)
    proposition_admin = models.JSONField(default=dict, blank=True)

    # Dates
    date_debut_souhaitee = models.DateField(null=True, blank=True)
    date_fin_souhaitee = models.DateField(null=True, blank=True)

    date_creation = models.DateTimeField(auto_now_add=True)
    date_traitement = models.DateTimeField(null=True, blank=True)
    date_reponse = models.DateTimeField(null=True, blank=True)

    history = HistoricalRecords()

    class Meta:
        ordering = ["-date_creation"]
        verbose_name = "Demande"

    def __str__(self):
        return f"[{self.get_type_demande_display()}] {self.demandeur.get_full_name()} — {self.get_statut_display()}"

    def notifier_admin(self):
        """Notifie tous les admins d'une nouvelle demande"""
        from accounts.models import Profile
        from evenements.models import Notification
        admins = User.objects.filter(is_staff=True)
        for admin in admins:
            if hasattr(admin, "personnel"):
                Notification.objects.create(
                    personnel=admin.personnel,
                    titre=f"📋 Nouvelle demande: {self.get_type_demande_display()}",
                    message=f"De: {self.demandeur.get_full_name()}\nMessage: {self.message_demandeur[:100]}",
                    type_notif="systeme",
                )

    def notifier_demandeur(self, message):
        """Notifie le demandeur du traitement"""
        from evenements.models import Notification
        if hasattr(self.demandeur, "personnel"):
            Notification.objects.create(
                personnel=self.demandeur.personnel,
                titre=f"📋 Demande traitée: {self.get_statut_display()}",
                message=message,
                type_notif="systeme",
            )
