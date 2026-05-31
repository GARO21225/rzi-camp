from rest_framework import serializers
from .models import Batiment, Personnel, OccupationHistory, InductionRecord

class PersonnelSerializer(serializers.ModelSerializer):
    type_label      = serializers.SerializerMethodField()
    user_role       = serializers.SerializerMethodField()
    user_active     = serializers.SerializerMethodField()
    login_genere    = serializers.SerializerMethodField()
    password_genere = serializers.SerializerMethodField()

    def get_type_label(self, obj):
        return dict(Personnel.TYPE_CHOICES).get(obj.type_personnel, obj.type_personnel)

    profil_label = serializers.SerializerMethodField()

    def get_profil_label(self, obj):
        try:
            from residences.models import Personnel
            return dict(Personnel.PROFIL_CHOICES).get(obj.profil or 'agent', obj.profil or 'agent')
        except Exception:
            return 'agent'

    def to_representation(self, instance):
        """Gère le cas où la colonne profil n'existe pas encore en DB."""
        try:
            return super().to_representation(instance)
        except Exception as e:
            if 'profil' in str(e).lower():
                # Retourner les données sans profil si la colonne manque
                data = super(PersonnelSerializer, self).to_representation(instance)
                data['profil'] = 'agent'
                data['profil_label'] = 'Agent'
                return data
            raise

    def get_user_role(self, obj):
        try:
            if obj.user and hasattr(obj.user, 'profile'):
                return obj.user.profile.role
        except: pass
        return None

    def get_user_active(self, obj):
        try:
            if obj.user: return obj.user.is_active
        except: pass
        return None

    def get_login_genere(self, obj):
        return getattr(obj, 'login_genere', None) or (obj.user.username if obj.user else None)

    def get_password_genere(self, obj):
        try: return obj.password_genere
        except: return None

    class Meta:
        model  = Personnel
        fields = [
            "id", "nom", "prenom", "societe", "numero", "type_personnel",
            "type_label", "email", "qr_code_data", "qr_code_string", "actif", "induction_requise",
            "date_creation", "user_role", "user_active", "login_genere",
            "password_genere", "profil", "profil_label",
        ]
        read_only_fields = ["qr_code_data", "qr_code_string", "date_creation"]


class BatimentSerializer(serializers.ModelSerializer):
    personnel_detail = PersonnelSerializer(source="personnel", read_only=True)
    class Meta:
        model  = Batiment
        fields = "__all__"


class OccupationHistorySerializer(serializers.ModelSerializer):
    personnel_detail = PersonnelSerializer(source="personnel", read_only=True)
    class Meta:
        model  = OccupationHistory
        fields = "__all__"


class DemandeSerializer(serializers.ModelSerializer):
    demandeur_nom   = serializers.SerializerMethodField()
    traite_par_nom  = serializers.SerializerMethodField()
    type_label      = serializers.SerializerMethodField()
    statut_label    = serializers.SerializerMethodField()

    def get_demandeur_nom(self, obj):
        if obj.demandeur:
            return f"{obj.demandeur.first_name} {obj.demandeur.last_name}".strip() or obj.demandeur.username
        return "—"

    def get_traite_par_nom(self, obj):
        if obj.traite_par:
            return f"{obj.traite_par.first_name} {obj.traite_par.last_name}".strip() or obj.traite_par.username
        return "—"

    def get_type_label(self, obj):
        return obj.get_type_demande_display() if hasattr(obj, 'get_type_demande_display') else obj.type_demande

    def get_statut_label(self, obj):
        return obj.get_statut_display() if hasattr(obj, 'get_statut_display') else obj.statut

    class Meta:
        model  = __import__('residences.models', fromlist=['Demande']).Demande
        fields = [
            "id", "type_demande", "type_label", "statut", "statut_label",
            "demandeur", "demandeur_nom", "traite_par", "traite_par_nom",
            "donnees", "residence_souhaitee", "residence_attribuee",
            "message_demandeur", "commentaire_admin", "proposition_admin",
            "date_debut_souhaitee", "date_fin_souhaitee",
            "date_creation", "date_traitement", "date_reponse",
        ]
        read_only_fields = [
            "demandeur", "traite_par", "statut", "commentaire_admin",
            "proposition_admin", "date_traitement", "date_reponse"
        ]


class InductionRecordSerializer(serializers.ModelSerializer):
    """Serializer pour le suivi d'induction QHSE."""
    personnel_detail = PersonnelSerializer(source="personnel", read_only=True)
    progression      = serializers.SerializerMethodField()

    def get_progression(self, obj):
        return obj.progression_pct()

    class Meta:
        model  = InductionRecord
        fields = [
            "id", "personnel", "personnel_detail", "statut",
            "etapes_data", "form_data", "docs_data", "medical_data",
            "quiz_score", "quiz_tentatives",
            "date_debut", "date_fin",
            "badge_emis", "badge_date", "badge_expire",
            "progression",
        ]
        read_only_fields = ["date_debut", "date_fin", "badge_date"]
