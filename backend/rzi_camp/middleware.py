"""
Filet de securite GLOBAL, uniquement pour /api/ : si une exception
s'echappe d'une vue sans etre attrapee AVANT d'atteindre Django lui-meme
(donc meme si le try/except pose dans la vue elle-meme, comme dans
accounts/views.py::demander_otp, ne suffisait pas - hypothese non encore
exclue au moment d'ecrire ce fichier), ce middleware la capture ICI et
renvoie du JSON avec le traceback complet au lieu de laisser Django
repondre avec sa page HTML generique (DEBUG=False en prod) qui ne dit
rien d'exploitable.

Contexte precis qui a motive ce fichier : /api/auth/otp/demander/
renvoie de facon 100% reproductible une reponse HTML generique de 145
octets malgre un demander_otp() dont TOUT le corps est deja enveloppe
dans un try/except qui renvoie systematiquement une Response(JSON) sur
n'importe quelle exception (voir accounts/views.py + le test de
regression accounts/tests.py::test_demander_otp_exception_imprevue...).
Comme ce test prouve, via le client de test Django (qui appelle la vue
directement, sans passer par gunicorn/uvicorn/nginx), que le code de la
vue lui-meme est solide, l'exception doit forcement se produire ailleurs
dans la chaine de traitement de la requete (middleware, resolution
d'URL...) - un endroit que seul un hook Django de bas niveau comme
process_exception() peut intercepter. Ce fichier est le dernier filet
possible avant la page HTML muette de Django.

Volontairement TEMPORAIRE-DIAGNOSTIC dans son ampleur (inclut le
traceback complet dans la reponse) : ce n'est pas une bonne pratique a
garder telle quelle indefiniment sur un serveur expose publiquement (fuite
d'information), mais c'est strictement necessaire ici pour sortir enfin
d'un cycle de correctifs a l'aveugle qui n'a pas fonctionne deux fois de
suite malgre des verifications completes du code Python. A restreindre
(ou retirer) une fois la vraie cause trouvee et corrigee.
"""
import logging
import traceback

from django.http import JsonResponse

logger = logging.getLogger(__name__)


class JsonErrorMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        return self.get_response(request)

    def process_exception(self, request, exception):
        if not request.path.startswith("/api/"):
            return None  # ne touche jamais aux pages du frontend (SPA React)

        tb = traceback.format_exc()
        logger.error("JsonErrorMiddleware — exception non attrapee sur %s :\n%s", request.path, tb)
        return JsonResponse(
            {
                "error": f"Erreur serveur non geree : {exception}",
                "type": type(exception).__name__,
                "traceback": tb,
                "chemin": request.path,
            },
            status=500,
        )


class SlowRequestMiddleware:
    """Journalise (WARNING « LENT ») toute requête /api/ plus longue que SLOW_REQUEST_MS (défaut 700 ms) avec
    le nombre et la durée cumulée des requêtes SQL : `docker compose logs backend | grep LENT`."""

    def __init__(self, get_response):
        import os
        self.get_response = get_response
        self.seuil = float(os.environ.get("SLOW_REQUEST_MS", "700")) / 1000.0

    def __call__(self, request):
        import time
        from django.db import connection
        if not request.path.startswith("/api/"):
            return self.get_response(request)
        stats = {"n": 0, "t": 0.0}

        def compter(execute, sql, params, many, context):
            t0 = time.perf_counter()
            try:
                return execute(sql, params, many, context)
            finally:
                stats["n"] += 1
                stats["t"] += time.perf_counter() - t0

        debut = time.perf_counter()
        with connection.execute_wrapper(compter):
            reponse = self.get_response(request)
        total = time.perf_counter() - debut
        if total >= self.seuil:
            logging.getLogger("rzi.slow").warning("LENT %s %s %d — %.0f ms total, SQL %.0f ms (%d requêtes), user=%s",
                                                 request.method, request.path, getattr(reponse, "status_code", 0), total * 1000,
                                                 stats["t"] * 1000, stats["n"], getattr(request.user, "id", None))
        return reponse
