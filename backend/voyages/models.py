
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
    origine     = models.CharField(max_length=200, blank=True, default="Camp Roxgold Sango",
                   help_text="Point de départ réel — pas toujours le camp (ex: premier voyage d'un nouvel employé, qui part de chez lui VERS le camp)")
    lieu_montee_retour   = models.CharField(max_length=200, blank=True, default="",
                   help_text="Où CE passager monte precisement pour le RETOUR, si different du reste du convoi (ex: recupere en cours de route) — vide = meme point que le convoi")
    lieu_descente_retour = models.CharField(max_length=200, blank=True, default="",
                   help_text="Où CE passager descend precisement pour le RETOUR, si different (ex: depose avant l'arrivee finale du convoi) — vide = destination normale (origine)")
    motif = models.TextField(blank=True)
    date_depart = models.DateField()
    date_depart_effective = models.DateField(blank=True, null=True)
    date_retour_prevue = models.DateField()
    date_retour_effective = models.DateField(blank=True, null=True)
    statut = models.CharField(max_length=20, choices=STATUT, default="planifie", db_index=True)
    enregistre_par = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    # ── Champs Rotation (convoi groupe) ──
    rotation_id       = models.CharField(max_length=50, blank=True, null=True, db_index=True,
                         help_text="ID partagé entre tous les voyageurs du même convoi")
    vehicule          = models.CharField(max_length=50, blank=True,
                         help_text="BUS-01, 4WD-02, VOL-AIR...")
    vehicule_matricule = models.CharField(max_length=30, blank=True, default="",
                         help_text="Plaque d'immatriculation — aide l'agent à repérer le bon véhicule au parking")
    vehicule_photo    = models.TextField(blank=True, default="",
                         help_text="Photo du véhicule en base64 — usage exceptionnel, pour reconnaissance visuelle rapide au parking")
    conducteur        = models.CharField(max_length=100, blank=True, default="",
                         help_text="Nom du conducteur assigné pour l'ALLER — change trop souvent pour être lié au véhicule lui-même")
    conducteur_secondaire = models.CharField(max_length=100, blank=True, default="",
                         help_text="Second chauffeur / chauffeur de relève pour ce trajet (long trajet, sécurité) — distinct du conducteur du retour")
    NIVEAUX_ALERTE = [
        (1, "Aucune restriction de voyage"),
        (2, "Prudence — coordination entre CCTV"),
        (3, "Minimum de 2 convois de véhicules"),
        (4, "Escorte gendarme/policière requise"),
        (5, "Aucun voyage n'est autorisé"),
    ]
    niveau_alerte = models.PositiveSmallIntegerField(choices=NIVEAUX_ALERTE, default=1,
                         help_text="Niveau d'alerte sécurité sur l'itinéraire — pour le plan de gestion de voyage (JMP)")
    # ── Trajet RETOUR — potentiellement different de l'aller ──
    # Une rotation est un aller-retour, mais le vehicule et l'equipage du
    # retour peuvent differer de l'aller (ex: un agent revient plus tot que
    # prevu et est regroupe dans un AUTRE vehicule avec d'autres personnes
    # dans le meme cas). Champs vides par defaut -> on suppose le meme
    # vehicule qu'a l'aller tant que rien n'est precise.
    vehicule_retour           = models.CharField(max_length=50, blank=True, default="")
    vehicule_matricule_retour = models.CharField(max_length=30, blank=True, default="")
    conducteur_retour         = models.CharField(max_length=100, blank=True, default="")
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

    def partir(self, date_depart=None):
        """Libere la chambre au depart"""
        from residences.models import OccupationHistory
        import datetime
        reel = date_depart or datetime.date.today()
        self.date_depart_effective = reel
        if self.batiment:
            b = self.batiment
            # Clore historique occupation
            OccupationHistory.objects.filter(batiment=b, personnel=self.personnel, date_depart__isnull=True).update(
                date_depart=reel, motif_depart="Voyage"
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
        """
        Reassigne la chambre au retour. Source de verite pour QUELLE
        chambre : la residence principale declaree (ResidentPrincipal),
        si elle existe - sinon repli sur self.batiment (comportement
        historique, pour les voyages anterieurs a l'existence de ce
        systeme). Ne transfere JAMAIS automatiquement un occupant
        temporaire en place - une decision qui deplace quelqu'un d'autre
        doit rester une action explicite de l'admin (via l'ecran
        Hebergement) ; cette methode se contente de RESTITUER si la
        chambre est libre, et de signaler clairement le conflit sinon.

        Renvoie un dict decrivant ce qui s'est passe, pour que
        l'appelant (vue) puisse le remonter a l'utilisateur : jamais
        d'exception silencieuse sur ce point precis.
        """
        import datetime
        from residences.models import OccupationHistory, ResidentPrincipal
        today = date_retour or datetime.date.today()
        self.date_retour_effective = today
        self.statut = "retour"
        self.save()

        resultat = {"chambre_restituee": False, "chambre_occupee_par": None, "residence": None}

        rp = None
        if self.personnel_id:
            rp = ResidentPrincipal.objects.filter(personnel_id=self.personnel_id, date_fin__isnull=True).select_related("batiment").first()
        b = rp.batiment if rp else self.batiment

        if b:
            resultat["residence"] = b.residence
            if b.statut == "Libre" or b.personnel_id == self.personnel_id:
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
                resultat["chambre_restituee"] = True
                if rp:
                    self._notifier_retour(self.personnel, f"🏠 Bon retour — votre chambre {b.residence} vous a été restituée.")
            elif b.personnel_id:
                # Chambre occupee par quelqu'un d'autre a l'instant du
                # retour - le droit prioritaire du resident (ResidentPrincipal)
                # reste enregistre tel quel, MAIS le transfert de
                # l'occupant temporaire n'est pas automatique ici.
                resultat["chambre_occupee_par"] = f"{b.personnel.nom} {b.personnel.prenom}"
                self._notifier_retour(self.personnel,
                    f"⚠️ Vous êtes de retour, mais votre résidence principale ({b.residence}) est actuellement occupée par {b.personnel.nom} {b.personnel.prenom}. La gestion signalera une restitution manuelle.")
                self._notifier_admins_conflit(self.personnel, b)

        return resultat

    def _notifier_retour(self, personnel, message):
        try:
            from evenements.models import SimpleNotification
            if personnel and personnel.user:
                SimpleNotification.objects.create(user=personnel.user, personnel=personnel, titre="Centre de mobilité — retour", message=message, type_notif="info")
        except Exception:
            pass

    def _notifier_admins_conflit(self, personnel, batiment):
        try:
            from evenements.models import SimpleNotification
            from django.contrib.auth.models import User
            from accounts.models import Profile
            admins = set(User.objects.filter(is_staff=True))
            admins |= set(u for u in User.objects.filter(profile__role="admin"))
            for admin in admins:
                SimpleNotification.objects.create(
                    user=admin, titre="⚠️ Conflit résidence principale au retour",
                    message=f"{personnel.nom} {personnel.prenom} est de retour mais sa chambre {batiment.residence} est occupée par {batiment.personnel.nom} {batiment.personnel.prenom} — restitution manuelle à organiser.",
                    type_notif="alerte",
                )
        except Exception:
            pass


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
    SENS_CHOIX = [
        ("aller",  "➡️ Aller"),
        ("retour", "⬅️ Retour"),
        ("interne","🔁 Trajet interne"),
    ]
    sens          = models.CharField(max_length=10, choices=SENS_CHOIX, default="aller",
                     help_text="Aller ou retour — vehicule/conducteur/equipage peuvent differer entre les deux")
    vehicule_flotte = models.ForeignKey("VehiculeFlotte", on_delete=models.SET_NULL, null=True, blank=True,
                     related_name="etapes", help_text="Vehicule du catalogue partage - matricule/photo herites automatiquement")
    conducteur    = models.CharField(max_length=100, blank=True, default="",
                     help_text="Conducteur assigne pour cette etape specifique")
    origine       = models.CharField(max_length=200)
    destination   = models.CharField(max_length=200)
    mode_transport= models.CharField(max_length=15, choices=MODES, default="bus")
    date_etape    = models.DateField()
    heure_depart  = models.TimeField(null=True, blank=True)
    heure_arrivee_prevue = models.TimeField(null=True, blank=True)
    distance_km   = models.DecimalField(max_digits=6, decimal_places=1, null=True, blank=True,
                     help_text="Distance approximative de cette étape en km — pour le plan de gestion de voyage (JMP)")
    pause_fatigue = models.CharField(max_length=50, blank=True, default="",
                     help_text="Gestion de la fatigue du conducteur à cette étape (ex: '15 MIN DE PAUSE', 'N/A') — pour le JMP")
    point_rdv     = models.CharField(max_length=200, blank=True, default="")
    reference     = models.CharField(max_length=100, blank=True, default="",
                     help_text="Numéro de vol, plaque du véhicule, référence de réservation...")
    notes         = models.TextField(blank=True, default="")
    # Justificatif billet d'avion — pour le personnel expatrie (comptabilite/
    # remboursement). Pertinent surtout quand mode_transport="avion".
    billet_fichier = models.TextField(blank=True, default="",
                     help_text="Scan/PDF du billet d'avion en base64 — justificatif pour la comptabilité")
    billet_cout    = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True,
                     help_text="Coût du billet — pour le suivi budgétaire du personnel expatrié")

    class Meta:
        ordering = ["voyage", "ordre"]
        verbose_name = "Étape de voyage"

    def __str__(self):
        return f"Étape {self.ordre} — {self.origine} → {self.destination}"


class VehiculeFlotte(models.Model):
    """
    Catalogue des véhicules du camp (partagé, cote serveur) - permet de
    SELECTIONNER un vehicule existant (matricule + photo deja renseignes)
    plutot que de tout ressaisir a chaque rotation. Seul le conducteur
    reste a assigner par voyage (change trop souvent pour etre fixe ici).
    """
    CATEGORIES = [
        ("4x4", "🚙 4x4"), ("pickup", "🛻 Pick-up"), ("minibus", "🚐 Minibus"),
        ("bus", "🚌 Bus"), ("avion", "✈️ Avion"), ("bateau", "⛴️ Bateau"), ("autre", "🚗 Autre"),
    ]
    nom         = models.CharField(max_length=100)
    categorie   = models.CharField(max_length=15, choices=CATEGORIES, default="4x4")
    matricule   = models.CharField(max_length=30, blank=True, default="")
    capacite    = models.PositiveIntegerField(default=7)
    photo       = models.TextField(blank=True, default="")
    actif       = models.BooleanField(default=True)

    class Meta:
        ordering = ["categorie", "nom"]
        verbose_name = "Véhicule de la flotte"

    def __str__(self):
        return f"{self.nom} ({self.matricule})" if self.matricule else self.nom
