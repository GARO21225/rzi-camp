"""
ASGI config for rzi_camp project.
"""
import os

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "rzi_camp.settings")

# Import Django ASGI application early to ensure AppConfig is ready
from django.core.asgi import get_asgi_application

django_asgi_app = get_asgi_application()

# Only enable WebSocket if channels is properly configured
try:
    from channels.routing import ProtocolTypeRouter, URLRouter
    from channels.auth import AuthMiddlewareStack
    from django.urls import re_path
    from evenements.consumers import NotificationConsumer

    application = ProtocolTypeRouter({
        "http": django_asgi_app,
        "websocket": AuthMiddlewareStack(URLRouter([
            re_path(r"ws/notifications/$", NotificationConsumer.as_asgi()),
        ])),
    })
except Exception as e:
    # Fallback: HTTP only (no WebSocket) — polling still works
    application = django_asgi_app
