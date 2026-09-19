from rest_framework import serializers
from django.contrib.auth.models import User
from .models import Profile, RoleCustom, RapportPlanifie

class ProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = Profile
        fields = ["role","societe","telephone"]

class UserSerializer(serializers.ModelSerializer):
    profile = ProfileSerializer(read_only=True)
    class Meta:
        model = User
        fields = ["id","username","first_name","last_name","email","is_staff","is_superuser","profile"]

class RoleCustomSerializer(serializers.ModelSerializer):
    class Meta:
        model = RoleCustom
        fields = ["id","code","label","menu_pages","readonly","est_systeme","date_creation"]
        read_only_fields = ["est_systeme","date_creation"]

class RapportPlanifieSerializer(serializers.ModelSerializer):
    frequence_label = serializers.CharField(source="get_frequence_display", read_only=True)
    class Meta:
        model = RapportPlanifie
        fields = ["id","nom","frequence","frequence_label","jour_semaine","jour_mois","heure",
                  "destinataires","actif","derniere_execution","date_creation"]
        read_only_fields = ["derniere_execution","date_creation"]

    def validate_destinataires(self, value):
        if not isinstance(value, list) or not value:
            raise serializers.ValidationError("Au moins une adresse email destinataire est requise.")
        for e in value:
            if "@" not in str(e):
                raise serializers.ValidationError(f"Adresse invalide : {e}")
        return value
