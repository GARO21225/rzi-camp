"""Restaurants du camp, affectation des superviseurs (par le Camp Boss),
reglages du scan et rapport detaille."""
import datetime
from django.contrib.auth.models import User
from django.utils import timezone
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import Restaurant, SuperviseurRestaurant
from .rapport import agreger, bornes

CLE_SCAN_RESERVE = "resto_scan_superviseurs_only"
ROLES_CAMP_BOSS = ("camp_boss",)


def _role(u):
    return getattr(getattr(u, "profile", None), "role", "") or ""


def est_admin(u):
    return bool(u.is_staff or u.is_superuser or _role(u) == "admin")


def peut_gerer(u):
    """Camp Boss : administrateur ou role « camp_boss » (a creer dans Paramétrage > Rôles)."""
    return est_admin(u) or _role(u) in ROLES_CAMP_BOSS


def scan_reserve():
    from accounts.models import Parametre
    return str(Parametre.get(CLE_SCAN_RESERVE, "1")).strip() not in ("0", "false", "False", "")


def restaurants_supervises(u):
    return Restaurant.objects.filter(actif=True, superviseurs__user=u).distinct()


def resoudre_restaurant_scan(request):
    """Retourne (restaurant|None, reponse_erreur|None) pour un scan de repas."""
    u = request.user
    rid = request.data.get("restaurant_id")
    rid = int(rid) if str(rid or "").isdigit() else None
    mes = list(restaurants_supervises(u))
    if est_admin(u) or peut_gerer(u):
        r = Restaurant.objects.filter(pk=rid, actif=True).first() if rid else (mes[0] if len(mes) == 1 else None)
        return r, None
    if not mes:
        if scan_reserve():
            return None, Response({"valid": False, "erreur": "Seul un superviseur affecté à un restaurant peut scanner. Contactez le Camp Boss."}, status=403)
        return (Restaurant.objects.filter(pk=rid, actif=True).first() if rid else None), None
    if rid:
        r = next((x for x in mes if x.id == rid), None)
        if not r:
            return None, Response({"valid": False, "erreur": "Vous n'êtes pas superviseur de ce restaurant."}, status=403)
        return r, None
    if len(mes) == 1:
        return mes[0], None
    return None, Response({"valid": False, "erreur": "Choisissez le restaurant où vous scannez."}, status=400)


def _nom_user(u):
    return u.get_full_name() or u.username


def _ser(r):
    return {"id": r.id, "nom": r.nom, "ordre": r.ordre, "actif": r.actif,
            "superviseurs": [{"id": s.user_id, "nom": _nom_user(s.user)} for s in r.superviseurs.all()]}


class RestaurantViewSet(viewsets.ViewSet):
    permission_classes = [IsAuthenticated]

    def _gestion(self, request):
        if not peut_gerer(request.user):
            return Response({"error": "Réservé au Camp Boss / administrateur."}, status=403)

    def list(self, request):
        qs = Restaurant.objects.prefetch_related("superviseurs__user")
        if not peut_gerer(request.user):
            qs = qs.filter(actif=True)
        return Response([_ser(r) for r in qs])

    def create(self, request):
        err = self._gestion(request)
        if err: return err
        nom = (request.data.get("nom") or "").strip()[:100]
        if not nom:
            return Response({"error": "Nom requis"}, status=400)
        if Restaurant.objects.filter(nom__iexact=nom).exists():
            return Response({"error": "Ce restaurant existe déjà"}, status=400)
        r = Restaurant.objects.create(nom=nom, ordre=(Restaurant.objects.count() + 1))
        return Response(_ser(r), status=201)

    def partial_update(self, request, pk=None):
        err = self._gestion(request)
        if err: return err
        r = Restaurant.objects.filter(pk=pk).first()
        if not r:
            return Response({"error": "Introuvable"}, status=404)
        if "nom" in request.data:
            nom = (request.data["nom"] or "").strip()[:100]
            if not nom or Restaurant.objects.filter(nom__iexact=nom).exclude(pk=r.pk).exists():
                return Response({"error": "Nom vide ou déjà utilisé"}, status=400)
            r.nom = nom
        if "actif" in request.data:
            r.actif = bool(request.data["actif"])
        if "ordre" in request.data:
            try: r.ordre = max(0, int(request.data["ordre"]))
            except (TypeError, ValueError): pass
        r.save()
        return Response(_ser(r))

    def destroy(self, request, pk=None):
        err = self._gestion(request)
        if err: return err
        r = Restaurant.objects.filter(pk=pk).first()
        if not r:
            return Response({"error": "Introuvable"}, status=404)
        if r.repas.exists():  # on garde l'historique : désactivation plutôt que suppression
            r.actif = False
            r.save(update_fields=["actif"])
            return Response({"desactive": True})
        r.delete()
        return Response(status=204)

    @action(detail=True, methods=["post"])
    def affecter(self, request, pk=None):
        """Remplace la liste des superviseurs du restaurant : {user_ids:[...]}"""
        err = self._gestion(request)
        if err: return err
        r = Restaurant.objects.filter(pk=pk).first()
        if not r:
            return Response({"error": "Introuvable"}, status=404)
        try:
            ids = {int(i) for i in (request.data.get("user_ids") or [])}
        except (TypeError, ValueError):
            return Response({"error": "user_ids invalide"}, status=400)
        users = {u.id: u for u in User.objects.filter(pk__in=ids, is_active=True)}
        r.superviseurs.exclude(user_id__in=users).delete()
        for uid, u in users.items():
            SuperviseurRestaurant.objects.get_or_create(restaurant=r, user=u, defaults={"affecte_par": request.user})
        self._prevenir(users.values(), r, request.user)
        return Response(_ser(Restaurant.objects.prefetch_related("superviseurs__user").get(pk=r.pk)))

    def _prevenir(self, users, resto, par):
        try:
            from evenements.models import SimpleNotification
            deja = set(SimpleNotification.objects.filter(titre=f"🍽️ Superviseur — {resto.nom}"[:200],
                                                         user__in=list(users)).values_list("user_id", flat=True))
            SimpleNotification.objects.bulk_create([
                SimpleNotification(user=u, type_notif="info", titre=f"🍽️ Superviseur — {resto.nom}"[:200],
                                   message=f"{_nom_user(par)} vous a affecté superviseur du {resto.nom} : vous scannez les QR des agents à l'entrée.")
                for u in users if u.id not in deja])
        except Exception:
            pass

    @action(detail=False, methods=["get"])
    def mes(self, request):
        u = request.user
        if est_admin(u) or peut_gerer(u):
            qs = Restaurant.objects.filter(actif=True)
        else:
            qs = restaurants_supervises(u)
        return Response({"restaurants": [{"id": r.id, "nom": r.nom} for r in qs],
                         "scan_reserve": scan_reserve(), "peut_gerer": peut_gerer(u)})

    @action(detail=False, methods=["get"])
    def candidats(self, request):
        err = self._gestion(request)
        if err: return err
        q = (request.query_params.get("q") or "").strip()
        qs = User.objects.filter(is_active=True).select_related("profile")
        if q:
            from django.db.models import Q
            qs = qs.filter(Q(username__icontains=q) | Q(first_name__icontains=q) | Q(last_name__icontains=q))
        return Response([{"id": x.id, "nom": _nom_user(x), "role": _role(x)} for x in qs.order_by("first_name", "username")[:60]])

    @action(detail=False, methods=["get", "post"])
    def reglages(self, request):
        err = self._gestion(request)
        if err: return err
        from accounts.models import Parametre
        if request.method == "POST":
            if "scan_reserve" in request.data:
                Parametre.objects.update_or_create(cle=CLE_SCAN_RESERVE, defaults={
                    "valeur": "1" if request.data.get("scan_reserve") else "0",
                    "description": "Scan des repas réservé aux superviseurs affectés à un restaurant"})
            if "qr_signe_obligatoire" in request.data:
                Parametre.objects.update_or_create(cle="resto_qr_signe_obligatoire", defaults={
                    "valeur": "1" if request.data.get("qr_signe_obligatoire") else "0",
                    "description": "Le scan n'accepte que les QR signés (refuse le numéro seul)"})
        from residences.models import Personnel
        non_signes = sum(1 for pk, qr in Personnel.objects.filter(actif=True).values_list("pk", "qr_code_string")
                         if qr != Personnel.qr_signe(pk))
        return Response({"scan_reserve": scan_reserve(),
                         "qr_signe_obligatoire": str(Parametre.get("resto_qr_signe_obligatoire", "1")).strip() not in ("0", "false", ""),
                         "qr_non_signes": non_signes})

    @action(detail=False, methods=["get"])
    def rapport(self, request):
        u = request.user
        if not (peut_gerer(u) or _role(u) == "restauration" or restaurants_supervises(u).exists()):
            return Response({"error": "Accès refusé"}, status=403)
        today = timezone.localdate()
        try:
            fin = datetime.date.fromisoformat(request.query_params.get("fin", ""))
        except ValueError:
            fin = today
        try:
            debut = datetime.date.fromisoformat(request.query_params.get("debut", ""))
        except ValueError:
            debut = fin - datetime.timedelta(days=6)
        if debut > fin or (fin - debut).days > 370:
            return Response({"error": "Période invalide (370 jours max)"}, status=400)
        ids = None
        if not (peut_gerer(u) or _role(u) == "restauration"):
            ids = list(restaurants_supervises(u).values_list("id", flat=True))
        rid = request.query_params.get("restaurant")
        if str(rid or "").isdigit():
            ids = [int(rid)] if ids is None else [i for i in ids if i == int(rid)]
        tr = request.query_params.get("repas")
        tr = tr if tr in ("petit_dejeuner", "dejeuner", "diner") else None
        return Response(agreger(debut, fin, ids, tr))


    @action(detail=False, methods=["post"])
    def envoyer_rapport(self, request):
        """Envoie CE rapport (période choisie) par email : {debut, fin, emails:[...]} - Camp Boss / admin."""
        err = self._gestion(request)
        if err: return err
        from accounts.email import envoyer_email
        from accounts.models import Parametre
        from accounts.rapports_email import generer_contenu_rapport
        emails = [e.strip() for e in (request.data.get("emails") or []) if "@" in str(e)]
        if not emails:
            return Response({"error": "Au moins une adresse email valide."}, status=400)
        if Parametre.get("email_provider", "test") == "test":
            return Response({"error": "Fournisseur email sur « test » : activer Resend dans Paramétrage → Connexion par Email."}, status=400)
        try:
            datetime.date.fromisoformat(str(request.data.get("debut")))
            datetime.date.fromisoformat(str(request.data.get("fin")))
        except ValueError:
            return Response({"error": "Période invalide"}, status=400)
        sujet, corps = generer_contenu_rapport("Rapport Restauration", "restauration",
                                               {"resto_periode": "perso", "resto_debut": str(request.data["debut"]), "resto_fin": str(request.data["fin"])})
        ok_n, erreurs = 0, []
        for dest in emails[:20]:
            ok, info = envoyer_email(dest, sujet, corps, type_message="rapport", campagne="Rapport Restauration")
            if ok: ok_n += 1
            else: erreurs.append(f"{dest} : {info}")
        if not ok_n:
            return Response({"error": "Échec : " + " ; ".join(erreurs)}, status=400)
        return Response({"ok": True, "envoyes": ok_n, "erreurs": erreurs})
