
from rest_framework import serializers
from .models import Voyage
from residences.serializers import PersonnelSerializer

STATUT_MAP = {
    "planifie":"Planifié","en_voyage":"En voyage",
    "retour":"Retour au camp","annule":"Annulé",
}

class VoyageSerializer(serializers.ModelSerializer):
    personnel_detail = PersonnelSerializer(source="personnel", read_only=True)
    batiment_nom = serializers.SerializerMethodField()
    statut_label = serializers.SerializerMethodField()

    class Meta:
        model = Voyage
        fields = "__all__"
        read_only_fields = ["enregistre_par","statut","date_retour_effective"]

    def get_batiment_nom(self, obj):
        return obj.batiment.residence if obj.batiment else None

    def get_statut_label(self, obj):
        return STATUT_MAP.get(obj.statut, obj.statut)

    def create(self, validated_data):
        validated_data["enregistre_par"] = self.context["request"].user
        return super().create(validated_data)
