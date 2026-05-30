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
