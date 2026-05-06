from rest_framework import serializers
from .models import Incident
from django.contrib.auth.models import User

class IncidentSerializer(serializers.ModelSerializer):
    auteur_nom = serializers.SerializerMethodField()
    class Meta:
        model = Incident
        fields = '__all__'
        read_only_fields = ['auteur', 'date_creation']
    def get_auteur_nom(self, obj):
        return obj.auteur.get_full_name() or obj.auteur.username if obj.auteur else '—'
    def create(self, validated_data):
        validated_data['auteur'] = self.context['request'].user
        return super().create(validated_data)
