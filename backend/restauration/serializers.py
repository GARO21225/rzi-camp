from rest_framework import serializers
from .models import QRToken, RepasLog, AuditLog

class QRTokenSerializer(serializers.ModelSerializer):
    class Meta:
        model = QRToken
        fields = ['id','token','residence','resident','cree_le','expire_le','utilise']

class RepasLogSerializer(serializers.ModelSerializer):
    resident = serializers.CharField(source='qr_token.resident')
    residence = serializers.CharField(source='qr_token.residence')
    class Meta:
        model = RepasLog
        fields = ['id','resident','residence','date_validation']

class AuditLogSerializer(serializers.ModelSerializer):
    utilisateur_nom = serializers.SerializerMethodField()
    class Meta:
        model = AuditLog
        fields = '__all__'
    def get_utilisateur_nom(self, obj):
        return obj.utilisateur.username if obj.utilisateur else 'system'
