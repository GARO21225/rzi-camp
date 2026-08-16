"""
ASGI config for rzi_camp project.
"""
import os

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "rzi_camp.settings")

from django.core.asgi import get_asgi_application


ALLOWED_ORIGINS = {
    "http://204.168.229.74:5173",
    "http://localhost:5173",
    "http://localhost:3000",
    "http://127.0.0.1:5173",
}


class CORSMiddleware:
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        headers_in = dict(scope.get("headers", []))
        origin = headers_in.get(b"origin", b"").decode("latin1")
        method = scope.get("method", "").upper()

        # IMPORTANT :
        # Le preflight CORS doit être traité AVANT Django/DRF.
        # Sinon DRF applique JWTAuthentication et retourne 401.
        if method == "OPTIONS" and origin in ALLOWED_ORIGINS:
            await send({
                "type": "http.response.start",
                "status": 200,
                "headers": [
                    (b"access-control-allow-origin", origin.encode()),
                    (b"access-control-allow-credentials", b"true"),
                    (
                        b"access-control-allow-methods",
                        b"GET, POST, PUT, PATCH, DELETE, OPTIONS",
                    ),
                    (
                        b"access-control-allow-headers",
                        b"accept, authorization, content-type, origin, x-requested-with",
                    ),
                    (b"access-control-max-age", b"86400"),
                    (b"vary", b"Origin"),
                    (b"content-length", b"0"),
                ],
            })

            await send({
                "type": "http.response.body",
                "body": b"",
            })
            return

        async def send_with_cors(event):
            if event["type"] == "http.response.start":
                headers = list(event.get("headers", []))

                if origin in ALLOWED_ORIGINS:
                    headers.extend([
                        (b"access-control-allow-origin", origin.encode()),
                        (b"access-control-allow-credentials", b"true"),
                        (
                            b"access-control-allow-methods",
                            b"GET, POST, PUT, PATCH, DELETE, OPTIONS",
                        ),
                        (
                            b"access-control-allow-headers",
                            b"accept, authorization, content-type, origin, x-requested-with",
                        ),
                        (b"access-control-max-age", b"86400"),
                        (b"vary", b"Origin"),
                    ])

                event["headers"] = headers

            await send(event)

        await self.app(scope, receive, send_with_cors)


django_asgi_app = get_asgi_application()

_http_app = CORSMiddleware(django_asgi_app)


try:
    from channels.routing import ProtocolTypeRouter, URLRouter
    from channels.auth import AuthMiddlewareStack
    from django.urls import re_path
    from evenements.consumers import NotificationConsumer

    application = ProtocolTypeRouter({
        "http": _http_app,
        "websocket": AuthMiddlewareStack(
            URLRouter([
                re_path(
                    r"ws/notifications/$",
                    NotificationConsumer.as_asgi(),
                ),
            ])
        ),
    })

except Exception:
    application = _http_app
