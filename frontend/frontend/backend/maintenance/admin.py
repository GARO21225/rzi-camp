from django.contrib import admin
from .models import Incident
@admin.register(Incident)
class IncidentAdmin(admin.ModelAdmin):
    list_display = ['titre','residence','priorite','statut','auteur','date_creation']
    list_filter = ['statut','priorite','categorie']
