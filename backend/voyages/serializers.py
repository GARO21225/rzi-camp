from rest_framework import serializers
from .models import Voyage, EtapeVoyage, VehiculeFlotte, ItineraireModele, EtapeItineraireModele

STATUT_MAP = {
    "planifie":"Planifié","en_voyage":"En voyage",
    "retour":"Retour au camp","annule":"Annulé",
}

class EtapeVoyageSerializer(serializers.ModelSerializer):
    mode_transport_label = serializers.CharField(source="get_mode_transport_display", read_only=True)
    sens_label            = serializers.CharField(source="get_sens_display", read_only=True)
    vehicule_matricule    = serializers.CharField(source="vehicule_flotte.matricule", read_only=True, default="")
    vehicule_photo        = serializers.CharField(source="vehicule_flotte.photo", read_only=True, default="")
    vehicule_nom          = serializers.CharField(source="vehicule_flotte.nom", read_only=True, default="")

    class Meta:
        model = EtapeVoyage
        fields = ["id","voyage","ordre","sens","sens_label","origine","destination","mode_transport","mode_transport_label",
                  "vehicule_flotte","vehicule_nom","vehicule_matricule","vehicule_photo","conducteur",
                  "date_etape","heure_depart","heure_arrivee_prevue","distance_km","pause_fatigue","point_rdv","reference","notes",
                  "billet_fichier","billet_cout"]

    def to_internal_value(self, data):
        """Une chaîne vide '' sur heure_depart/heure_arrivee_prevue (au lieu
        de null) est rejetée par le TimeField DRF ("L'heure n'a pas le bon
        format") — un appelant qui laisse ces champs vides (au lieu d'omettre
        la clé ou d'envoyer null) voyait donc l'étape entière échouer en 400,
        sans que ce soit toujours visible côté appelant (ex: import en masse
        d'un itinéraire, plusieurs appels dont certains silencieusement
        ignorés). On normalise ici une fois pour toutes, quel que soit
        l'appelant, plutôt que de compter sur chaque site d'appel pour le
        faire correctement."""
        if hasattr(data, "_mutable"):
            data = data.copy()
        else:
            data = dict(data)
        for champ in ("heure_depart", "heure_arrivee_prevue"):
            if data.get(champ) == "":
                data[champ] = None
        return super().to_internal_value(data)

class VoyageSerializer(serializers.ModelSerializer):
    personnel_nom      = serializers.SerializerMethodField()
    personnel_societe  = serializers.SerializerMethodField()
    personnel_departement = serializers.SerializerMethodField()
    a_un_vol = serializers.SerializerMethodField()
    niveau_alerte_label = serializers.CharField(source="get_niveau_alerte_display", read_only=True)
    personnel_telephone = serializers.SerializerMethodField()
    personnel_profil   = serializers.SerializerMethodField()
    batiment_nom       = serializers.SerializerMethodField()
    statut_label       = serializers.SerializerMethodField()
    statut_validation_label = serializers.CharField(source="get_statut_validation_display", read_only=True)
    valide_par_nom     = serializers.SerializerMethodField()
    etapes             = EtapeVoyageSerializer(many=True, read_only=True)
    # Infos rotation groupe
    places_prises      = serializers.SerializerMethodField()
    places_occupees    = serializers.SerializerMethodField()
    places_reservees   = serializers.SerializerMethodField()
    places_libres      = serializers.SerializerMethodField()

    class Meta:
        model  = Voyage
        fields = "__all__"
        read_only_fields = ["enregistre_par","date_depart_effective","date_retour_effective","statut_validation","valide_par","date_validation"]

    def get_valide_par_nom(self, obj):
        o = self._obj(obj)
        try: return o.valide_par.get_full_name() or o.valide_par.username if o and o.valide_par else ""
        except: return ""

    def _obj(self, obj):
        return obj if isinstance(obj, Voyage) else None

    def get_personnel_nom(self, obj):
        o = self._obj(obj)
        try: return f"{o.personnel.nom} {o.personnel.prenom}" if o and o.personnel else ""
        except: return ""

    def get_personnel_societe(self, obj):
        o = self._obj(obj)
        try: return o.personnel.societe if o and o.personnel else ""
        except: return ""

    def get_personnel_departement(self, obj):
        o = self._obj(obj)
        try: return o.personnel.departement if o and o.personnel else ""
        except: return ""

    def get_a_un_vol(self, obj):
        """
        Indique si ce voyage a une etape avion (aller ou retour), avec les
        infos essentielles pour la planification (le convoi doit partir a
        temps pour que ce passager attrape son vol). None si pas de vol.
        """
        o = self._obj(obj)
        if not o: return None
        etape_vol = o.etapes.filter(mode_transport="avion").order_by("date_etape","heure_depart").first()
        if not etape_vol: return None
        return {
            "numero_vol": etape_vol.reference or "",
            "date": str(etape_vol.date_etape),
            "heure_depart": str(etape_vol.heure_depart) if etape_vol.heure_depart else None,
            "sens": etape_vol.sens,
        }

    def get_personnel_telephone(self, obj):
        o = self._obj(obj)
        try: return o.personnel.telephone if o and o.personnel else ""
        except: return ""

    def get_personnel_profil(self, obj):
        o = self._obj(obj)
        try: return o.personnel.profil if o and o.personnel else ""
        except: return ""

    def get_batiment_nom(self, obj):
        o = self._obj(obj)
        try: return o.batiment.residence if o and o.batiment else ""
        except: return ""

    def get_statut_label(self, obj):
        o = self._obj(obj)
        try: return STATUT_MAP.get(o.statut, o.statut) if o else "Planifié"
        except: return ""

    def get_places_prises(self, obj):
        o = self._obj(obj)
        if not o or not o.rotation_id: return 1
        try: return Voyage.objects.filter(rotation_id=o.rotation_id).exclude(statut="annule").count()
        except: return 1

    def get_places_occupees(self, obj):
        """Sieges CONFIRMES (valides) - vraiment pris."""
        o = self._obj(obj)
        if not o or not o.rotation_id: return 0
        try: return Voyage.objects.filter(rotation_id=o.rotation_id, statut_validation="valide").exclude(statut="annule").count()
        except: return 0

    def get_places_reservees(self, obj):
        """Sieges DEMANDES mais pas encore valides - reserves, pas garantis."""
        o = self._obj(obj)
        if not o or not o.rotation_id: return 0
        try: return Voyage.objects.filter(rotation_id=o.rotation_id, statut_validation="en_attente").exclude(statut="annule").count()
        except: return 0

    def get_places_libres(self, obj):
        o = self._obj(obj)
        if not o: return 0
        total = o.nb_places_total or 15
        prises = self.get_places_prises(obj)
        return max(0, total - prises)

    def validate(self, data):
        """Règle métier camp minier : une personne ne peut pas être inscrite
        deux fois sur un voyage actif (planifié ou en cours) qui se chevauche
        avec la période demandée.
        Vérification faite à la création ET à la modification pour couvrir les
        deux cas d'utilisation (PUT/PATCH aussi). À la modification, l'objet
        courant est exclu de la vérification pour ne pas se bloquer lui-même.
        """
        from rest_framework.exceptions import ValidationError as DRFValidationError

        personnel   = data.get("personnel")
        date_depart = data.get("date_depart")
        date_retour = data.get("date_retour_prevue")

        if not personnel or not date_depart:
            return data  # champs manquants → laissé aux validateurs de champ

        # Statuts qui signifient "ce voyage est actif / occupe la personne"
        ACTIFS = ("planifie", "en_voyage")

        qs = Voyage.objects.filter(
            personnel=personnel,
            statut__in=ACTIFS,
        ).exclude(
            # Un voyage annulé ou terminé (retour) ne bloque pas
        )

        # À la modification (PATCH/PUT), exclure l'objet lui-même
        instance = getattr(self, "instance", None)
        if instance:
            qs = qs.exclude(pk=instance.pk)

        # Chevauchement de période :
        # Un conflit existe si les deux périodes se croisent, c'est-à-dire si :
        #   nouveau.date_depart <= existant.date_retour_prevue
        #   ET nouveau.date_retour_prevue >= existant.date_depart
        if date_retour:
            qs = qs.filter(
                date_depart__lte=date_retour,
                date_retour_prevue__gte=date_depart,
            )
        else:
            # Pas de date de retour précisée : bloquer si depart exact en double
            qs = qs.filter(date_depart=date_depart)

        conflict = qs.select_related("personnel").first()
        if conflict:
            nom = f"{conflict.personnel.nom} {conflict.personnel.prenom}" if conflict.personnel else "Cette personne"
            raise DRFValidationError(
                f"{nom} est déjà inscrit(e) sur un voyage actif du "
                f"{conflict.date_depart} au {conflict.date_retour_prevue} "
                f"(statut : {conflict.get_statut_display()}). "
                f"Une personne ne peut pas être inscrite deux fois sur un voyage en même temps."
            )

        return data

    def create(self, validated_data):
        req = self.context.get("request")
        if req and req.user and req.user.is_authenticated:
            validated_data["enregistre_par"] = req.user
        return super().create(validated_data)


class EtapeItineraireModeleSerializer(serializers.ModelSerializer):
    class Meta:
        model = EtapeItineraireModele
        fields = ["id","itineraire","ordre","ville","distance_km","heure_depart","heure_arrivee","pause_fatigue"]

    def to_internal_value(self, data):
        """Même piège TimeField que EtapeVoyageSerializer (voir plus haut) :
        '' est rejeté, null est accepté. Géré ici en gestion d'itinéraires
        (Paramétrage) pour ne pas réintroduire le même bug silencieux côté
        étapes-types."""
        if hasattr(data, "_mutable"):
            data = data.copy()
        else:
            data = dict(data)
        for champ in ("heure_depart", "heure_arrivee"):
            if data.get(champ) == "":
                data[champ] = None
        return super().to_internal_value(data)


class ItineraireModeleSerializer(serializers.ModelSerializer):
    etapes = EtapeItineraireModeleSerializer(many=True, read_only=True)

    class Meta:
        model = ItineraireModele
        fields = ["id","nom","origine","destination","actif","etapes"]


class VehiculeFlotteSerializer(serializers.ModelSerializer):
    categorie_label = serializers.CharField(source="get_categorie_display", read_only=True)

    class Meta:
        model = VehiculeFlotte
        fields = ["id","nom","categorie","categorie_label","matricule","capacite","photo","actif"]
