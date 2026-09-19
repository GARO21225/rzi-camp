from django.db import models
from django.contrib.auth.models import User

class Profile(models.Model):
    # ROLES reste comme reference historique (labels par defaut, code deja
    # utilise ailleurs) mais n'est PLUS la source de verite : RoleCustom
    # ci-dessous permet desormais a l'admin de creer/supprimer des roles
    # depuis Parametrage, sans toucher au code. Le champ role n'a plus de
    # choices= impose - n'importe quel code de RoleCustom est accepte,
    # valide au niveau applicatif (serializer) plutot qu'au niveau DB.
    ROLES = [
        ('admin',        'Administrateur'),
        ('agent',        'Agent Terrain'),
        ('restauration', 'Equipe Restauration'),
        ('technicien',   'Technicien Maintenance'),
        ('menage',       'Equipe Ménage'),
        ('boutique',     'Bar & Boutique'),
        ('securite',     'Sécurité'),
        ('medical',      'Médical'),
        ('hse',          'HSE / QHSE'),
        ('accueil',      "Agent d'accueil"),
        ('manager',      'Manager / Responsable'),
    ]
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    role = models.CharField(max_length=30, default='agent')
    societe = models.CharField(max_length=100, blank=True, default='ROXGOLD')
    telephone = models.CharField(max_length=20, blank=True)

    def __str__(self):
        return f"{self.user.username} ({self.role})"


class RoleCustom(models.Model):
    """
    Role configurable depuis Parametrage -> Roles & Acces : remplace la
    liste figee Profile.ROLES par une vraie table que l'admin peut
    completer ou reduire sans deploiement. 'admin' reste toujours protege
    (est_systeme=True, jamais supprimable depuis l'interface) pour eviter
    qu'un admin se retrouve sans acces complet par erreur.
    """
    code         = models.SlugField(max_length=30, unique=True)
    label        = models.CharField(max_length=100)
    menu_pages   = models.JSONField(default=list, blank=True)
    readonly     = models.BooleanField(default=False)
    est_systeme  = models.BooleanField(default=False)
    date_creation = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['label']

    def __str__(self):
        return self.label


class RapportPlanifie(models.Model):
    """
    Rapport envoye automatiquement par email a intervalle regulier -
    execute par une commande Django (envoyer_rapports_planifies),
    elle-meme declenchee par une entree crontab sur le serveur (meme
    principe que la sauvegarde quotidienne deja en place). Pas de Celery/
    Redis-broker necessaire : un cron + une commande suffit pour ce besoin.
    """
    FREQUENCES = [
        ('quotidien', 'Quotidien'),
        ('hebdomadaire', 'Hebdomadaire'),
        ('mensuel', 'Mensuel'),
    ]
    JOURS_SEMAINE = [
        (0,'Lundi'),(1,'Mardi'),(2,'Mercredi'),(3,'Jeudi'),(4,'Vendredi'),(5,'Samedi'),(6,'Dimanche'),
    ]
    nom            = models.CharField(max_length=150)
    frequence      = models.CharField(max_length=20, choices=FREQUENCES, default='hebdomadaire')
    jour_semaine   = models.PositiveSmallIntegerField(choices=JOURS_SEMAINE, null=True, blank=True)  # pour hebdomadaire
    jour_mois      = models.PositiveSmallIntegerField(null=True, blank=True)  # pour mensuel (1-28)
    heure          = models.TimeField(default='07:00')
    destinataires  = models.JSONField(default=list, blank=True)  # liste d'adresses email
    actif          = models.BooleanField(default=True)
    derniere_execution = models.DateTimeField(null=True, blank=True)
    cree_par       = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    date_creation  = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['nom']

    def __str__(self):
        return f"{self.nom} ({self.get_frequence_display()})"

    def est_du(self, maintenant):
        """Ce rapport doit-il partir maintenant, compte tenu de sa derniere execution ?"""
        if not self.actif:
            return False
        if self.derniere_execution and self.derniere_execution.date() == maintenant.date():
            return False  # deja envoye aujourd'hui, jamais 2x le meme jour
        if maintenant.time().hour != self.heure.hour:
            return False
        if self.frequence == 'quotidien':
            return True
        if self.frequence == 'hebdomadaire':
            return self.jour_semaine is not None and maintenant.weekday() == self.jour_semaine
        if self.frequence == 'mensuel':
            return self.jour_mois is not None and maintenant.day == self.jour_mois
        return False


class Parametre(models.Model):
    """
    Paramétrage général de l'application — clé/valeur unique, modifiable
    depuis la page Paramétrage (réservée aux administrateurs).
    """
    cle          = models.CharField(max_length=100, unique=True)
    valeur       = models.TextField(blank=True, default='')
    description  = models.CharField(max_length=255, blank=True, default='')
    modifie_le   = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.cle} = {self.valeur}"

    @staticmethod
    def get(cle, defaut=None):
        try:
            return Parametre.objects.get(cle=cle).valeur
        except Parametre.DoesNotExist:
            return defaut

    @staticmethod
    def get_int(cle, defaut):
        try:
            return int(Parametre.objects.get(cle=cle).valeur)
        except (Parametre.DoesNotExist, ValueError, TypeError):
            return defaut
