
from django.db import models
from django.contrib.auth.models import User
from residences.models import Personnel, Batiment
from simple_history.models import HistoricalRecords

class GroupeDiffusion(models.Model):
    """
    Groupe de diffusion reutilisable pour cibler les notifications
    d'evenements - configure une fois dans Parametrage, choisi ensuite a
    la creation de chaque evenement (au lieu de refaire le choix "qui
    reçoit ca" a chaque fois, code en dur).
    """
    nom = models.CharField(max_length=100)
    description = models.CharField(max_length=255, blank=True, default="")
    # Filtres combinables (ET logique) - vide = pas de restriction sur ce critere.
    uniquement_residents_actifs = models.BooleanField(default=False,
        help_text="Seulement le personnel actuellement loge dans une chambre occupee")
    filtre_societe = models.CharField(max_length=100, blank=True, default="",
        help_text="Ex: ROXGOLD - vide = toutes societes")
    filtre_type_personnel = models.CharField(max_length=30, blank=True, default="",
        help_text="Ex: roxgold, sous_traitant, visiteur - vide = tous types")
    est_defaut = models.BooleanField(default=False,
        help_text="Pre-selectionne a la creation d'un nouvel evenement")
    date_creation = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["nom"]

    def __str__(self):
        return self.nom

    def personnel_cible(self):
        qs = Personnel.objects.filter(actif=True)
        if self.uniquement_residents_actifs:
            qs = qs.filter(batiments__statut="Occupé").distinct()
        if self.filtre_societe:
            qs = qs.filter(societe__iexact=self.filtre_societe)
        if self.filtre_type_personnel:
            qs = qs.filter(type_personnel=self.filtre_type_personnel)
        return qs


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
    groupe_diffusion = models.ForeignKey(GroupeDiffusion, on_delete=models.SET_NULL, null=True, blank=True,
                 related_name="evenements", help_text="Qui recoit la notification - configure dans Parametrage. Vide = comportement historique (residents actifs uniquement)")
    cree_par = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name="evenements_crees")
    date_creation = models.DateTimeField(auto_now_add=True)
    history = HistoricalRecords()

    class Meta:
        ordering = ["-date_debut"]
        verbose_name = "Evenement"

    def __str__(self):
        return self.titre

    def notifier_residents(self):
        """Crée une notification pour le public cible (groupe_diffusion choisi, ou repli historique)"""
        if self.groupe_diffusion:
            residents = self.groupe_diffusion.personnel_cible()
        else:
            # Comportement historique, inchange pour un evenement qui n'a
            # jamais eu de groupe choisi (avant l'ajout de ce systeme).
            residents = Personnel.objects.filter(batiments__statut="Occupé").distinct()
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

