from django.contrib import admin
from .models import Batiment, Personnel

@admin.register(Personnel)
class PersonnelAdmin(admin.ModelAdmin):
    list_display = ['nom','prenom','societe','type_personnel','numero','actif']
    list_filter = ['type_personnel','actif','societe']
    search_fields = ['nom','prenom','societe','numero']

@admin.register(Batiment)
class BatimentAdmin(admin.ModelAdmin):
    list_display = ['residence','bloc','statut','occupant','societe']
    list_filter = ['statut','bloc']
    search_fields = ['residence','occupant']
