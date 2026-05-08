
from rest_framework import serializers
from .models import Incident

class IncidentSerializer(serializers.ModelSerializer):
    auteur_nom = serializers.SerializerMethodField()
    photo_url = serializers.SerializerMethodField()

    class Meta:
        model = Incident
        fields = [
            "id","titre","description","categorie","priorite","statut",
            "residence","bloc","auteur","auteur_nom","assigne_a",
            "photo_url","latitude","longitude",
            "date_creation","date_resolution"
        ]
        read_only_fields = ["auteur","date_creation","photo_url"]

    def get_auteur_nom(self, obj):
        return obj.auteur.get_full_name() or obj.auteur.username if obj.auteur else "—"

    def get_photo_url(self, obj):
        return obj.photo_data_url

    def create(self, validated_data):
        validated_data["auteur"] = self.context["request"].user
        return super().create(validated_data)
