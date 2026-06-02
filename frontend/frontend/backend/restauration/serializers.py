from rest_framework import serializers
from .models import QRToken, RepasLog, AuditLog

class QRTokenSerializer(serializers.ModelSerializer):
    type_repas_label = serializers.CharField(source="get_type_repas_display", read_only=True)
    class Meta:
        model  = QRToken
        fields = ["id","token","personnel","residence","resident",
                  "type_repas","type_repas_label","cree_le","expire_le","utilise"]

class RepasLogSerializer(serializers.ModelSerializer):
    # Infos affichées dans la liste "qui a mangé"
    resident        = serializers.SerializerMethodField()
    societe         = serializers.SerializerMethodField()
    residence       = serializers.SerializerMethodField()
    type_repas      = serializers.SerializerMethodField()
    type_repas_label = serializers.SerializerMethodField()
    personnel_id    = serializers.SerializerMethodField()
    valide_par_nom  = serializers.SerializerMethodField()

    class Meta:
        model  = RepasLog
        fields = ["id","resident","societe","residence",
                  "type_repas","type_repas_label","personnel_id",
                  "date_validation","valide_par_nom"]

    def get_resident(self, obj):
        try:
            if obj.qr_token: return obj.qr_token.resident or ""
            if obj.personnel: return f"{obj.personnel.nom} {obj.personnel.prenom}"
        except Exception: pass
        return "—"

    def get_societe(self, obj):
        try:
            if obj.personnel: return obj.personnel.societe or ""
            if obj.qr_token and obj.qr_token.personnel:
                return obj.qr_token.personnel.societe or ""
        except Exception: pass
        return ""

    def get_residence(self, obj):
        try:
            if obj.qr_token: return obj.qr_token.residence or ""
        except Exception: pass
        return ""

    def get_type_repas(self, obj):
        try:
            if obj.qr_token: return obj.qr_token.type_repas or ""
        except Exception: pass
        return ""

    def get_type_repas_label(self, obj):
        try:
            labels = {"petit_dejeuner":"Petit-déjeuner","dejeuner":"Déjeuner","diner":"Dîner"}
            t = self.get_type_repas(obj)
            return labels.get(t, t)
        except Exception: return ""

    def get_personnel_id(self, obj):
        try: return obj.personnel_id or (obj.qr_token.personnel_id if obj.qr_token else None)
        except Exception: return None

    def get_valide_par_nom(self, obj):
        try:
            if obj.valide_par: return obj.valide_par.get_full_name() or obj.valide_par.username
        except Exception: pass
        return "—"

class AuditLogSerializer(serializers.ModelSerializer):
    class Meta:
        model  = AuditLog
        fields = "__all__"
