
from rest_framework import serializers
from .models import Batiment, Personnel, OccupationHistory

class PersonnelSerializer(serializers.ModelSerializer):
    type_label = serializers.SerializerMethodField()
    class Meta:
        model = Personnel
        fields = ["id","nom","prenom","societe","numero","type_personnel","type_label","email","qr_code_data","qr_code_string","actif","date_creation"]
        read_only_fields = ["qr_code_data","qr_code_string","date_creation"]
    def get_type_label(self, obj):
        return dict(Personnel.TYPE_CHOICES).get(obj.type_personnel, obj.type_personnel)

class BatimentSerializer(serializers.ModelSerializer):
    personnel_detail = PersonnelSerializer(source="personnel", read_only=True)
    class Meta:
        model = Batiment
        fields = "__all__"

class OccupationHistorySerializer(serializers.ModelSerializer):
    residence = serializers.CharField(source="batiment.residence", read_only=True)
    bloc = serializers.CharField(source="batiment.bloc", read_only=True)
    personnel_detail = PersonnelSerializer(source="personnel", read_only=True)
    class Meta:
        model = OccupationHistory
        fields = "__all__"
