
from django.contrib import admin
from .models import Voyage
@admin.register(Voyage)
class VoyageAdmin(admin.ModelAdmin):
    list_display = ["personnel","batiment","date_depart","date_retour_prevue","statut"]
    list_filter = ["statut"]
