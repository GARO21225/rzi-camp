
from rest_framework import serializers
from .models import Incident

class IncidentSerializer(serializers.ModelSerializer):
    auteur_nom = serializers.SerializerMethodField()
    photo_b64  = serializers.SerializerMethodField()

    class Meta:
        model  = Incident
        fields = [
            "id","titre","description","categorie","priorite","statut",
            "residence","bloc","auteur","auteur_nom","assigne_a",
            "photo_b64","photo_mime","latitude","longitude",
            "date_creation","date_resolution"
        ]
        read_only_fields = ["auteur","date_creation","photo_b64"]

    def get_auteur_nom(self, obj):
        if obj.auteur:
            return obj.auteur.get_full_name() or obj.auteur.username
        return "—"

    def get_photo_b64(self, obj):
        return obj.photo_base64 or ""
