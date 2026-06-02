from rest_framework import serializers
from .models import Incident, CommentaireIncident
from django.contrib.auth.models import User

class CommentaireSerializer(serializers.ModelSerializer):
    auteur_nom  = serializers.SerializerMethodField()
    type_label  = serializers.CharField(source='get_type_comment_display', read_only=True)
    photo_base64 = serializers.CharField(default='', allow_blank=True)

    def get_auteur_nom(self, obj):
        if obj.auteur:
            return f"{obj.auteur.first_name} {obj.auteur.last_name}".strip() or obj.auteur.username
        return "—"

    class Meta:
        model  = CommentaireIncident
        fields = "__all__"
        read_only_fields = ["auteur", "date_creation"]


class IncidentSerializer(serializers.ModelSerializer):
    auteur_nom     = serializers.SerializerMethodField()
    assigne_nom    = serializers.SerializerMethodField()
    statut_label   = serializers.CharField(source="get_statut_display",   read_only=True)
    priorite_label = serializers.CharField(source="get_priorite_display", read_only=True)
    commentaires   = CommentaireSerializer(many=True, read_only=True)
    sla_restant_h  = serializers.SerializerMethodField()
    temps_ecoule_h = serializers.SerializerMethodField()

    # Champs optionnels (peuvent manquer sur Render si migration absente)
    photo_base64            = serializers.CharField(default="", allow_blank=True, required=False)
    photo_mime              = serializers.CharField(default="image/jpeg", allow_blank=True, required=False)
    photo_resolution_base64 = serializers.CharField(default="", allow_blank=True, required=False)
    latitude                = serializers.DecimalField(max_digits=10, decimal_places=7, required=False, allow_null=True)
    longitude               = serializers.DecimalField(max_digits=10, decimal_places=7, required=False, allow_null=True)

    def get_auteur_nom(self, obj):
        if obj.auteur:
            return f"{obj.auteur.first_name} {obj.auteur.last_name}".strip() or obj.auteur.username
        return "—"

    def get_assigne_nom(self, obj):
        if obj.assigne_a:
            return f"{obj.assigne_a.first_name} {obj.assigne_a.last_name}".strip() or obj.assigne_a.username
        return None

    def get_sla_restant_h(self, obj):
        try: return obj.sla_restant_h
        except: return 0

    def get_temps_ecoule_h(self, obj):
        try: return obj.temps_ecoule_h
        except: return 0

    def to_representation(self, obj):
        """Retourner les données même si certaines colonnes manquent"""
        data = {}
        safe_fields = ["id","titre","description","categorie","priorite","statut",
                       "residence","bloc","auteur","assigne_a","date_creation",
                       "date_assignation","date_debut","date_resolution","date_cloture",
                       "sla_echeance","sla_depasse","sla_notification_envoyee",
                       "commentaire_resolution","commentaire_cloture"]
        try:
            data = super().to_representation(obj)
        except Exception:
            for f in safe_fields:
                try: data[f] = getattr(obj, f, None)
                except: data[f] = None
            data["auteur_nom"] = self.get_auteur_nom(obj)
            data["assigne_nom"] = self.get_assigne_nom(obj)
            data["statut_label"] = obj.get_statut_display()
            data["priorite_label"] = obj.get_priorite_display()
            data["commentaires"] = []
            data["sla_restant_h"] = 0
            data["temps_ecoule_h"] = 0
        for col in ["photo_base64","photo_resolution_base64","photo_mime"]:
            if col not in data or data[col] is None:
                data[col] = "" if col != "photo_mime" else "image/jpeg"
        return data

    class Meta:
        model  = Incident
        fields = "__all__"
        read_only_fields = ["auteur","date_creation","date_assignation","date_debut",
                            "date_resolution","date_cloture","sla_echeance","sla_depasse"]
