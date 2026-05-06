
from rest_framework import serializers
from .models import Voyage
from residences.serializers import PersonnelSerializer

class VoyageSerializer(serializers.ModelSerializer):
    personnel_detail = PersonnelSerializer(source="personnel", read_only=True)
    batiment_nom = serializers.CharField(source="batiment.residence", read_only=True)
    statut_label = serializers.SerializerMethodField()
    class Meta:
        model = Voyage
        fields = "__all__"
        read_only_fields = ["enregistre_par","statut","date_retour_effective"]
    def get_statut_label(self, obj):
        return dict(Voyage.STATUT).get(obj.statut, obj.statut)
    def create(self, validated_data):
        validated_data["enregistre_par"] = self.context["request"].user
        return super().create(validated_data)
