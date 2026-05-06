from django.db import models
from django.contrib.auth.models import User

class Profile(models.Model):
    ROLES = [('admin','Admin'),('manager','Manager Camp'),('agent','Agent Terrain'),('restauration','Restauration'),('technicien','Technicien')]
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    role = models.CharField(max_length=30, choices=ROLES, default='agent')
    societe = models.CharField(max_length=100, blank=True)
    device_id = models.CharField(max_length=200, blank=True)

    def __str__(self):
        return f"{self.user.username} ({self.role})"
