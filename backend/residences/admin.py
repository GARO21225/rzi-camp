from django.contrib import admin
from .models import Batiment
@admin.register(Batiment)
class BatimentAdmin(admin.ModelAdmin):
    list_display = ['residence','bloc','statut','occupant','societe']
    list_filter = ['statut','bloc']
    search_fields = ['residence','occupant']
