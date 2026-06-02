from django.db.models.signals import post_save
from django.dispatch import receiver

# Signaux chargés au démarrage de l'app
# Les imports circulaires sont évités en important ici
