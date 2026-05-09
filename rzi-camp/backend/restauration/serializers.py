
from rest_framework import serializers
from .models import QRToken, RepasLog, AuditLog

class QRTokenSerializer(serializers.ModelSerializer):
    type_repas_label = serializers.CharField(source="get_type_repas_display", read_only=True)
    class Meta:
        model = QRToken
        fields = ["id","token","personnel","residence","resident","type_repas","type_repas_label","cree_le","expire_le","utilise"]

class RepasLogSerializer(serializers.ModelSerializer):
    resident = serializers.CharField(source="qr_token.resident")
    residence = serializers.CharField(source="qr_token.residence")
    type_repas = serializers.CharField(source="qr_token.type_repas")
    type_repas_label = serializers.CharField(source="qr_token.get_type_repas_display")
    personnel_id = serializers.IntegerField(source="qr_token.personnel_id", allow_null=True)
    valide_par_nom = serializers.SerializerMethodField()
    class Meta:
        model = RepasLog
        fields = ["id","resident","residence","type_repas","type_repas_label","personnel_id","date_validation","valide_par_nom"]
    def get_valide_par_nom(self, obj):
        return obj.valide_par.username if obj.valide_par else "—"

class AuditLogSerializer(serializers.ModelSerializer):
    utilisateur_nom = serializers.SerializerMethodField()
    class Meta:
        model = AuditLog
        fields = "__all__"
    def get_utilisateur_nom(self, obj):
        return obj.utilisateur.username if obj.utilisateur else "system"
