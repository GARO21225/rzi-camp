from rest_framework import serializers
from .models import Voyage

STATUT_MAP = {
    "planifie":"Planifié","en_voyage":"En voyage",
    "retour":"Retour au camp","annule":"Annulé",
}

class VoyageSerializer(serializers.ModelSerializer):
    personnel_nom      = serializers.SerializerMethodField()
    personnel_societe  = serializers.SerializerMethodField()
    personnel_profil   = serializers.SerializerMethodField()
    batiment_nom       = serializers.SerializerMethodField()
    statut_label       = serializers.SerializerMethodField()
    # Infos rotation groupe
    places_prises      = serializers.SerializerMethodField()
    places_libres      = serializers.SerializerMethodField()

    class Meta:
        model  = Voyage
        fields = "__all__"
        read_only_fields = ["enregistre_par","date_retour_effective"]

    def _obj(self, obj):
        return obj if isinstance(obj, Voyage) else None

    def get_personnel_nom(self, obj):
        o = self._obj(obj)
        try: return f"{o.personnel.nom} {o.personnel.prenom}" if o and o.personnel else ""
        except: return ""

    def get_personnel_societe(self, obj):
        o = self._obj(obj)
        try: return o.personnel.societe if o and o.personnel else ""
        except: return ""

    def get_personnel_profil(self, obj):
        o = self._obj(obj)
        try: return o.personnel.profil if o and o.personnel else ""
        except: return ""

    def get_batiment_nom(self, obj):
        o = self._obj(obj)
        try: return o.batiment.residence if o and o.batiment else ""
        except: return ""

    def get_statut_label(self, obj):
        o = self._obj(obj)
        try: return STATUT_MAP.get(o.statut, o.statut) if o else "Planifié"
        except: return ""

    def get_places_prises(self, obj):
        o = self._obj(obj)
        if not o or not o.rotation_id: return 1
        try: return Voyage.objects.filter(rotation_id=o.rotation_id).count()
        except: return 1

    def get_places_libres(self, obj):
        o = self._obj(obj)
        if not o: return 0
        total = o.nb_places_total or 15
        prises = self.get_places_prises(obj)
        return max(0, total - prises)

    def create(self, validated_data):
        req = self.context.get("request")
        if req and req.user and req.user.is_authenticated:
            validated_data["enregistre_par"] = req.user
        return super().create(validated_data)
