from rest_framework import serializers
from .models import Batiment

class BatimentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Batiment
        fields = '__all__'

class BatimentGeoSerializer(serializers.ModelSerializer):
    class Meta:
        model = Batiment
        fields = ['id','residence','bloc','statut','occupant','societe','latitude','longitude','geojson_geometry']
