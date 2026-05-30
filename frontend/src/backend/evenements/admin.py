
from django.contrib import admin
from .models import Evenement, Notification, AlerteCampus

@admin.register(Evenement)
class EvenementAdmin(admin.ModelAdmin):
    list_display = ["titre","type_event","statut","date_debut","lieu","obligatoire"]
    list_filter = ["type_event","statut","obligatoire"]
    search_fields = ["titre","lieu"]

@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ["personnel","evenement","lu","date_envoi"]
    list_filter = ["lu"]

@admin.register(AlerteCampus)
class AlerteAdmin(admin.ModelAdmin):
    list_display = ["message","type_alerte","active","date_creation"]
    list_filter = ["type_alerte","active"]
