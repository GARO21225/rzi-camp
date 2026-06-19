"""Permissions DRF partagées entre apps.

TokenInQueryOrHeader permet l'authentification JWT via le header Authorization
classique OU via un paramètre ?token=<jwt> dans l'URL.

Usage : exports CSV déclenchés par <a href> ou window.open() depuis le frontend,
qui ne peuvent pas attacher de header HTTP custom (contrairement aux appels Axios).
Le token doit alors voyager dans l'URL elle-même.

Limite acceptée : un token dans une URL peut se retrouver dans des logs serveur/proxy
ou l'historique du navigateur. Acceptable ici car (1) c'est un token d'accès JWT
de courte-moyenne durée, pas un mot de passe, et (2) l'alternative (rendre ces
exports AllowAny) expose les mêmes données sans aucune protection à quiconque
sur internet. Ne pas réutiliser ce pattern pour des endpoints qui modifient des données.
"""
from rest_framework.permissions import IsAuthenticated
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError


class TokenInQueryOrHeader(IsAuthenticated):
    def has_permission(self, request, view):
        # Si déjà authentifié via le header standard, ne rien faire de plus
        if request.user and request.user.is_authenticated:
            return True
        # Sinon, tenter avec ?token= dans la query string
        token = request.query_params.get('token')
        if not token:
            return False
        try:
            validated = JWTAuthentication().get_validated_token(token)
            user = JWTAuthentication().get_user(validated)
            request.user = user
            return True
        except (InvalidToken, TokenError, Exception):
            return False
