
from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from .models import Batiment, Personnel, OccupationHistory, Demande
from .serializers import BatimentSerializer, PersonnelSerializer, OccupationHistorySerializer, DemandeSerializer
import csv, datetime
from django.http import HttpResponse
from natsort import natsorted

class PersonnelViewSet(viewsets.ModelViewSet):
    queryset = Personnel.objects.all()
    serializer_class = PersonnelSerializer
    filter_backends = [filters.SearchFilter]
    search_fields = ["nom","prenom","societe","numero"]

    def get_queryset(self):
        qs = Personnel.objects.all()
        t = self.request.query_params.get("type_personnel")
        if t: qs = qs.filter(type_personnel=t)
        return qs

    def create(self, request, *args, **kwargs):
        if not request.user.is_staff and not request.user.is_superuser:
            return Response({"error":"Seul l'admin peut créer du personnel."}, status=403)
        response = super().create(request, *args, **kwargs)
        p = Personnel.objects.get(id=response.data["id"])
        username, password = p.creer_utilisateur()
        data = dict(response.data)
        data["login_genere"] = username
        data["password_genere"] = password
        return Response(data, status=201)

    @action(detail=True, methods=["post"])
    def regenerer_qr(self, request, pk=None):
        p = self.get_object()
        p.qr_code_data = ""; p.qr_code_string = ""
        p.save(update_fields=["qr_code_data","qr_code_string"])
        p.generer_qr(); p.refresh_from_db()
        return Response(PersonnelSerializer(p).data)

    @action(detail=True, methods=["post"])
    def regenerer_compte(self, request, pk=None):
        if not request.user.is_staff:
            return Response({"error":"Admin uniquement"}, status=403)
        p = self.get_object()
        username, password = p.creer_utilisateur()
        return Response({"login":username,"password":password})

    @action(detail=True, methods=["patch"])
    def assigner_role(self, request, pk=None):
        if not request.user.is_staff and not request.user.is_superuser:
            return Response({"error":"Admin uniquement"}, status=403)
        p = self.get_object()
        role = request.data.get("role")
        if not role:
            return Response({"error":"role requis"}, status=400)
        if p.user:
            from accounts.models import Profile
            Profile.objects.filter(user=p.user).update(role=role)
        return Response({"ok":True,"role":role,"message":f"Role {role} attribue a {p.nom} {p.prenom}"})

    @action(detail=True, methods=["get"])
    def historique_voyages(self, request, pk=None):
        p = self.get_object()
        from voyages.models import Voyage
        voys = Voyage.objects.filter(personnel=p).order_by("-date_depart")
        return Response({
            "personnel": f"{p.nom} {p.prenom}",
            "societe": p.societe,
            "total_voyages": voys.count(),
            "en_voyage": voys.filter(statut="en_voyage").count(),
            "destinations_uniques": list(set(v.destination for v in voys if v.destination)),
            "voyages": [{
                "id":v.id, "destination":v.destination or "Non spécifiée",
                "motif":v.motif, "date_depart":str(v.date_depart),
                "date_retour_prevue":str(v.date_retour_prevue),
                "date_retour_effective":str(v.date_retour_effective) if v.date_retour_effective else None,
                "statut":v.get_statut_display() if hasattr(v,"get_statut_display") else v.statut,
                "chambre":v.batiment.residence if v.batiment else None,
            } for v in voys]
        })

    @action(detail=True, methods=["get"])
    def historique_chambres(self, request, pk=None):
        p = self.get_object()
        date_debut = request.query_params.get("date_debut")
        date_fin = request.query_params.get("date_fin")
        qs = OccupationHistory.objects.filter(personnel=p).select_related("batiment")
        if date_debut: qs = qs.filter(date_arrivee__gte=date_debut)
        if date_fin: qs = qs.filter(date_arrivee__lte=date_fin)
        return Response(OccupationHistorySerializer(qs, many=True).data)


class BatimentViewSet(viewsets.ModelViewSet):
    # IMPORTANT: keep queryset as QuerySet for get_object() to work
    queryset = Batiment.objects.select_related("personnel").all()
    serializer_class = BatimentSerializer
    filter_backends = []  # disable DRF filters, we do it manually

    def _build_qs(self, request=None):
        """Build filtered QuerySet — always returns a real QuerySet"""
        qs = Batiment.objects.select_related("personnel").all()
        params = (request or self.request).query_params
        statut = params.get("statut")
        bloc = params.get("bloc")
        residence = params.get("residence")
        futur_depart = params.get("futur_depart")
        search = params.get("search","")
        if statut: qs = qs.filter(statut=statut)
        if bloc: qs = qs.filter(bloc=bloc)
        if residence: qs = qs.filter(residence__icontains=residence)
        # Filter for own residence
        mon_residence = self.request.query_params.get("mon_residence")
        if mon_residence == "1":
            user = self.request.user
            if hasattr(user, "personnel"):
                qs = qs.filter(personnel=user.personnel)
        if futur_depart == "s1":
            today = datetime.date.today()
            qs = qs.filter(date_depart__gte=today, date_depart__lte=today+datetime.timedelta(days=7))
        if search:
            from django.db.models import Q
            qs = qs.filter(Q(residence__icontains=search)|Q(occupant__icontains=search)|Q(societe__icontains=search))
        return qs

    def get_queryset(self):
        # For single-object operations (retrieve, update, destroy), return full QuerySet
        return Batiment.objects.select_related("personnel").all()

    def list(self, request, *args, **kwargs):
        qs = self._build_qs(request)
        items = natsorted(list(qs), key=lambda x: x.residence)
        serializer = self.get_serializer(items, many=True)
        return Response({"count":len(items),"results":serializer.data})

    def partial_update(self, request, *args, **kwargs):
        # Use standard queryset for object lookup
        instance = Batiment.objects.get(pk=kwargs["pk"])
        old_personnel = instance.personnel
        data = request.data.copy()

        # Resolve personnel
        personnel_id = data.get("personnel")
        personnel_obj = None
        if personnel_id and str(personnel_id).strip() not in ("","null","None"):
            try:
                personnel_obj = Personnel.objects.get(pk=int(str(personnel_id)))
                if not data.get("occupant"):
                    data["occupant"] = f"{personnel_obj.nom} {personnel_obj.prenom}"
                if not data.get("societe"):
                    data["societe"] = personnel_obj.societe
            except (Personnel.DoesNotExist, ValueError, TypeError):
                data["personnel"] = None
        else:
            data["personnel"] = None

        serializer = self.get_serializer(instance, data=data, partial=True)
        serializer.is_valid(raise_exception=True)
        obj = serializer.save()

        today = datetime.date.today()
        if obj.statut == "Libre":
            Batiment.objects.filter(pk=obj.pk).update(
                personnel=None, occupant=None, societe=None,
                date_arrivee=None, date_depart=None
            )
            obj.refresh_from_db()
            if old_personnel:
                OccupationHistory.objects.filter(
                    batiment=obj, personnel=old_personnel, date_depart__isnull=True
                ).update(date_depart=today, motif_depart="Libération manuelle")

        elif obj.statut == "Occupé":
            p = obj.personnel or old_personnel
            # Only create history if explicitly confirmed (confirm=true param)
            confirm = request.data.get("confirm", "false")
            if p and obj.date_arrivee and str(confirm).lower() in ("true","1","yes"):
                OccupationHistory.objects.get_or_create(
                    batiment=obj, personnel=p, date_depart__isnull=True,
                    defaults={
                        "occupant_nom":obj.occupant or f"{p.nom} {p.prenom}",
                        "societe":obj.societe or p.societe,
                        "date_arrivee":obj.date_arrivee,
                        "enregistre_par":request.user,
                    }
                )

        return Response(self.get_serializer(obj).data)

    @action(detail=False, methods=["get"])
    def geojson(self, request):
        qs = self._build_qs(request)
        features = []
        for b in qs:
            if b.geojson_geometry:
                p = b.personnel
                features.append({
                    "type":"Feature",
                    "properties":{
                        "id":b.id,"residence":b.residence,"bloc":b.bloc,"statut":b.statut,
                        "occupant":f"{p.nom} {p.prenom}" if p else b.occupant,
                        "societe":p.societe if p else b.societe,
                        "latitude":b.latitude,"longitude":b.longitude,
                    },
                    "geometry":b.geojson_geometry
                })
        return Response({"type":"FeatureCollection","features":features})

    @action(detail=False, methods=["get"])
    def stats(self, request):
        from django.db.models import Count
        qs = Batiment.objects.all()
        total = qs.count()
        par_statut = dict(qs.values_list("statut").annotate(n=Count("id")).values_list("statut","n"))
        par_bloc = list(qs.values("bloc").annotate(total=Count("id")).order_by("bloc"))
        today = datetime.date.today()
        departs_s1 = qs.filter(date_depart__gte=today, date_depart__lte=today+datetime.timedelta(days=7)).count()
        departs_s1_list = list(qs.filter(date_depart__gte=today, date_depart__lte=today+datetime.timedelta(days=7))
                               .select_related("personnel")
                               .values("residence","occupant","date_depart","personnel__nom","personnel__prenom"))
        return Response({
            "total":total,"par_statut":par_statut,"par_bloc":par_bloc,
            "taux_occupation":round(par_statut.get("Occupé",0)/total*100,1) if total else 0,
            "departs_s1":departs_s1,
            "departs_s1_list":departs_s1_list,
        })

    @action(detail=False, methods=["get"], permission_classes=[AllowAny])
    def export_csv(self, request):
        qs = natsorted(list(Batiment.objects.select_related("personnel").all()), key=lambda x: x.residence)
        statut = request.query_params.get("statut")
        if statut: qs = [b for b in qs if b.statut==statut]
        response = HttpResponse(content_type="text/csv; charset=utf-8")
        response["Content-Disposition"] = "attachment; filename=residences_rzi.csv"
        response.write("\ufeff")
        writer = csv.writer(response, delimiter=";")
        writer.writerow(["Residence","Bloc","Statut","Occupant","Societe","Type","Telephone","Date arrivee","Date depart"])
        for b in qs:
            p = b.personnel
            writer.writerow([b.residence,b.bloc,b.statut,
                f"{p.nom} {p.prenom}" if p else (b.occupant or ""),
                p.societe if p else (b.societe or ""),
                p.get_type_personnel_display() if p else "",
                p.numero if p else "",
                b.date_arrivee or "", b.date_depart or ""])
        return response

    @action(detail=False, methods=["get"], permission_classes=[AllowAny])
    def export_par_bloc(self, request):
        from django.db.models import Count, Q
        qs = Batiment.objects.values("bloc").annotate(
            total=Count("id"), libres=Count("id",filter=Q(statut="Libre")),
            occupes=Count("id",filter=Q(statut="Occupé")),
            reserves=Count("id",filter=Q(statut="Réservé")),
            maintenance=Count("id",filter=Q(statut="Maintenance")),
        ).order_by("bloc")
        response = HttpResponse(content_type="text/csv; charset=utf-8")
        response["Content-Disposition"] = "attachment; filename=rapport_blocs_rzi.csv"
        response.write("\ufeff")
        writer = csv.writer(response, delimiter=";")
        writer.writerow(["Bloc","Total","Libres","Occupes","Reserves","Maintenance","Taux %"])
        for r in qs:
            taux = round(r["occupes"]/r["total"]*100,1) if r["total"] else 0
            writer.writerow([r["bloc"],r["total"],r["libres"],r["occupes"],r["reserves"],r["maintenance"],taux])
        return response


    def destroy(self, request, *args, **kwargs):
        if not request.user.is_staff and not request.user.is_superuser:
            return Response({"error":"Suppression réservée à l'admin"}, status=403)
        return super().destroy(request, *args, **kwargs)

class OccupationHistoryViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = OccupationHistory.objects.select_related("batiment","personnel").all()
    serializer_class = OccupationHistorySerializer

    def get_queryset(self):
        qs = OccupationHistory.objects.select_related("batiment","personnel").all()
        batiment = self.request.query_params.get("batiment")
        personnel = self.request.query_params.get("personnel")
        date_debut = self.request.query_params.get("date_debut")
        date_fin = self.request.query_params.get("date_fin")
        if batiment: qs = qs.filter(batiment__residence__iexact=batiment)
        if personnel: qs = qs.filter(personnel_id=personnel)
        if date_debut: qs = qs.filter(date_arrivee__gte=date_debut)
        if date_fin: qs = qs.filter(date_arrivee__lte=date_fin)
        return qs


    @action(detail=False, methods=["get"], permission_classes=[AllowAny])
    def export_csv(self, request):
        import csv
        from django.http import HttpResponse
        qs = OccupationHistory.objects.select_related("batiment","personnel").order_by("-date_arrivee")
        batiment = request.query_params.get("batiment")
        personnel = request.query_params.get("personnel")
        if batiment: qs = qs.filter(batiment__residence__icontains=batiment)
        if personnel: qs = qs.filter(personnel_id=personnel)
        response = HttpResponse(content_type="text/csv; charset=utf-8")
        response["Content-Disposition"] = "attachment; filename=historique_occupation.csv"
        response.write("\ufeff")
        writer = csv.writer(response, delimiter=";")
        writer.writerow(["Residence","Bloc","Occupant","Societe","Arrivee","Depart","Duree jours","Motif depart"])
        import datetime
        today = datetime.date.today()
        for h in qs:
            d1 = h.date_arrivee
            d2 = h.date_depart or today
            days = (d2-d1).days
            writer.writerow([h.batiment.residence,h.batiment.bloc,h.occupant_nom,h.societe or "",
                str(h.date_arrivee),str(h.date_depart) if h.date_depart else "En cours",days,h.motif_depart or ""])
        return response

    @action(detail=False, methods=["get"])
    def recherche(self, request):
        """
        Recherche croisée historisation :
        - Toutes chambres si pas de filtre batiment
        - Filtre par résidence (dropdown ou saisie libre)
        - Filtre par nom occupant (saisie libre)
        - Filtre par personnel (dropdown)
        - Filtre par période
        """
        batiment_q = request.query_params.get("batiment","").strip()
        personnel_id = request.query_params.get("personnel","").strip()
        date_debut = request.query_params.get("date_debut","").strip()
        date_fin = request.query_params.get("date_fin","").strip()
        nom_search = request.query_params.get("nom","").strip()

        from django.db.models import Q

        # Build history queryset — no mandatory filter, show all if no criteria
        qs = OccupationHistory.objects.select_related("batiment","personnel").all()
        if batiment_q:
            qs = qs.filter(batiment__residence__icontains=batiment_q)
        if personnel_id:
            qs = qs.filter(personnel_id=personnel_id)
        if nom_search:
            qs = qs.filter(
                Q(occupant_nom__icontains=nom_search) |
                Q(personnel__nom__icontains=nom_search) |
                Q(personnel__prenom__icontains=nom_search) |
                Q(batiment__residence__icontains=nom_search)
            )
        if date_debut:
            qs = qs.filter(Q(date_depart__gte=date_debut)|Q(date_depart__isnull=True))
        if date_fin:
            qs = qs.filter(date_arrivee__lte=date_fin)

        today = datetime.date.today()
        results = []

        # Also include current batiment occupants not yet in history
        bats_qs = Batiment.objects.select_related("personnel").filter(statut="Occupé")
        if batiment_q:
            bats_qs = bats_qs.filter(residence__icontains=batiment_q)
        if personnel_id:
            bats_qs = bats_qs.filter(personnel_id=personnel_id)
        if nom_search:
            bats_qs = bats_qs.filter(
                Q(occupant__icontains=nom_search) |
                Q(personnel__nom__icontains=nom_search) |
                Q(personnel__prenom__icontains=nom_search) |
                Q(residence__icontains=nom_search)
            )

        existing_bat_ids = set(qs.values_list("batiment_id", flat=True))
        for b in bats_qs:
            if b.id not in existing_bat_ids and b.date_arrivee:
                d1 = b.date_arrivee
                days = (today - d1).days
                results.append({
                    "id": f"bat-{b.id}",
                    "residence": b.residence,
                    "bloc": b.bloc,
                    "occupant": b.occupant or (f"{b.personnel.nom} {b.personnel.prenom}" if b.personnel else "—"),
                    "societe": b.societe or (b.personnel.societe if b.personnel else ""),
                    "personnel_id": b.personnel_id,
                    "date_arrivee": str(b.date_arrivee),
                    "date_depart": str(b.date_depart) if b.date_depart else None,
                    "duree_jours": max(days, 1),
                    "en_cours": True,
                    "motif_depart": "",
                    "source": "current",
                })

        for h in qs.order_by("-date_arrivee")[:500]:
            d1 = h.date_arrivee
            d2 = h.date_depart or today
            days = (d2 - d1).days
            results.append({
                "id": h.id,
                "residence": h.batiment.residence,
                "bloc": h.batiment.bloc,
                "occupant": h.occupant_nom,
                "societe": h.societe,
                "personnel_id": h.personnel_id,
                "date_arrivee": str(h.date_arrivee),
                "date_depart": str(h.date_depart) if h.date_depart else None,
                "duree_jours": max(days, 1),
                "en_cours": h.date_depart is None,
                "motif_depart": h.motif_depart,
                "source": "history",
            })

        results.sort(key=lambda x: x["date_arrivee"], reverse=True)
        return Response({"count":len(results),"results":results})



class OccupationHistoryAdminViewSet(viewsets.ModelViewSet):
    """Admin-only: correct or delete wrong history entries"""
    queryset = OccupationHistory.objects.select_related("batiment","personnel").all()
    serializer_class = OccupationHistorySerializer

    def destroy(self, request, *args, **kwargs):
        if not request.user.is_staff and not request.user.is_superuser:
            return Response({"error":"Admin uniquement"}, status=403)
        instance = self.get_object()
        batiment = instance.batiment
        # If this was the current occupant, do NOT free the room — just remove the wrong history
        instance.delete()
        return Response({"ok":True,"message":"Entrée historique supprimée (chambre non modifiée)"})

    def update(self, request, *args, **kwargs):
        if not request.user.is_staff and not request.user.is_superuser:
            return Response({"error":"Admin uniquement"}, status=403)
        return super().partial_update(request, *args, **kwargs)



from rest_framework import viewsets, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.utils import timezone
from django.contrib.auth.models import User
from .models import Demande, Batiment, Personnel
from .serializers import DemandeSerializer

class DemandeViewSet(viewsets.ModelViewSet):
    serializer_class = DemandeSerializer
    filter_backends = [filters.SearchFilter]
    search_fields = ["demandeur__first_name","demandeur__last_name","residence_souhaitee"]

    def get_queryset(self):
        user = self.request.user
        is_admin = user.is_staff or user.is_superuser
        if is_admin:
            qs = Demande.objects.select_related("demandeur","traite_par").all()
        else:
            qs = Demande.objects.filter(demandeur=user)
        
        statut = self.request.query_params.get("statut")
        type_d = self.request.query_params.get("type_demande")
        if statut: qs = qs.filter(statut=statut)
        if type_d: qs = qs.filter(type_demande=type_d)
        return qs

    def perform_create(self, serializer):
        demande = serializer.save(demandeur=self.request.user)
        # Notify admins
        try:
            demande.notifier_admin()
        except Exception:
            pass

    def destroy(self, request, *args, **kwargs):
        """Only admin can hard-delete; agents can only cancel"""
        instance = self.get_object()
        if request.user.is_staff or request.user.is_superuser:
            return super().destroy(request, *args, **kwargs)
        return Response({"error":"Admin uniquement pour suppression"}, status=403)

    # ── Admin actions ──
    @action(detail=True, methods=["post"])
    def valider(self, request, pk=None):
        """Admin valide la demande"""
        if not request.user.is_staff and not request.user.is_superuser:
            return Response({"error":"Admin uniquement"}, status=403)
        demande = self.get_object()
        if demande.statut not in ("en_attente", "proposition"):
            return Response({"error":"Demande non en attente"}, status=400)
        
        demande.statut = "validee"
        demande.traite_par = request.user
        demande.commentaire_admin = request.data.get("commentaire","Demande validée")
        demande.date_traitement = timezone.now()
        
        # Execute the action
        if demande.type_demande == "reservation_residence":
            residence = request.data.get("residence_attribuee") or demande.residence_souhaitee or demande.proposition_admin.get("residence")
            if residence:
                demande.residence_attribuee = residence
                try:
                    bat = Batiment.objects.get(residence=residence)
                    # Assign if libre
                    if bat.statut == "Libre":
                        bat.statut = "Réservé"
                        bat.occupant = demande.demandeur.get_full_name()
                        bat.date_arrivee = demande.date_debut_souhaitee
                        bat.date_depart = demande.date_fin_souhaitee
                        bat.save()
                except Batiment.DoesNotExist:
                    pass
        
        elif demande.type_demande == "voyage":
            from voyages.models import Voyage
            data = demande.donnees
            if demande.demandeur:
                p = getattr(demande.demandeur,"personnel",None)
                if p:
                    import datetime
                    try:
                        Voyage.objects.create(
                            personnel=p,
                            destination=data.get("destination",""),
                            motif=data.get("motif",""),
                            date_depart=demande.date_debut_souhaitee or datetime.date.today(),
                            date_retour_prevue=demande.date_fin_souhaitee or (demande.date_debut_souhaitee or datetime.date.today()) + datetime.timedelta(days=7),
                            enregistre_par=request.user,
                        )
                    except Exception as ve:
                        pass  # Continue even if voyage creation fails
        
        demande.save()
        try:
            demande.notifier_demandeur(f"✅ Votre demande a été validée.\n{demande.commentaire_admin}")
        except Exception:
            pass
        return Response(DemandeSerializer(demande).data)

    @action(detail=True, methods=["post"])
    def rejeter(self, request, pk=None):
        """Admin rejette la demande"""
        if not request.user.is_staff and not request.user.is_superuser:
            return Response({"error":"Admin uniquement"}, status=403)
        demande = self.get_object()
        demande.statut = "rejetee"
        demande.traite_par = request.user
        demande.commentaire_admin = request.data.get("commentaire","Demande rejetée")
        demande.date_traitement = timezone.now()
        demande.save()
        try:
            demande.notifier_demandeur(f"❌ Votre demande a été rejetée.\nMotif: {demande.commentaire_admin}")
        except Exception:
            pass
        return Response(DemandeSerializer(demande).data)

    @action(detail=True, methods=["post"])
    def proposer(self, request, pk=None):
        """Admin fait une contre-proposition"""
        if not request.user.is_staff and not request.user.is_superuser:
            return Response({"error":"Admin uniquement"}, status=403)
        demande = self.get_object()
        demande.statut = "proposition"
        demande.traite_par = request.user
        demande.commentaire_admin = request.data.get("commentaire","Voir la proposition ci-dessous")
        demande.proposition_admin = request.data.get("proposition",{})
        demande.date_traitement = timezone.now()
        demande.save()
        
        prop_str = "\n".join([f"• {k}: {v}" for k,v in demande.proposition_admin.items()])
        try:
            demande.notifier_demandeur(f"💬 Proposition de l'admin:\n{prop_str}\n\n{demande.commentaire_admin}")
        except Exception:
            pass
        return Response(DemandeSerializer(demande).data)

    # ── Demandeur actions ──
    @action(detail=True, methods=["post"])
    def accepter_proposition(self, request, pk=None):
        """Demandeur accepte la proposition de l'admin"""
        demande = self.get_object()
        if demande.demandeur != request.user:
            return Response({"error":"Non autorisé"}, status=403)
        if demande.statut != "proposition":
            return Response({"error":"Pas de proposition en attente"}, status=400)
        # Validate with proposition
        demande.statut = "acceptee"
        demande.date_reponse = timezone.now()
        demande.save()
        return Response(DemandeSerializer(demande).data)

    @action(detail=True, methods=["post"])
    def refuser_proposition(self, request, pk=None):
        """Demandeur refuse la proposition"""
        demande = self.get_object()
        if demande.demandeur != request.user:
            return Response({"error":"Non autorisé"}, status=403)
        if demande.statut != "proposition":
            return Response({"error":"Pas de proposition"}, status=400)
        demande.statut = "rejetee"
        demande.date_reponse = timezone.now()
        demande.save()
        return Response(DemandeSerializer(demande).data)

    @action(detail=True, methods=["post"])
    def annuler(self, request, pk=None):
        """Demandeur annule sa propre demande"""
        demande = self.get_object()
        if demande.demandeur != request.user and not request.user.is_staff:
            return Response({"error":"Non autorisé"}, status=403)
        if demande.statut in ("validee","rejetee"):
            return Response({"error":"Demande déjà traitée"}, status=400)
        demande.statut = "annulee"
        demande.date_reponse = timezone.now()
        demande.save()
        return Response(DemandeSerializer(demande).data)

    @action(detail=False, methods=["get"])
    def stats(self, request):
        """Stats pour l'admin"""
        if not request.user.is_staff and not request.user.is_superuser:
            return Response({"error":"Admin uniquement"}, status=403)
        from django.db.models import Count
        qs = Demande.objects.all()
        return Response({
            "total": qs.count(),
            "en_attente": qs.filter(statut="en_attente").count(),
            "validees": qs.filter(statut="validee").count(),
            "rejetees": qs.filter(statut="rejetee").count(),
            "propositions": qs.filter(statut="proposition").count(),
            "par_type": dict(qs.values_list("type_demande").annotate(n=Count("id")).values_list("type_demande","n")),
        })
