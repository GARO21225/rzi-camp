
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
    actif            = models.BooleanField(default=True)

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
        """QR numérique pur: juste le PK en 4 chiffres.
        Chiffres seuls = mode numérique QR = cases 3x plus grosses = scan fiable depuis écran."""
        import qrcode.constants
        # Format: "0001", "0042", "1234" — QR en mode numérique pur
        qr_string = f"{self.pk:04d}"
        self.qr_code_string = qr_string
        # Génération haute qualité
        qr_obj = qrcode.QRCode(
            version=1,
            error_correction=qrcode.constants.ERROR_CORRECT_H,
            box_size=20,
            border=6,
        )
        qr_obj.add_data(qr_string, optimize=0)
        qr_obj.make(fit=True)
        img = qr_obj.make_image(fill_color="#000000", back_color="#ffffff")
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        self.qr_code_data = base64.b64encode(buf.getvalue()).decode()
        self.save(update_fields=["qr_code_data", "qr_code_string"])
    def save(self, *args, **kwargs):
        # Forcer les majuscules pour tous les champs texte
        if self.nom: self.nom = self.nom.strip().upper()
        if self.prenom: self.prenom = self.prenom.strip().upper()
        if self.societe: self.societe = self.societe.strip().upper()
        if self.numero: self.numero = self.numero.strip()
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
        try:
            from evenements.models import SimpleNotification
            from accounts.models import Profile
            # Chercher tous les admins: is_staff OU role=admin
            admin_users = set()
            for u in User.objects.filter(is_staff=True): admin_users.add(u)
            for p in Profile.objects.filter(role="admin").select_related("user"): admin_users.add(p.user)
            nom = self.demandeur.get_full_name() or self.demandeur.username
            for admin in admin_users:
                SimpleNotification.objects.create(
                    user=admin,
                    titre=f"📋 Nouvelle demande: {self.get_type_demande_display()}",
                    message=f"De: {nom} · {self.message_demandeur[:120]}",
                    type_notif="demande",
                )
        except Exception:
            pass

    def notifier_demandeur(self, message):
        """Notifie le demandeur du traitement"""
        try:
            from evenements.models import SimpleNotification
            SimpleNotification.objects.create(
                user=self.demandeur,
                titre=f"📋 Demande: {self.get_statut_display()}",
                message=message,
                type_notif="demande",
            )
        except Exception:
            pass


class InductionRecord(models.Model):
    """Suivi de l'induction QHSE pour chaque membre du personnel."""
    STATUTS = [
        ('en_cours', 'En cours'),
        ('valide',   'Validé — Induit'),
        ('refuse',   'Refusé'),
        ('expire',   'Expiré'),
    ]
    personnel    = models.OneToOneField(Personnel, on_delete=models.CASCADE,
                    related_name='induction')
    statut       = models.CharField(max_length=20, choices=STATUTS, default='en_cours')
    # Étapes complétées (JSON)
    etapes_data  = models.JSONField(default=dict, blank=True)
    # Données saisies
    form_data    = models.JSONField(default=dict, blank=True)
    docs_data    = models.JSONField(default=dict, blank=True)
    medical_data = models.JSONField(default=dict, blank=True)
    # Quiz
    quiz_score   = models.PositiveIntegerField(null=True, blank=True)
    quiz_tentatives = models.PositiveIntegerField(default=0)
    # Dates
    date_debut   = models.DateTimeField(auto_now_add=True)
    date_fin     = models.DateTimeField(null=True, blank=True)
    # Badge
    badge_emis   = models.BooleanField(default=False)
    badge_date   = models.DateTimeField(null=True, blank=True)
    badge_expire = models.DateField(null=True, blank=True)

    class Meta:
        verbose_name = 'Induction QHSE'
        ordering = ['-date_debut']

    def __str__(self):
        return f"{self.personnel.nom} {self.personnel.prenom} — {self.statut}"

    def progression_pct(self):
        etapes = ['accueil','documents','formation','quiz','medical','badge']
        done = sum(1 for e in etapes if self.etapes_data.get(e,{}).get('done'))
        return int(done / len(etapes) * 100)
