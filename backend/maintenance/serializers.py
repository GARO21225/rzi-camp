from rest_framework import serializers
from .models import Incident, CommentaireIncident
from django.contrib.auth.models import User

class CommentaireSerializer(serializers.ModelSerializer):
    auteur_nom     = serializers.SerializerMethodField()
    type_label     = serializers.CharField(source='get_type_comment_display', read_only=True)

    def get_auteur_nom(self, obj):
        if obj.auteur:
            return f"{obj.auteur.first_name} {obj.auteur.last_name}".strip() or obj.auteur.username
        return '—'

    class Meta:
        model  = CommentaireIncident
        fields = '__all__'
        read_only_fields = ['auteur', 'date_creation']

class IncidentSerializer(serializers.ModelSerializer):
    auteur_nom     = serializers.SerializerMethodField()
    assigne_nom    = serializers.SerializerMethodField()
    statut_label   = serializers.CharField(source='get_statut_display', read_only=True)
    priorite_label = serializers.CharField(source='get_priorite_display', read_only=True)
    commentaires   = CommentaireSerializer(many=True, read_only=True)
    sla_restant_h  = serializers.SerializerMethodField()
    temps_ecoule_h = serializers.SerializerMethodField()

    def get_auteur_nom(self, obj):
        if obj.auteur:
            return f"{obj.auteur.first_name} {obj.auteur.last_name}".strip() or obj.auteur.username
        return '—'

    def get_assigne_nom(self, obj):
        if obj.assigne_a:
            return f"{obj.assigne_a.first_name} {obj.assigne_a.last_name}".strip() or obj.assigne_a.username
        return None

    def get_sla_restant_h(self, obj):
        return obj.sla_restant_h

    def get_temps_ecoule_h(self, obj):
        return obj.temps_ecoule_h

    class Meta:
        model  = Incident
        fields = '__all__'
        read_only_fields = ['auteur', 'date_creation', 'date_assignation', 'date_debut',
                            'date_resolution', 'date_cloture', 'sla_echeance', 'sla_depasse']
