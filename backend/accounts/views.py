from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, IsAdminUser
from rest_framework.response import Response
from rest_framework import status
from django.contrib.auth.models import User
from .serializers import UserSerializer

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def me(request):
    return Response(UserSerializer(request.user).data)

@api_view(["GET"])
@permission_classes([IsAdminUser])
def liste_users(request):
    """Liste tous les utilisateurs (admin seulement)"""
    users = User.objects.all().select_related("profile").order_by("username")
    return Response(UserSerializer(users, many=True).data)

@api_view(["POST"])
@permission_classes([IsAdminUser])
def toggle_user_active(request, user_id):
    """Activer/désactiver un compte utilisateur"""
    try:
        u = User.objects.get(pk=user_id)
    except User.DoesNotExist:
        return Response({"error": "Utilisateur non trouvé"}, status=404)
    if u.is_superuser and not request.user.is_superuser:
        return Response({"error": "Ne peut pas désactiver un superadmin"}, status=403)
    u.is_active = not u.is_active
    u.save(update_fields=["is_active"])
    return Response({
        "ok": True,
        "is_active": u.is_active,
        "message": f"Compte {'activé' if u.is_active else 'désactivé'} : {u.username}"
    })

@api_view(["DELETE"])
@permission_classes([IsAdminUser])
def delete_user(request, user_id):
    """Supprimer un utilisateur"""
    try:
        u = User.objects.get(pk=user_id)
    except User.DoesNotExist:
        return Response({"error": "Utilisateur non trouvé"}, status=404)
    if u == request.user:
        return Response({"error": "Impossible de supprimer son propre compte"}, status=400)
    if u.is_superuser and not request.user.is_superuser:
        return Response({"error": "Non autorisé"}, status=403)
    username = u.username
    u.delete()
    return Response({"ok": True, "message": f"Utilisateur {username} supprimé"})

@api_view(["POST"])
@permission_classes([IsAdminUser])
def assigner_role(request, user_id):
    """Assigner un rôle à un utilisateur"""
    try:
        u = User.objects.get(pk=user_id)
    except User.DoesNotExist:
        return Response({"error": "Utilisateur non trouvé"}, status=404)
    role = request.data.get("role")
    valid = ["admin","agent","restauration","technicien","menage"]
    if role not in valid:
        return Response({"error": f"Rôle invalide. Valeurs: {valid}"}, status=400)
    profile = u.profile
    profile.role = role
    profile.save(update_fields=["role"])
    if role == "admin":
        u.is_staff = True
        u.save(update_fields=["is_staff"])
    return Response({"ok": True, "role": role})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def change_password(request):
    """Modifier son propre mot de passe"""
    user = request.user
    old_pwd  = request.data.get("ancien_mot_de_passe", "")
    new_pwd  = request.data.get("nouveau_mot_de_passe", "")
    confirm  = request.data.get("confirmer_mot_de_passe", "")

    if not user.check_password(old_pwd):
        return Response({"error": "Ancien mot de passe incorrect"}, status=400)
    if len(new_pwd) < 6:
        return Response({"error": "Le nouveau mot de passe doit faire au moins 6 caractères"}, status=400)
    if new_pwd != confirm:
        return Response({"error": "Les mots de passe ne correspondent pas"}, status=400)

    user.set_password(new_pwd)
    user.save()
    return Response({"message": "Mot de passe modifié avec succès ✅"})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def reset_user_password(request, user_id):
    """Admin: réinitialiser le mot de passe d'un utilisateur"""
    if not (request.user.is_staff or request.user.is_superuser):
        return Response({"error": "Admin requis"}, status=403)
    try:
        target = User.objects.get(pk=user_id)
    except User.DoesNotExist:
        return Response({"error": "Utilisateur non trouvé"}, status=404)
    new_pwd = request.data.get("mot_de_passe", "rzi2026!")
    target.set_password(new_pwd)
    target.save()
    return Response({"message": f"Mot de passe réinitialisé pour {target.username}"})
