from django.db import models
from django.contrib.auth.models import User

class Profile(models.Model):
    ROLES = [
        ('admin', 'Administrateur'),
        ('agent', 'Agent Terrain'),
        ('restauration', 'Equipe Restauration'),
        ('technicien', 'Technicien Maintenance'),
        ('menage', 'Equipe Ménage'),
    ]
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    role = models.CharField(max_length=20, choices=ROLES, default='agent')
    societe = models.CharField(max_length=100, blank=True, default='ROXGOLD')
    telephone = models.CharField(max_length=20, blank=True)

    def __str__(self):
        return f"{self.user.username} ({self.get_role_display()})"


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
