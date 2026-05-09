from rest_framework import serializers
from .models import Evenement, Notification, AlerteCampus

class EvenementSerializer(serializers.ModelSerializer):
    type_label = serializers.SerializerMethodField()
    statut_label = serializers.SerializerMethodField()
    nb_notifies = serializers.SerializerMethodField()
    cree_par_nom = serializers.SerializerMethodField()
    class Meta:
        model = Evenement
        fields = ["id","titre","description","type_event","type_label","statut","statut_label","date_debut","date_fin","lieu","image_base64","obligatoire","cree_par","cree_par_nom","date_creation","nb_notifies"]
        read_only_fields = ["cree_par","date_creation"]
    def get_type_label(self,obj): return dict(Evenement.TYPE_CHOICES).get(obj.type_event,obj.type_event)
    def get_statut_label(self,obj): return dict(Evenement.STATUT).get(obj.statut,obj.statut)
    def get_nb_notifies(self,obj): return obj.notifications.count()
    def get_cree_par_nom(self,obj): return obj.cree_par.get_full_name() or obj.cree_par.username if obj.cree_par else "—"
    def create(self,validated_data):
        validated_data["cree_par"] = self.context["request"].user
        return super().create(validated_data)

class NotificationSerializer(serializers.ModelSerializer):
    evenement_titre = serializers.CharField(source="evenement.titre",read_only=True)
    evenement_type = serializers.CharField(source="evenement.type_event",read_only=True)
    evenement_date = serializers.DateTimeField(source="evenement.date_debut",read_only=True)
    evenement_lieu = serializers.CharField(source="evenement.lieu",read_only=True)
    class Meta:
        model = Notification
        fields = ["id","evenement","evenement_titre","evenement_type","evenement_date","evenement_lieu","lu","date_lecture","date_envoi"]

class AlerteSerializer(serializers.ModelSerializer):
    class Meta:
        model = AlerteCampus
        fields = "__all__"
        read_only_fields = ["cree_par","date_creation"]
    def create(self,validated_data):
        validated_data["cree_par"] = self.context["request"].user
        return super().create(validated_data)
