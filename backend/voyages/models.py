
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

    # ── Champs Rotation (convoi groupe) ──
    rotation_id       = models.CharField(max_length=50, blank=True, null=True, db_index=True,
                         help_text="ID partagé entre tous les voyageurs du même convoi")
    vehicule          = models.CharField(max_length=50, blank=True,
                         help_text="BUS-01, 4WD-02, VOL-AIR...")
    nb_places_total   = models.PositiveIntegerField(default=15, blank=True, null=True,
                         help_text="Capacité totale du véhicule pour ce convoi")
    heure_depart      = models.TimeField(null=True, blank=True,
                         help_text="Heure de départ prévue")
    point_rdv         = models.CharField(max_length=200, blank=True,
                         help_text="Point de rendez-vous / embarquement")
    type_voyage       = models.CharField(max_length=20, blank=True, default='individuel',
                         choices=[('individuel','Individuel'),('rotation','Rotation groupe'),
                                  ('urgence','Urgence'),('medical','Médical')])
    notes_admin       = models.TextField(blank=True,
                         help_text="Notes internes admin")

    # ── Workflow de validation (comme une vraie agence : demande -> validation) ──
    VALIDATION_CHOIX = [
        ("en_attente", "En attente de validation"),
        ("valide",     "Validé"),
        ("refuse",     "Refusé"),
    ]
    statut_validation = models.CharField(max_length=15, choices=VALIDATION_CHOIX, default="en_attente")
    valide_par        = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name="voyages_valides")
    date_validation   = models.DateTimeField(null=True, blank=True)
    motif_refus       = models.TextField(blank=True, default="")

    # Restaurée : présente dans les migrations historiques (0001/0002) mais
    # avait disparu du modèle sans jamais avoir été retirée proprement —
    # Django voulait supprimer purement et simplement la table d'historique.
    history = HistoricalRecords()

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


class EtapeVoyage(models.Model):
    """
    Un tronçon d'itinéraire (comme une vraie agence de voyage : plusieurs
    étapes possibles pour un même voyage — ex: Camp -> Aéroport en bus,
    puis Aéroport -> Abidjan en vol).
    """
    MODES = [
        ("bus",     "🚌 Bus"),
        ("4x4",     "🚙 4x4 / Véhicule tout-terrain"),
        ("avion",   "✈️ Avion"),
        ("bateau",  "⛴️ Bateau"),
        ("a_pied",  "🚶 À pied"),
        ("autre",   "🚐 Autre"),
    ]
    voyage        = models.ForeignKey(Voyage, on_delete=models.CASCADE, related_name="etapes")
    ordre         = models.PositiveIntegerField(default=1)
    origine       = models.CharField(max_length=200)
    destination   = models.CharField(max_length=200)
    mode_transport= models.CharField(max_length=15, choices=MODES, default="bus")
    date_etape    = models.DateField()
    heure_depart  = models.TimeField(null=True, blank=True)
    heure_arrivee_prevue = models.TimeField(null=True, blank=True)
    point_rdv     = models.CharField(max_length=200, blank=True, default="")
    reference     = models.CharField(max_length=100, blank=True, default="",
                     help_text="Numéro de vol, plaque du véhicule, référence de réservation...")
    notes         = models.TextField(blank=True, default="")

    class Meta:
        ordering = ["voyage", "ordre"]
        verbose_name = "Étape de voyage"

    def __str__(self):
        return f"Étape {self.ordre} — {self.origine} → {self.destination}"
