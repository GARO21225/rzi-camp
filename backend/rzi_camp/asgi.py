"""
ASGI config for rzi_camp project.
"""
import os

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "rzi_camp.settings")

from django.core.asgi import get_asgi_application

django_asgi_app = get_asgi_application()

# Wrapper CORS explicite pour Daphne/ASGI
# django-cors-headers ne s'applique pas automatiquement en mode ASGI
class CORSMiddleware:
    """Ajoute les headers CORS sur TOUTES les réponses ASGI, y compris les 500."""
    ORIGINS = [
        "https://rzi-camp-frontend.onrender.com",
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
    ]

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] == "http":
            origin = ""
            for k, v in scope.get("headers", []):
                if k == b"origin":
                    origin = v.decode("latin1")
                    break

            async def send_with_cors(event):
                if event["type"] == "http.response.start":
                    headers = list(event.get("headers", []))
                    # Ajouter CORS sur toutes les réponses
                    allow_origin = origin if origin in self.ORIGINS else "https://rzi-camp-frontend.onrender.com"
                    cors_headers = [
                        (b"access-control-allow-origin",      allow_origin.encode()),
                        (b"access-control-allow-credentials", b"true"),
                        (b"access-control-allow-methods",     b"GET, POST, PUT, PATCH, DELETE, OPTIONS"),
                        (b"access-control-allow-headers",     b"accept, authorization, content-type, origin, x-requested-with"),
                        (b"access-control-max-age",           b"86400"),
                        (b"vary",                             b"Origin"),
                    ]
                    # Ne pas dupliquer si déjà présent
                    existing = {h[0].lower() for h in headers}
                    for h in cors_headers:
                        if h[0] not in existing:
                            headers.append(h)
                    event = {**event, "headers": headers}
                await send(event)

            # Répondre aux preflight OPTIONS directement (évite un aller-retour Django)
            if scope.get("method", "") == "OPTIONS":
                await send_with_cors({"type": "http.response.start", "status": 200, "headers": []})
                await send({"type": "http.response.body", "body": b""})
                return

            await self.app(scope, receive, send_with_cors)
        else:
            await self.app(scope, receive, send)


try:
    from channels.routing import ProtocolTypeRouter, URLRouter
    from channels.auth import AuthMiddlewareStack
    from django.urls import re_path
    from evenements.consumers import NotificationConsumer

    _http_app = CORSMiddleware(django_asgi_app)

    application = ProtocolTypeRouter({
        "http": _http_app,
        "websocket": AuthMiddlewareStack(URLRouter([
            re_path(r"ws/notifications/$", NotificationConsumer.as_asgi()),
        ])),
    })
except Exception as e:
    # Fallback: HTTP only avec CORS
    application = CORSMiddleware(django_asgi_app)
