"""
Permissions RBAC — Induction Module
"""
from rest_framework.permissions import BasePermission, IsAuthenticated, SAFE_METHODS


class IsInductionAdmin(BasePermission):
    """Admin induction : peut tout faire."""
    def has_permission(self, request, view):
        return (request.user and request.user.is_authenticated and
                (request.user.is_staff or
                 request.user.groups.filter(name='InductionAdmin').exists()))


class IsHRAgent(BasePermission):
    """Agent RH : peut valider documents et voir tout."""
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        return (request.user.is_staff or
                request.user.groups.filter(name__in=['InductionAdmin', 'RH']).exists())


class IsMedicalAgent(BasePermission):
    """Agent médical : peut saisir visites médicales."""
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        return (request.user.is_staff or
                request.user.groups.filter(name__in=['InductionAdmin', 'Medical']).exists())


class IsAccessAgent(BasePermission):
    """Agent d'accès : peut scanner QR et voir logs."""
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        return (request.user.is_staff or
                request.user.groups.filter(name__in=['InductionAdmin', 'AccessAgent']).exists())


class IsSiteSupervisor(BasePermission):
    """Superviseur de site : peut voir les données de ses sites."""
    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated

    def has_object_permission(self, request, view, obj):
        user = request.user
        if user.is_staff:
            return True
        # Vérifier si superviseur du site lié à l'objet
        site = getattr(obj, 'site', None)
        if site and hasattr(site, 'superviseurs'):
            return site.superviseurs.filter(id=user.id).exists()
        return False


class IsEmployeeOwner(BasePermission):
    """L'employé peut accéder à ses propres données."""
    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated

    def has_object_permission(self, request, view, obj):
        user = request.user
        if user.is_staff or user.groups.filter(name__in=['InductionAdmin','RH']).exists():
            return True
        # Vérifier si l'objet appartient à cet utilisateur
        employee = getattr(obj, 'employee', obj)
        return (hasattr(employee, 'user') and employee.user == user)


class IsAdminOrReadOnly(BasePermission):
    """Admin full access, autres read-only."""
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.method in SAFE_METHODS:
            return True
        return (request.user.is_staff or
                request.user.groups.filter(name='InductionAdmin').exists())
