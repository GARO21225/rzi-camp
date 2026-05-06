from rest_framework import serializers
from .models import Incident

class IncidentSerializer(serializers.ModelSerializer):
    auteur_nom = serializers.SerializerMethodField()
    photo_url = serializers.SerializerMethodField()
    class Meta:
        model = Incident
        fields = '__all__'
        read_only_fields = ['auteur','date_creation']

    def get_auteur_nom(self, obj):
        return obj.auteur.get_full_name() or obj.auteur.username if obj.auteur else '—'

    def get_photo_url(self, obj):
        if obj.photo:
            request = self.context.get('request')
            return request.build_absolute_uri(obj.photo.url) if request else obj.photo.url
        return None

    def create(self, validated_data):
        validated_data['auteur'] = self.context['request'].user
        return super().create(validated_data)
