from rest_framework import serializers
from django.contrib.auth.models import User
from .models import Profile, RoleCustom

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
