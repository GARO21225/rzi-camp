
from django.db import models
from django.contrib.auth.models import User
from residences.models import Personnel, Batiment
from simple_history.models import HistoricalRecords

class Voyage(models.Model):
    STATUT = [
        ("planifie","Planifié"),
        ("en_voyage","En voyage"),
        ("retour","Retour au camp"),
        ("annule","Annulé"),
    ]
    personnel = models.ForeignKey(Personnel, on_delete=models.CASCADE, related_name="voyages")
    batiment = models.ForeignKey(Batiment, on_delete=models.SET_NULL, null=True, blank=True, related_name="voyages")
    destination = models.CharField(max_length=200, blank=True)
    motif = models.TextField(blank=True)
    date_depart = models.DateField()
    date_retour_prevue = models.DateField()
    date_retour_effective = models.DateField(blank=True, null=True)
    statut = models.CharField(max_length=20, choices=STATUT, default="planifie")
    enregistre_par = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-date_depart"]
        verbose_name = "Voyage"

    def __str__(self):
        return f"{self.personnel} - depart {self.date_depart}"

    def partir(self):
        """Libere la chambre au depart"""
        from residences.models import OccupationHistory
        import datetime
        if self.batiment:
            b = self.batiment
            # Clore historique occupation
            OccupationHistory.objects.filter(batiment=b, personnel=self.personnel, date_depart__isnull=True).update(
                date_depart=self.date_depart, motif_depart="Voyage"
            )
            b.statut = "Libre"
            b.personnel = None
            b.occupant = None
            b.date_arrivee = None
            b.date_depart = None
            b.save()
        self.statut = "en_voyage"
        self.save()

    def revenir(self, date_retour=None):
        """Reassigne la chambre au retour"""
        import datetime
        from residences.models import OccupationHistory
        today = date_retour or datetime.date.today()
        self.date_retour_effective = today
        self.statut = "retour"
        self.save()
        # Reassigner la chambre si elle est encore libre
        if self.batiment:
            b = self.batiment
            if b.statut == "Libre":
                b.statut = "Occupé"
                b.personnel = self.personnel
                b.occupant = f"{self.personnel.nom} {self.personnel.prenom}"
                b.societe = self.personnel.societe
                b.date_arrivee = today
                b.save()
                OccupationHistory.objects.create(
                    batiment=b, personnel=self.personnel,
                    occupant_nom=f"{self.personnel.nom} {self.personnel.prenom}",
                    societe=self.personnel.societe, date_arrivee=today,
                    enregistre_par_id=None
                )
