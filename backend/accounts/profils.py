"""
Alignement des profils : Personnel.profil (profil métier saisi à la création
d'une fiche) et Profile.role (rôle réellement utilisé pour les accès/menus)
ont dérivé l'un de l'autre quand de nouveaux profils ont été créés.

Règles (sans jamais perdre d'information ni toucher aux administrateurs) :
  - « agent » est la valeur par défaut des deux champs : elle ne l'emporte jamais.
  - profil explicite  + rôle « agent »        -> le rôle prend le profil.
  - rôle explicite    + profil « agent »      -> le profil prend le rôle.
  - les deux explicites mais différents       -> le rôle (attribué via « Assigner un rôle ») fait foi,
                                                 le profil est aligné dessus.
  - admin / is_staff / is_superuser           -> jamais modifiés.
  - code inconnu de Paramétrage > Rôles & Accès -> ignoré (signalé).
"""
ALIAS = {"restaurant": "restauration"}   # ancien code de Personnel.profil


def code_role(profil):
    p = (profil or "").strip().lower()
    return ALIAS.get(p, p)


def synchroniser_profils(appliquer=True):
    from accounts.models import Profile, RoleCustom
    from residences.models import Personnel

    valides = set(RoleCustom.objects.values_list("code", flat=True))
    res = {"role_mis_a_jour": 0, "profil_mis_a_jour": 0, "inchanges": 0, "ignores": [], "details": []}
    for p in Personnel.objects.select_related("user").exclude(user__isnull=True):
        u = p.user
        prof = Profile.objects.filter(user=u).first()
        if prof is None:
            continue
        if u.is_staff or u.is_superuser or prof.role == "admin":
            res["inchanges"] += 1
            continue
        profil = code_role(p.profil) or "agent"
        role = prof.role or "agent"
        if profil == "admin":
            res["ignores"].append(f"{p.nom} {p.prenom}: profil « admin » non appliqué automatiquement")
            continue
        if profil not in valides and profil != "agent":
            res["ignores"].append(f"{p.nom} {p.prenom}: profil inconnu « {p.profil} »")
            continue
        if role == profil:
            if p.profil != profil:  # alias (restaurant -> restauration)
                if appliquer:
                    Personnel.objects.filter(pk=p.pk).update(profil=profil)
                res["profil_mis_a_jour"] += 1
            else:
                res["inchanges"] += 1
            continue
        if role == "agent" and profil != "agent":
            if appliquer:
                prof.role = profil
                prof.save(update_fields=["role"])
            res["role_mis_a_jour"] += 1
            res["details"].append(f"{p.nom} {p.prenom}: rôle agent → {profil}")
        else:
            # rôle explicite (ou conflit) : le rôle fait foi
            if appliquer:
                Personnel.objects.filter(pk=p.pk).update(profil=role)
            res["profil_mis_a_jour"] += 1
            res["details"].append(f"{p.nom} {p.prenom}: profil {p.profil or 'agent'} → {role}")
    return res
