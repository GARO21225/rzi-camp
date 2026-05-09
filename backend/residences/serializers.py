
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

class DemandeSerializer(serializers.ModelSerializer):
    demandeur_nom = serializers.SerializerMethodField()
    traite_par_nom = serializers.SerializerMethodField()
    type_label = serializers.CharField(source="get_type_demande_display", read_only=True)
    statut_label = serializers.CharField(source="get_statut_display", read_only=True)
    
    class Meta:
        from .models import Demande
        model = Demande
        fields = [
            "id","type_demande","type_label","statut","statut_label",
            "demandeur","demandeur_nom","traite_par","traite_par_nom",
            "donnees","residence_souhaitee","residence_attribuee",
            "message_demandeur","commentaire_admin","proposition_admin",
            "date_debut_souhaitee","date_fin_souhaitee",
            "date_creation","date_traitement","date_reponse"
        ]
        read_only_fields = ["demandeur","traite_par","statut","commentaire_admin","proposition_admin",
                           "residence_attribuee","date_creation","date_traitement","date_reponse"]
    
    def get_demandeur_nom(self, obj):
        return obj.demandeur.get_full_name() or obj.demandeur.username if obj.demandeur else "—"
    
    def get_traite_par_nom(self, obj):
        return obj.traite_par.get_full_name() or obj.traite_par.username if obj.traite_par else None
