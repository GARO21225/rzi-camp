"""Point de contrôle ultra-léger interrogé toutes les 5 s par le navigateur.

Renvoie de simples « signatures » (comptes + dates max) : le frontend ne recharge une page
que lorsque la signature de son domaine change. Résultat mis en cache 3 s par utilisateur,
donc quelle que soit l'affluence la base reçoit au plus ~1 calcul / 3 s / utilisateur.
"""
from django.core.cache import cache
from django.db.models import Count, Max, Q
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

TTL_S = 3


def _sig(d):
    return "|".join(str(v) for v in d.values())


def _calculer(u):
    profil = getattr(getattr(u, "profile", None), "role", "")
    admin = bool(u.is_staff or u.is_superuser or profil == "admin")
    technicien = profil == "technicien"
    out = {}

    from evenements.models import SimpleNotification, Notification
    n = SimpleNotification.objects.filter(user=u)
    a = n.aggregate(non_lues=Count("id", filter=Q(lu=False)), dernier=Max("id"))
    ev = 0
    try:
        if hasattr(u, "personnel"):
            ev = Notification.objects.filter(personnel=u.personnel, lu=False).count()
    except Exception:
        pass
    out["notifs"] = {"non_lues": (a["non_lues"] or 0) + ev, "dernier": a["dernier"] or 0}

    from residences.models import Demande, Plainte
    dq = Demande.objects.all() if admin else Demande.objects.filter(demandeur=u)
    a = dq.aggregate(n=Count("id"), att=Count("id", filter=Q(statut="en_attente")), prop=Count("id", filter=Q(statut="proposition")),
                     dernier=Max("id"), t=Max("date_traitement"), r=Max("date_reponse"))
    out["demandes"] = {"sig": _sig(a)}

    from maintenance.models import Incident
    iq = Incident.objects.all() if admin else (Incident.objects.filter(Q(assigne_a=u) | Q(auteur=u)) if technicien else Incident.objects.filter(auteur=u))
    a = iq.aggregate(n=Count("id"), nouv=Count("id", filter=Q(statut="declare")), dernier=Max("id"), asg=Max("date_assignation"),
                     deb=Max("date_debut"), res=Max("date_resolution"), clo=Max("date_cloture"))
    out["incidents"] = {"sig": _sig(a)}

    pq = Plainte.objects.all() if admin else (Plainte.objects.filter(Q(affecte_a=u) | Q(utilisateur=u)) if technicien else Plainte.objects.filter(utilisateur=u))
    a = pq.aggregate(n=Count("id"), nouv=Count("id", filter=Q(statut="nouvelle")), dernier=Max("id"), aff=Max("date_affectation"),
                     pec=Max("date_prise_en_charge"), res=Max("date_resolution"), clo=Max("date_cloture"), qua=Max("date_qualification"))
    out["plaintes"] = {"sig": _sig(a)}
    return out


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def pulse(request):
    cle = f"pulse:{request.user.id}"
    d = cache.get(cle)
    if d is None:
        d = _calculer(request.user)
        cache.set(cle, d, TTL_S)
    return Response(d)
