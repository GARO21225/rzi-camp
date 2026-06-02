
from rest_framework import serializers
from .models import Voyage

STATUT_MAP = {
    "planifie":"Planifié","en_voyage":"En voyage",
    "retour":"Retour au camp","annule":"Annulé",
}

class VoyageSerializer(serializers.ModelSerializer):
    personnel_nom      = serializers.SerializerMethodField()
    personnel_societe  = serializers.SerializerMethodField()
    batiment_nom       = serializers.SerializerMethodField()
    statut_label       = serializers.SerializerMethodField()

    class Meta:
        model  = Voyage
        fields = "__all__"
        read_only_fields = ["enregistre_par","statut","date_retour_effective"]

    def _model_or_none(self, obj):
        """Retourne obj si c'est une instance Voyage, None si c'est un dict (validated_data)"""
        return obj if isinstance(obj, Voyage) else None

    def get_personnel_nom(self, obj):
        o = self._model_or_none(obj)
        try: return f"{o.personnel.nom} {o.personnel.prenom}" if o and o.personnel else ""
        except Exception: return ""

    def get_personnel_societe(self, obj):
        o = self._model_or_none(obj)
        try: return o.personnel.societe if o and o.personnel else ""
        except Exception: return ""

    def get_batiment_nom(self, obj):
        o = self._model_or_none(obj)
        try: return o.batiment.residence if o and o.batiment else ""
        except Exception: return ""

    def get_statut_label(self, obj):
        o = self._model_or_none(obj)
        try: return STATUT_MAP.get(o.statut, o.statut) if o else "Planifié"
        except Exception: return ""

    def create(self, validated_data):
        req = self.context.get("request")
        if req and req.user and req.user.is_authenticated:
            validated_data["enregistre_par"] = req.user
        return super().create(validated_data)
