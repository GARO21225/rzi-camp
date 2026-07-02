from rest_framework import serializers
from .models import Voyage

STATUT_MAP = {
    "planifie":"Planifié","en_voyage":"En voyage",
    "retour":"Retour au camp","annule":"Annulé",
}

class VoyageSerializer(serializers.ModelSerializer):
    personnel_nom      = serializers.SerializerMethodField()
    personnel_societe  = serializers.SerializerMethodField()
    personnel_profil   = serializers.SerializerMethodField()
    batiment_nom       = serializers.SerializerMethodField()
    statut_label       = serializers.SerializerMethodField()
    # Infos rotation groupe
    places_prises      = serializers.SerializerMethodField()
    places_libres      = serializers.SerializerMethodField()

    class Meta:
        model  = Voyage
        fields = "__all__"
        read_only_fields = ["enregistre_par","date_retour_effective"]

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
        try: return Voyage.objects.filter(rotation_id=o.rotation_id).count()
        except: return 1

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
