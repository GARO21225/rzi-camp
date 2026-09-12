from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from accounts.permissions import TokenInQueryOrHeader
import datetime, csv, uuid
from django.http import HttpResponse
from .models import Voyage
from .serializers import VoyageSerializer

STATUT_MAP = {
    "planifie":"Planifié",
    "en_voyage":"En voyage",
    "retour":"Retour au camp",
    "annule":"Annulé",
}


def _check_voyage_conflit(personnel_id, date_depart, date_retour, exclude_pk=None):
    """Retourne True si la personne est déjà sur un voyage actif
    qui chevauche la période [date_depart, date_retour]."""
    qs = Voyage.objects.filter(
        personnel_id=personnel_id,
        statut__in=("planifie", "en_voyage"),
        date_depart__lte=date_retour or date_depart,
        date_retour_prevue__gte=date_depart,
    )
    if exclude_pk:
        qs = qs.exclude(pk=exclude_pk)
    return qs.first()

class VoyageViewSet(viewsets.ModelViewSet):
    queryset = Voyage.objects.select_related("personnel","batiment","enregistre_par").all()
    serializer_class = VoyageSerializer
    filter_backends = [filters.SearchFilter]
    search_fields = ["personnel__nom","personnel__prenom","destination"]

    def get_queryset(self):
        qs = Voyage.objects.select_related("personnel","batiment").all()
        statut = self.request.query_params.get("statut")
        personnel = self.request.query_params.get("personnel")
        rotation = self.request.query_params.get("rotation_id")
        if statut: qs = qs.filter(statut=statut)
        if personnel: qs = qs.filter(personnel_id=personnel)
        if rotation: qs = qs.filter(rotation_id=rotation)
        return qs

    def perform_create(self, serializer):
        voyage = serializer.save(enregistre_par=self.request.user)
        try:
            from evenements.models import SimpleNotification
            from django.contrib.auth.models import User
            for admin in User.objects.filter(is_staff=True)[:5]:
                SimpleNotification.objects.create(
                    user=admin,
                    titre="✈️ Nouveau voyage déclaré",
                    message=f"Départ vers {voyage.destination} le {voyage.date_depart}",
                    type_notif="voyage", lu=False
                )
        except Exception:
            pass

    @action(detail=True, methods=['post'])
    def valider(self, request, pk=None):
        """Valide une demande de voyage (workflow agence : demande -> validation)."""
        u = request.user
        is_admin = u.is_staff or u.is_superuser or (hasattr(u,"profile") and getattr(u.profile,"role","")=="admin")
        if not is_admin:
            return Response({"error":"Admin requis"}, status=403)
        voyage = self.get_object()
        voyage.statut_validation = "valide"
        voyage.valide_par = u
        from django.utils import timezone
        voyage.date_validation = timezone.now()
        voyage.save(update_fields=["statut_validation","valide_par","date_validation"])
        try:
            from evenements.models import SimpleNotification
            demandeur = voyage.enregistre_par
            if demandeur:
                SimpleNotification.objects.create(
                    user=demandeur, titre="✅ Voyage validé",
                    message=f"Le voyage de {voyage.personnel.nom} {voyage.personnel.prenom} vers {voyage.destination} a été validé.",
                    type_notif="voyage",
                )
        except Exception:
            pass
        return Response(VoyageSerializer(voyage).data)

    @action(detail=True, methods=['post'])
    def refuser(self, request, pk=None):
        """Refuse une demande de voyage, avec motif."""
        u = request.user
        is_admin = u.is_staff or u.is_superuser or (hasattr(u,"profile") and getattr(u.profile,"role","")=="admin")
        if not is_admin:
            return Response({"error":"Admin requis"}, status=403)
        voyage = self.get_object()
        voyage.statut_validation = "refuse"
        voyage.valide_par = u
        from django.utils import timezone
        voyage.date_validation = timezone.now()
        voyage.motif_refus = request.data.get("motif", "")
        voyage.save(update_fields=["statut_validation","valide_par","date_validation","motif_refus"])
        try:
            from evenements.models import SimpleNotification
            demandeur = voyage.enregistre_par
            if demandeur:
                SimpleNotification.objects.create(
                    user=demandeur, titre="❌ Voyage refusé",
                    message=f"Le voyage de {voyage.personnel.nom} {voyage.personnel.prenom} vers {voyage.destination} a été refusé."
                        + (f" Motif : {voyage.motif_refus}" if voyage.motif_refus else ""),
                    type_notif="voyage",
                )
        except Exception:
            pass
        return Response(VoyageSerializer(voyage).data)

    @action(detail=True, methods=['get'], permission_classes=[TokenInQueryOrHeader])
    def billet(self, request, pk=None):
        """Document imprimable de l'itinéraire complet — comme un billet
        d'agence de voyage. Ouvrable directement dans un nouvel onglet."""
        from django.http import HttpResponse
        voyage = self.get_object()
        html = _generer_billet_html(voyage)
        return HttpResponse(html, content_type="text/html; charset=utf-8")

    def destroy(self, request, *args, **kwargs):
        u = request.user
        is_admin = u.is_staff or u.is_superuser or (hasattr(u,"profile") and getattr(u.profile,"role","")=="admin")
        if not is_admin:
            return Response({"error":"Admin requis"}, status=403)
        return super().destroy(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        u = request.user
        is_admin = u.is_staff or u.is_superuser or (hasattr(u,"profile") and getattr(u.profile,"role","")=="admin")
        if not is_admin:
            return Response({"error":"Admin requis"}, status=403)
        return super().partial_update(request, *args, **kwargs)

    # ── Actions individuelles ──────────────────────────────────────
    @action(detail=True, methods=["post"])
    def partir(self, request, pk=None):
        voyage = self.get_object()
        if voyage.statut != "planifie":
            return Response({"error":"Voyage non planifié"}, status=400)
        voyage.partir()
        return Response(VoyageSerializer(voyage).data)

    @action(detail=True, methods=["post"])
    def revenir(self, request, pk=None):
        voyage = self.get_object()
        if voyage.statut != "en_voyage":
            return Response({"error":"Personnel pas en voyage"}, status=400)
        date_str = request.data.get("date_retour")
        date = datetime.date.fromisoformat(date_str) if date_str else None
        voyage.revenir(date)
        return Response(VoyageSerializer(voyage).data)

    @action(detail=True, methods=["post"])
    def annuler(self, request, pk=None):
        voyage = self.get_object()
        if voyage.statut == "en_voyage":
            return Response({"error":"Impossible d annuler un voyage déjà commencé"}, status=400)
        if voyage.statut == "retour":
            return Response({"error":"Voyage déjà terminé"}, status=400)
        voyage.statut = "annule"
        voyage.save()
        return Response({"ok": True})

    @action(detail=True, methods=["delete"])
    def supprimer_planifie(self, request, pk=None):
        voyage = self.get_object()
        if voyage.statut != "planifie":
            return Response({"error":"Seuls les voyages planifiés peuvent être supprimés"}, status=400)
        voyage.delete()
        return Response({"ok": True})

    # ── Stats ──────────────────────────────────────────────────────
    @action(detail=False, methods=["get"])
    def stats(self, request):
        from django.utils import timezone
        from datetime import timedelta
        qs = Voyage.objects.all()
        today = timezone.now().date()
        # Rappels de fin de rotation : personnes en voyage dont le retour
        # prévu approche (3 jours) ou est déjà dépassé sans avoir été
        # enregistré comme "retour" — anticipe les oublis de relève.
        en_cours = qs.filter(statut="en_voyage")
        retours_proches   = en_cours.filter(date_retour_prevue__gte=today, date_retour_prevue__lte=today+timedelta(days=3)).count()
        retours_en_retard = en_cours.filter(date_retour_prevue__lt=today).count()
        return Response({
            "total":    qs.count(),
            "planifies":qs.filter(statut="planifie").count(),
            "en_voyage":qs.filter(statut="en_voyage").count(),
            "retours":  qs.filter(statut="retour").count(),
            "annules":  qs.filter(statut="annule").count(),
            "retours_proches":   retours_proches,
            "retours_en_retard": retours_en_retard,
        })

    @action(detail=False, methods=["get"])
    def rappels_rotation(self, request):
        """Liste détaillée des retours de rotation proches ou en retard —
        pour affichage direct (nom, société, date de retour prévue)."""
        from django.utils import timezone
        from datetime import timedelta
        today = timezone.now().date()
        en_cours = (Voyage.objects.filter(statut="en_voyage")
            .select_related("personnel")
            .filter(date_retour_prevue__lte=today+timedelta(days=3))
            .order_by("date_retour_prevue"))
        return Response([{
            "id": v.id,
            "personnel_nom": f"{v.personnel.nom} {v.personnel.prenom}",
            "societe": v.personnel.societe,
            "destination": v.destination,
            "date_retour_prevue": v.date_retour_prevue,
            "en_retard": v.date_retour_prevue < today,
            "jours_restants": (v.date_retour_prevue - today).days,
        } for v in en_cours])

    # ── Rotations groupe ───────────────────────────────────────────
    @action(detail=False, methods=["get"])
    def rotations(self, request):
        from django.db.models import Count
        groupes = (Voyage.objects
            .exclude(rotation_id__isnull=True).exclude(rotation_id="")
            .values("rotation_id","destination","date_depart","date_retour_prevue",
                    "vehicule","nb_places_total","heure_depart","point_rdv",
                    "type_voyage","statut","motif")
            .annotate(nb_passagers=Count("id"))
            .order_by("-date_depart"))
        result = []
        for g in groupes:
            passagers = list(Voyage.objects.filter(rotation_id=g["rotation_id"])
                .select_related("personnel")
                .values("id","personnel__nom","personnel__prenom",
                        "personnel__societe","statut"))
            g["passagers"] = passagers
            g["places_libres"] = max(0,(g["nb_places_total"] or 15)-g["nb_passagers"])
            result.append(g)
        indiv = list(Voyage.objects
            .filter(rotation_id__isnull=True)
            .select_related("personnel")
            .values("id","personnel__nom","personnel__prenom","destination","date_depart","statut")
            .order_by("-date_depart")[:50])
        return Response({"rotations":result,"individuels":indiv,"total_rotations":len(result)})

    @action(detail=False, methods=["post"])
    def creer_rotation(self, request):
        data = request.data
        rotation_id     = str(uuid.uuid4())[:8].upper()
        destination     = data.get("destination","")
        date_depart     = data.get("date_depart")
        date_retour     = data.get("date_retour_prevue")
        vehicule        = data.get("vehicule","")
        nb_places       = int(data.get("nb_places_total",15))
        heure_depart    = data.get("heure_depart") or None
        point_rdv       = data.get("point_rdv","")
        motif           = data.get("motif","")
        type_voyage     = data.get("type_voyage","rotation")
        passagers_ids   = data.get("passagers",[])
        if not date_depart or not date_retour:
            return Response({"error":"date_depart et date_retour_prevue requis"},status=400)
        created = []
        conflicts = []
        for pid in passagers_ids:
            conflict = _check_voyage_conflit(pid, date_depart, date_retour)
            if conflict:
                try:
                    from residences.models import Personnel
                    p = Personnel.objects.get(pk=pid)
                    nom = f"{p.nom} {p.prenom}"
                except Exception:
                    nom = f"Personne #{pid}"
                conflicts.append(f"{nom} (déjà en voyage du {conflict.date_depart} au {conflict.date_retour_prevue})")
        if conflicts:
            return Response({"error": f"Impossible de créer la rotation : {len(conflicts)} conflit(s) détecté(s) — " + " | ".join(conflicts)}, status=400)

        for pid in passagers_ids:
            try:
                v = Voyage.objects.create(
                    personnel_id=pid, destination=destination,
                    date_depart=date_depart, date_retour_prevue=date_retour,
                    vehicule=vehicule, nb_places_total=nb_places,
                    heure_depart=heure_depart, point_rdv=point_rdv,
                    motif=motif, type_voyage=type_voyage,
                    rotation_id=rotation_id, statut="planifie",
                    enregistre_par=request.user,
                )
                created.append(v.id)
            except Exception:
                pass
        return Response({"rotation_id":rotation_id,"voyages_crees":len(created),"ids":created},status=201)

    @action(detail=False, methods=["post"])
    def rejoindre_rotation(self, request):
        rotation_id  = request.data.get("rotation_id")
        personnel_id = request.data.get("personnel_id")
        if not rotation_id or not personnel_id:
            return Response({"error":"rotation_id et personnel_id requis"},status=400)
        existing = Voyage.objects.filter(rotation_id=rotation_id).first()
        if not existing:
            return Response({"error":"Rotation introuvable"},status=404)
        prises = Voyage.objects.filter(rotation_id=rotation_id).count()
        if prises >= (existing.nb_places_total or 15):
            return Response({"error":"Rotation complète"},status=400)
        if Voyage.objects.filter(rotation_id=rotation_id,personnel_id=personnel_id).exists():
            return Response({"error":"Déjà inscrit sur cette rotation"},status=400)
        # Vérifier aussi si la personne est sur un autre voyage actif sur la même période
        conflict = _check_voyage_conflit(
            personnel_id, existing.date_depart, existing.date_retour_prevue
        )
        if conflict and conflict.rotation_id != rotation_id:
            return Response({"error": f"Cette personne est déjà sur un autre voyage actif du {conflict.date_depart} au {conflict.date_retour_prevue}"}, status=400)
        v = Voyage.objects.create(
            personnel_id=personnel_id, destination=existing.destination,
            date_depart=existing.date_depart, date_retour_prevue=existing.date_retour_prevue,
            vehicule=existing.vehicule, nb_places_total=existing.nb_places_total,
            heure_depart=existing.heure_depart, point_rdv=existing.point_rdv,
            motif=existing.motif, type_voyage=existing.type_voyage,
            rotation_id=rotation_id, statut="planifie",
            enregistre_par=request.user,
        )
        return Response(VoyageSerializer(v).data,status=201)

    @action(detail=False, methods=["post"])
    def partir_rotation(self, request):
        rotation_id = request.data.get("rotation_id")
        if not rotation_id:
            return Response({"error":"rotation_id requis"},status=400)
        count = 0
        for v in Voyage.objects.filter(rotation_id=rotation_id,statut="planifie"):
            try: v.partir(); count+=1
            except Exception: pass
        return Response({"ok":True,"partis":count})

    @action(detail=False, methods=["post"])
    def retour_rotation(self, request):
        rotation_id = request.data.get("rotation_id")
        if not rotation_id:
            return Response({"error":"rotation_id requis"},status=400)
        date_str = request.data.get("date_retour")
        date = datetime.date.fromisoformat(date_str) if date_str else None
        count = 0
        for v in Voyage.objects.filter(rotation_id=rotation_id,statut="en_voyage"):
            try: v.revenir(date); count+=1
            except Exception: pass
        return Response({"ok":True,"rentres":count})

    # ── Vue ensemble ───────────────────────────────────────────────
    @action(detail=False, methods=["get"])
    def vue_ensemble(self, request):
        qs = Voyage.objects.select_related("personnel","batiment").order_by("-date_depart")
        from django.db.models import Count
        top = (Voyage.objects.values("personnel__nom","personnel__prenom","personnel_id")
               .annotate(nb=Count("id")).order_by("-nb")[:10])
        voyages_data = [{
            "id":v.id,
            "personnel":f"{v.personnel.nom} {v.personnel.prenom}" if v.personnel else "—",
            "societe":v.personnel.societe if v.personnel else "—",
            "chambre":v.batiment.residence if v.batiment else "—",
            "destination":v.destination or "—",
            "date_depart":str(v.date_depart),
            "date_retour_prevue":str(v.date_retour_prevue),
            "date_retour_effective":str(v.date_retour_effective) if v.date_retour_effective else None,
            "statut":v.statut,"statut_label":STATUT_MAP.get(v.statut,v.statut),
            "rotation_id":v.rotation_id or "",
            "vehicule":v.vehicule or "",
        } for v in qs[:200]]
        return Response({"total":qs.count(),"en_voyage":qs.filter(statut="en_voyage").count(),
                         "top_voyageurs":list(top),"voyages":voyages_data})

    # ── Export CSV ─────────────────────────────────────────────────
    @action(detail=False, methods=["get"], permission_classes=[TokenInQueryOrHeader])
    def export_csv(self, request):
        qs = Voyage.objects.select_related("personnel","batiment").order_by("-date_depart")
        response = HttpResponse(content_type="text/csv; charset=utf-8")
        response["Content-Disposition"] = "attachment; filename=voyages_rzi.csv"
        response.write("\ufeff")
        writer = csv.writer(response,delimiter=";")
        writer.writerow(["Personnel","Societe","Chambre","Rotation","Vehicule",
                         "Destination","Motif","Depart","Retour prevu","Statut"])
        for v in qs:
            p = v.personnel
            writer.writerow([
                f"{p.nom} {p.prenom}" if p else "",
                p.societe if p else "",
                v.batiment.residence if v.batiment else "",
                v.rotation_id or "",v.vehicule or "",
                v.destination or "",v.motif or "",
                str(v.date_depart),str(v.date_retour_prevue),
                STATUT_MAP.get(v.statut,v.statut),
            ])
        return response


from .models import EtapeVoyage
from .serializers import EtapeVoyageSerializer

class EtapeVoyageViewSet(viewsets.ModelViewSet):
    """Étapes d'itinéraire (tronçons) d'un voyage — comme une vraie agence :
    plusieurs étapes possibles (ex: Camp -> Aéroport en bus, puis vol)."""
    queryset = EtapeVoyage.objects.select_related("voyage").all()
    serializer_class = EtapeVoyageSerializer
    filter_backends = [filters.SearchFilter]

    def get_queryset(self):
        qs = EtapeVoyage.objects.select_related("voyage").all()
        voyage_id = self.request.query_params.get("voyage")
        if voyage_id:
            qs = qs.filter(voyage_id=voyage_id)
        return qs


def _generer_billet_html(voyage):
    """Document imprimable façon billet d'agence de voyage — toutes les
    étapes de l'itinéraire, point de RDV, référence, à imprimer ou garder
    en PDF via le navigateur (Ctrl+P -> Enregistrer en PDF)."""
    p = voyage.personnel
    etapes = voyage.etapes.all().order_by("ordre")
    etapes_html = "".join([f"""
        <tr>
          <td style="padding:10px;border-bottom:1px solid #e2e8f0;font-weight:700;color:#0F2A5C">{e.ordre}</td>
          <td style="padding:10px;border-bottom:1px solid #e2e8f0">{e.get_mode_transport_display()}</td>
          <td style="padding:10px;border-bottom:1px solid #e2e8f0">{e.origine} → {e.destination}</td>
          <td style="padding:10px;border-bottom:1px solid #e2e8f0">{e.date_etape.strftime('%d/%m/%Y')}{' à ' + e.heure_depart.strftime('%H:%M') if e.heure_depart else ''}</td>
          <td style="padding:10px;border-bottom:1px solid #e2e8f0">{e.point_rdv or '—'}</td>
          <td style="padding:10px;border-bottom:1px solid #e2e8f0;font-family:monospace">{e.reference or '—'}</td>
        </tr>
    """ for e in etapes]) or '<tr><td colspan="6" style="padding:16px;text-align:center;color:#94a3b8">Aucune étape détaillée — voyage simple</td></tr>'

    return f"""
    <!DOCTYPE html><html lang="fr"><head><meta charset="utf-8">
    <title>Billet de voyage — {p.nom if p else ''} {p.prenom if p else ''}</title>
    <style>
      body {{ font-family: 'IBM Plex Sans', system-ui, sans-serif; margin:0; padding:32px; color:#1e293b; }}
      .header {{ display:flex; justify-content:space-between; align-items:center; border-bottom:4px solid #C9972B; padding-bottom:16px; margin-bottom:24px; }}
      .badge {{ display:inline-block; padding:4px 14px; border-radius:20px; font-size:12px; font-weight:700; }}
      table {{ width:100%; border-collapse:collapse; margin-top:16px; }}
      th {{ text-align:left; padding:10px; background:#0F2A5C; color:#fff; font-size:11px; text-transform:uppercase; }}
      .btn-print {{ background:#C9972B; color:#000; border:none; padding:10px 20px; border-radius:8px; font-weight:700; cursor:pointer; }}
      @media print {{ .no-print {{ display:none; }} }}
    </style></head>
    <body>
      <button class="no-print btn-print" onclick="window.print()" style="margin-bottom:20px">🖨️ Imprimer / Enregistrer en PDF</button>
      <div class="header">
        <div>
          <h1 style="margin:0;color:#0F2A5C">✈️ Billet de voyage</h1>
          <p style="margin:4px 0 0;color:#64748b">RZI Camp — Roxgold Sango</p>
        </div>
        <span class="badge" style="background:#0F2A5C22;color:#0F2A5C">Rotation {voyage.rotation_id or '—'}</span>
      </div>
      <table style="margin-bottom:24px">
        <tr><td style="padding:6px 0;color:#64748b;width:160px">Voyageur</td><td style="font-weight:700">{p.nom if p else ''} {p.prenom if p else ''}</td></tr>
        <tr><td style="padding:6px 0;color:#64748b">Société</td><td>{p.societe if p else '—'}</td></tr>
        <tr><td style="padding:6px 0;color:#64748b">Destination</td><td style="font-weight:700">{voyage.destination or '—'}</td></tr>
        <tr><td style="padding:6px 0;color:#64748b">Motif</td><td>{voyage.motif or '—'}</td></tr>
        <tr><td style="padding:6px 0;color:#64748b">Véhicule / Convoi</td><td>{voyage.vehicule or '—'}</td></tr>
        <tr><td style="padding:6px 0;color:#64748b">Statut</td><td>{voyage.get_statut_display()} — {voyage.get_statut_validation_display()}</td></tr>
      </table>
      <h2 style="color:#0F2A5C;font-size:16px">🗺️ Itinéraire</h2>
      <table>
        <thead><tr><th>Étape</th><th>Mode</th><th>Trajet</th><th>Date / Heure</th><th>Point de RDV</th><th>Référence</th></tr></thead>
        <tbody>{etapes_html}</tbody>
      </table>
      <p style="margin-top:32px;color:#94a3b8;font-size:11px">Document généré le {voyage.created_at.strftime('%d/%m/%Y')} — RZI Camp ERP · Usage interne uniquement</p>
    </body></html>
    """

