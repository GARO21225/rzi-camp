from rest_framework import serializers
from .models import (Departement, Entreprise, Batiment, Personnel, OccupationHistory, InductionRecord, ResidentPrincipal, Plainte, PlainteCategorie, ControleChambre,
    InductionCampConfig, InductionInfra, InductionRegle, InductionQuizQuestion, PointInteret, CheminCirculation, EquipementEPI)

class PointInteretSerializer(serializers.ModelSerializer):
    categorie_label = serializers.CharField(source="get_categorie_display", read_only=True)

    class Meta:
        model = PointInteret
        fields = ["id","nom","categorie","categorie_label","latitude","longitude",
                  "description","actif","date_creation","geojson_geometry","source_ref"]
        read_only_fields = ["date_creation"]

class CheminCirculationSerializer(serializers.ModelSerializer):
    type_chemin_label = serializers.CharField(source="get_type_chemin_display", read_only=True)

    class Meta:
        model = CheminCirculation
        fields = ["id","nom","type_chemin","type_chemin_label","points","actif","date_creation","source_ref"]
        read_only_fields = ["date_creation"]

class EquipementEPISerializer(serializers.ModelSerializer):
    type_epi_label   = serializers.CharField(source="get_type_epi_display", read_only=True)
    etat_label       = serializers.CharField(source="get_etat_display", read_only=True)
    statut_peremption= serializers.ReadOnlyField()
    personnel_nom    = serializers.SerializerMethodField()

    def get_personnel_nom(self, obj):
        return f"{obj.personnel.nom} {obj.personnel.prenom}"

    class Meta:
        model = EquipementEPI
        fields = ["id","personnel","personnel_nom","type_epi","type_epi_label","date_remise",
                  "date_expiration","etat","etat_label","statut_peremption","notes","date_creation"]
        read_only_fields = ["date_creation"]

class PersonnelSerializer(serializers.ModelSerializer):
    type_label      = serializers.SerializerMethodField()
    user_role       = serializers.SerializerMethodField()
    user_active     = serializers.SerializerMethodField()
    login_genere    = serializers.SerializerMethodField()
    # password_genere delibere absent d'ici : ce mot de passe est en clair
    # en base, l'exposer via CE serializer signifierait que TOUTE requete
    # GET /api/personnel/ (liste ou detail) le revele a quiconque peut voir
    # le personnel - un vrai trou de securite trouve en auditant "comment
    # le personnel accede a l'application". Il ne doit etre visible qu'UNE
    # fois, juste apres creation/regeneration du compte (create()/
    # regenerer_compte() l'injectent deja manuellement dans LEUR propre
    # reponse, independamment de ce serializer).
    a_droit_mobilite = serializers.BooleanField(read_only=True)
    # Écriture : « mobilite » = true/false → accorde / retire le droit, quel que soit le type
    # (Roxgold/sous-traitant : le droit est par défaut, on le retire via mobilite_exclue ;
    # visiteur : il faut l'accorder via eligible_mobilite).
    mobilite = serializers.BooleanField(write_only=True, required=False)
    # Alias explicite : en base/API le champ s'appelle "numero" mais représente
    # le matricule (cf. label "N° MATRICULE" côté frontend). Plusieurs pages
    # (Annuaire, badges Induction, export Personnel) lisaient "matricule" qui
    # n'a jamais existé dans l'API -> valeur toujours vide. On l'expose ici en
    # lecture ET écriture, en miroir de "numero".
    matricule       = serializers.CharField(source="numero", required=False, allow_blank=True)
    residence_principale = serializers.SerializerMethodField()

    def get_residence_principale(self, obj):
        """
        Statut resident principal + chambre - distinct de l'occupation
        actuelle (Batiment.personnel). PERFORMANCE : toutes les residences
        principales actives sont chargees UNE SEULE FOIS par requete de
        liste (mises en cache sur l'instance du serializer), au lieu d'une
        requete ResidentPrincipal separee par personne - avec 200+ membres
        du personnel, ca faisait 200+ requetes supplementaires a CHAQUE
        chargement de la liste Personnel (utilisee tres largement dans
        l'application) - contributeur plausible au ralentissement signale.
        """
        if not hasattr(self, '_residences_principales_cache'):
            from residences.models import ResidentPrincipal
            self._residences_principales_cache = {
                rp.personnel_id: rp for rp in
                ResidentPrincipal.objects.filter(date_fin__isnull=True).select_related("batiment")
            }
        rp = self._residences_principales_cache.get(obj.id)
        if not rp: return None
        return {"id": rp.id, "batiment_id": rp.batiment_id, "residence": rp.batiment.residence if rp.batiment_id else None, "date_debut": rp.date_debut}

    def get_type_label(self, obj):
        return dict(Personnel.TYPE_CHOICES).get(obj.type_personnel, obj.type_personnel)

    profil_label = serializers.SerializerMethodField()

    def get_profil_label(self, obj):
        try:
            from residences.models import Personnel
            code = obj.profil or 'agent'
            label = dict(Personnel.PROFIL_CHOICES).get(code)
            if label: return label
            # Profil personnalise (role cree depuis Parametrage -> Roles &
            # Acces, absent de la liste figee PROFIL_CHOICES) - va chercher
            # son libelle dans RoleCustom. PERFORMANCE : le mapping complet
            # est charge UNE SEULE FOIS par requete de liste (mis en cache
            # sur l'instance du serializer), plutot qu'une requete RoleCustom
            # separee par personne - avec un profil personnalise courant
            # (ex: "restauration"), une liste de 200 personnes declenchait
            # jusqu'a 200 requetes supplementaires identiques.
            if not hasattr(self, '_role_labels_cache'):
                from accounts.models import RoleCustom
                self._role_labels_cache = dict(RoleCustom.objects.values_list('code', 'label'))
            return self._role_labels_cache.get(code, code)
        except Exception:
            return 'agent'

    def _avec_fallback_email(self, data, instance):
        # BUG REEL CORRIGE ICI : Personnel.email (saisi a la creation de la
        # fiche) et User.email (compte de connexion) sont deux champs
        # distincts - une fiche creee/importee sans email explicite
        # affichait "vide" meme quand le compte utilisateur associe EN A
        # bien un (cas d'Edgar). Fallback d'affichage uniquement (ne
        # modifie jamais la valeur reellement enregistree sur Personnel).
        if not data.get('email'):
            try:
                if instance.user_id and instance.user.email:
                    data['email'] = instance.user.email
            except Exception:
                pass
        return data

    def to_representation(self, instance):
        """Gère le cas où la colonne profil n'existe pas encore en DB."""
        try:
            return self._avec_fallback_email(super().to_representation(instance), instance)
        except Exception as e:
            if 'profil' in str(e).lower():
                # Retourner les données sans profil si la colonne manque
                data = super(PersonnelSerializer, self).to_representation(instance)
                data['profil'] = 'agent'
                data['profil_label'] = 'Agent'
                return self._avec_fallback_email(data, instance)
            raise

    def get_user_role(self, obj):
        try:
            if obj.user and hasattr(obj.user, 'profile'):
                return obj.user.profile.role
        except: pass
        return None

    def get_user_active(self, obj):
        try:
            if obj.user: return obj.user.is_active
        except: pass
        return None

    def get_login_genere(self, obj):
        return getattr(obj, 'login_genere', None) or (obj.user.username if obj.user else None)

    def validate(self, attrs):
        """
        Contraint le champ de contact (telephone/whatsapp/email) requis
        pour le canal de connexion configure (Parametre 'canal_otp') -
        sans ca, la personne creee ne pourra jamais recevoir son code OTP
        ni ses identifiants (demande explicite : "je pense qu'on doit
        rendre des champ obligatoire et contraindre certains format").

        Le caractere OBLIGATOIRE n'est applique qu'A LA CREATION (pas de
        blocage d'une modification sur un Personnel deja existant qui
        aurait ete cree avant cette regle, sans ce champ) ; le FORMAT est
        verifie des qu'une valeur est fournie, creation ou modification.
        """
        from accounts.models import Parametre
        from accounts.contact_validation import valider_contact_selon_canal

        creation = self.instance is None
        canal = Parametre.get('canal_otp', 'sms')

        def valeur(champ):
            if champ in attrs:
                return attrs[champ]
            return getattr(self.instance, champ, '') if self.instance else ''

        erreurs = valider_contact_selon_canal(
            canal,
            telephone=valeur('telephone'),
            numero_whatsapp=valeur('numero_whatsapp'),
            email=valeur('email'),
        )
        if erreurs and not creation:
            # En modification : ne garder que les erreurs de FORMAT (pas
            # "obligatoire", pour ne pas bloquer un enregistrement
            # preexistant incomplet sur un champ non touche par cette
            # modification).
            erreurs = [e for e in erreurs if "obligatoire" not in e]
        if erreurs:
            raise serializers.ValidationError(erreurs)
        self._normaliser_departement(attrs, creation)
        if "mobilite" in attrs:
            m = attrs.pop("mobilite")
            type_p = attrs.get("type_personnel", getattr(self.instance, "type_personnel", "roxgold"))
            if type_p in ("roxgold", "sous_traitant"):
                attrs["mobilite_exclue"] = not m
            else:
                attrs["eligible_mobilite"] = m
        elif "type_personnel" in attrs and self.instance and attrs["type_personnel"] != self.instance.type_personnel:
            # changement de type : on repart des règles par défaut du nouveau type
            attrs.setdefault("mobilite_exclue", False)
        return attrs

    def _normaliser_departement(self, attrs, creation):
        """Département = liste de Paramétrage (Départements & sous-traitants). Le formulaire impose
        la liste déroulante ; côté serveur on reste tolérant (imports Excel, anciennes fiches) :
        - sous-traitant dont l'entreprise est connue -> département déduit de l'entreprise (via MOTA si besoin)
        - sinon la casse d'un département connu est corrigée, une valeur inconnue est conservée."""
        type_p = attrs.get("type_personnel", getattr(self.instance, "type_personnel", "roxgold"))
        societe = attrs.get("societe", getattr(self.instance, "societe", "")) or ""
        if type_p == "sous_traitant":
            ent = Entreprise.objects.filter(nom__iexact=societe.strip()).first()
            dep = ent.departement_effectif if ent else None
            if dep:
                attrs["departement"] = dep.nom
                return
        saisi = (attrs.get("departement") or "").strip()
        if saisi:
            dep = Departement.objects.filter(nom__iexact=saisi).first()
            attrs["departement"] = dep.nom if dep else saisi

    class Meta:
        model  = Personnel
        fields = [
            "id", "nom", "prenom", "societe", "departement", "numero", "matricule", "telephone", "numero_whatsapp", "type_personnel",
            "type_label", "email", "qr_code_data", "qr_code_string", "actif",
            "date_creation", "user_role", "user_active", "login_genere",
            "profil", "profil_label", "est_expatrie", "pays_origine",
            "eligible_mobilite", "mobilite_exclue", "mobilite", "a_droit_mobilite", "residence_principale",
        ]
        read_only_fields = ["qr_code_data", "qr_code_string", "date_creation"]


class BatimentSerializer(serializers.ModelSerializer):
    personnel_detail = PersonnelSerializer(source="personnel", read_only=True)
    resident_principal = serializers.SerializerMethodField()
    class Meta:
        model  = Batiment
        fields = "__all__"

    def get_resident_principal(self, obj):
        """
        Distinct de 'personnel' (occupant actuel) - le titulaire au droit
        prioritaire sur cette chambre, meme absent. None si cette chambre
        n'a pas de resident principal declare. PERFORMANCE : meme correctif
        que PersonnelSerializer.get_residence_principale - une seule
        requete pour toute la liste de batiments (204 chambres), pas une
        par chambre.
        """
        if not hasattr(self, '_residents_principaux_cache'):
            from residences.models import ResidentPrincipal
            self._residents_principaux_cache = {}
            for rp in ResidentPrincipal.objects.filter(date_fin__isnull=True).select_related("personnel"):
                self._residents_principaux_cache[rp.batiment_id] = rp
        rp = self._residents_principaux_cache.get(obj.id)
        if not rp: return None
        return {
            "id": rp.id,
            "personnel_id": rp.personnel_id,
            "personnel_nom": f"{rp.personnel.nom} {rp.personnel.prenom}" if rp.personnel else "—",
            "date_debut": rp.date_debut,
        }


class ResidentPrincipalSerializer(serializers.ModelSerializer):
    personnel_nom = serializers.SerializerMethodField()
    personnel_matricule = serializers.CharField(source="personnel.matricule", read_only=True, default="")
    batiment_residence = serializers.CharField(source="batiment.residence", read_only=True)
    occupant_actuel_nom = serializers.SerializerMethodField()
    actif = serializers.SerializerMethodField()
    affecte_par_nom = serializers.SerializerMethodField()

    class Meta:
        model = ResidentPrincipal
        fields = ["id","personnel","personnel_nom","personnel_matricule","batiment","batiment_residence",
                  "date_debut","date_fin","motif_fin","actif","occupant_actuel_nom",
                  "affecte_par","affecte_par_nom","date_creation"]
        read_only_fields = ["affecte_par","date_creation"]

    def get_personnel_nom(self, obj):
        return f"{obj.personnel.nom} {obj.personnel.prenom}" if obj.personnel else "—"

    def get_actif(self, obj):
        return obj.date_fin is None

    def get_occupant_actuel_nom(self, obj):
        """Qui occupe REELLEMENT la chambre en ce moment - peut differer du resident principal (occupant temporaire)."""
        if obj.batiment and obj.batiment.personnel:
            occ = obj.batiment.personnel
            if occ.id == obj.personnel_id:
                return None  # le resident principal occupe lui-meme sa chambre - rien de particulier a signaler
            return f"{occ.nom} {occ.prenom}"
        return None

    def get_affecte_par_nom(self, obj):
        if obj.affecte_par:
            return obj.affecte_par.get_full_name() or obj.affecte_par.username
        return "—"


class PlainteSerializer(serializers.ModelSerializer):
    occupant_nom = serializers.SerializerMethodField()
    batiment_residence = serializers.CharField(source="batiment.residence", read_only=True)
    affecte_a_nom = serializers.SerializerMethodField()
    prise_en_charge_par_nom = serializers.SerializerMethodField()
    resolu_par_nom = serializers.SerializerMethodField()
    # Categorie n'a plus de "choices=" en dur (voir models.py) - son
    # libelle affichable est desormais juste la valeur elle-meme
    # (categorie.replace("_"," ")), comme avant pour les categories issues
    # du seed historique ; plus besoin de get_categorie_display().
    categorie_label = serializers.SerializerMethodField()
    statut_label = serializers.CharField(source="get_statut_display", read_only=True)
    priorite_label = serializers.CharField(source="get_priorite_display", read_only=True)
    incident_lie_statut = serializers.CharField(source="incident_lie.get_statut_display", read_only=True, default=None)

    class Meta:
        model = Plainte
        fields = ["id","occupant","occupant_nom","utilisateur","batiment","batiment_residence","type_occupant",
                  "categorie","categorie_label","sous_categorie","description","commentaire","photo_base64",
                  "statut","statut_label","priorite","priorite_label",
                  "service","maintenance_necessaire","incident_lie","incident_lie_statut",
                  "affecte_a","affecte_a_nom","prise_en_charge_par","prise_en_charge_par_nom","date_prise_en_charge",
                  "motif_attente","resolu_par","resolu_par_nom","action_resolution","resultat_resolution",
                  "commentaire_resolution","photo_resolution_base64","date_resolution",
                  "date_confirmation","motif_reouverture","motif_rejet","date_cloture",
                  "date_creation","date_qualification","date_affectation"]
        read_only_fields = ["occupant","utilisateur","batiment","type_occupant","statut","date_creation"]

    def get_categorie_label(self, obj):
        return (obj.categorie or "").replace("_"," ")

    def validate_categorie(self, value):
        from .models import PlainteCategorie
        actives = set(PlainteCategorie.objects.filter(actif=True).values_list("nom", flat=True))
        # Si aucune categorie n'est encore configuree en base (avant que la
        # migration de seed ait tourne, ou base fraiche), on n'exclut
        # personne - mieux vaut accepter que bloquer toute creation de
        # plainte. Une fois des categories actives existent, la valeur doit
        # en faire partie.
        if actives and value not in actives:
            raise serializers.ValidationError(
                f"Catégorie inconnue ou désactivée : {value}")
        return value

    def get_occupant_nom(self, obj):
        return f"{obj.occupant.nom} {obj.occupant.prenom}" if obj.occupant else "—"

    def get_affecte_a_nom(self, obj):
        return (obj.affecte_a.get_full_name() or obj.affecte_a.username) if obj.affecte_a else None

    def get_prise_en_charge_par_nom(self, obj):
        return (obj.prise_en_charge_par.get_full_name() or obj.prise_en_charge_par.username) if obj.prise_en_charge_par else None

    def get_resolu_par_nom(self, obj):
        return (obj.resolu_par.get_full_name() or obj.resolu_par.username) if obj.resolu_par else None


class ControleChambreSerializer(serializers.ModelSerializer):
    """
    Section 19/42 : contrôle de chambre avec notation étoiles (1-5) sur
    chaque critère de propreté, et cases Oui/Non pour fournitures,
    équipements, état général. Déclenche automatiquement une Plainte
    quand une note de propreté est strictement inférieure à 2 (demande
    explicite) - plainte_generee_ref permet au frontend de la retrouver.
    """
    occupant_nom = serializers.SerializerMethodField()
    batiment_residence = serializers.CharField(source="batiment.residence", read_only=True)
    plainte_generee_ref = serializers.SerializerMethodField()
    note_minimale = serializers.SerializerMethodField()

    class Meta:
        model = ControleChambre
        fields = ["id","batiment","batiment_residence","occupant","occupant_nom","utilisateur",
                  "notes_proprete","fournitures","equipements","etat_general",
                  "commentaire","photo_base64","plainte_generee","plainte_generee_ref",
                  "note_minimale","date_creation"]
        read_only_fields = ["occupant","utilisateur","plainte_generee","date_creation"]

    def get_occupant_nom(self, obj):
        return f"{obj.occupant.nom} {obj.occupant.prenom}" if obj.occupant else "—"

    def get_note_minimale(self, obj):
        return obj.note_minimale_proprete()

    def get_plainte_generee_ref(self, obj):
        return f"Plainte #{obj.plainte_generee_id}" if obj.plainte_generee_id else None


class OccupationHistorySerializer(serializers.ModelSerializer):
    personnel_detail = PersonnelSerializer(source="personnel", read_only=True)
    class Meta:
        model  = OccupationHistory
        fields = "__all__"


class DemandeSerializer(serializers.ModelSerializer):
    demandeur_nom   = serializers.SerializerMethodField()
    traite_par_nom  = serializers.SerializerMethodField()
    type_label      = serializers.SerializerMethodField()
    statut_label    = serializers.SerializerMethodField()

    def get_demandeur_nom(self, obj):
        if obj.demandeur:
            return f"{obj.demandeur.first_name} {obj.demandeur.last_name}".strip() or obj.demandeur.username
        return "—"

    def get_traite_par_nom(self, obj):
        if obj.traite_par:
            return f"{obj.traite_par.first_name} {obj.traite_par.last_name}".strip() or obj.traite_par.username
        return "—"

    def get_type_label(self, obj):
        return obj.get_type_demande_display() if hasattr(obj, 'get_type_demande_display') else obj.type_demande

    def get_statut_label(self, obj):
        return obj.get_statut_display() if hasattr(obj, 'get_statut_display') else obj.statut

    class Meta:
        model  = __import__('residences.models', fromlist=['Demande']).Demande
        fields = [
            "id", "type_demande", "type_label", "statut", "statut_label",
            "demandeur", "demandeur_nom", "traite_par", "traite_par_nom",
            "donnees", "residence_souhaitee", "residence_attribuee",
            "message_demandeur", "commentaire_admin", "proposition_admin",
            "date_debut_souhaitee", "date_fin_souhaitee",
            "date_creation", "date_traitement", "date_reponse",
        ]
        read_only_fields = [
            "demandeur", "traite_par", "statut", "commentaire_admin",
            "proposition_admin", "date_traitement", "date_reponse"
        ]


class InductionRecordSerializer(serializers.ModelSerializer):
    """Serializer pour le suivi d'induction QHSE."""
    personnel_detail = PersonnelSerializer(source="personnel", read_only=True)
    progression      = serializers.SerializerMethodField()

    def get_progression(self, obj):
        return obj.progression_pct()

    class Meta:
        model  = InductionRecord
        fields = [
            "id", "personnel", "personnel_detail", "statut", "motif_refus",
            "etapes_data", "form_data", "docs_data", "medical_data",
            "quiz_score", "quiz_tentatives",
            "date_debut", "date_fin",
            "badge_emis", "badge_date", "badge_expire",
            "progression",
        ]
        read_only_fields = ["date_debut", "date_fin", "badge_date"]


# ── Contenu éditable Induction Camp ──────────────────────────────────
class InductionCampConfigSerializer(serializers.ModelSerializer):
    class Meta:
        model = InductionCampConfig
        fields = "__all__"


class InductionInfraSerializer(serializers.ModelSerializer):
    class Meta:
        model = InductionInfra
        fields = "__all__"

    def validate_video(self, value):
        if value and value.size > 50 * 1024 * 1024:
            raise serializers.ValidationError("La vidéo doit faire moins de 50 Mo. Compressez-la avant de l'importer.")
        return value


class InductionRegleSerializer(serializers.ModelSerializer):
    class Meta:
        model = InductionRegle
        fields = "__all__"


class InductionQuizQuestionSerializer(serializers.ModelSerializer):
    class Meta:
        model = InductionQuizQuestion
        fields = "__all__"


class InductionQuizQuestionPublicSerializer(serializers.ModelSerializer):
    """Version sans la bonne réponse — exposée au personnel qui passe le quiz,
    pour éviter de tricher en lisant la réponse dans la requête réseau."""
    class Meta:
        model = InductionQuizQuestion
        fields = ["id", "question", "options", "ordre"]


class PlainteCategorieSerializer(serializers.ModelSerializer):
    class Meta:
        model = PlainteCategorie
        fields = ["id", "nom", "sous_categories", "actif", "ordre"]


class DepartementSerializer(serializers.ModelSerializer):
    nb_personnel = serializers.SerializerMethodField()

    class Meta:
        model = Departement
        fields = ["id", "nom", "ordre", "actif", "nb_personnel"]

    def get_nb_personnel(self, obj):
        return Personnel.objects.filter(departement__iexact=obj.nom, actif=True).count()


class EntrepriseSerializer(serializers.ModelSerializer):
    departement_nom = serializers.CharField(source="departement.nom", read_only=True, default="")
    entreprise_mere_nom = serializers.CharField(source="entreprise_mere.nom", read_only=True, default="")
    departement_effectif_nom = serializers.SerializerMethodField()
    rattachement = serializers.SerializerMethodField()

    class Meta:
        model = Entreprise
        fields = ["id", "nom", "departement", "departement_nom", "entreprise_mere", "entreprise_mere_nom",
                  "departement_effectif_nom", "rattachement", "actif"]

    def get_departement_effectif_nom(self, obj):
        d = obj.departement_effectif
        return d.nom if d else ""

    def get_rattachement(self, obj):
        return "mota" if obj.entreprise_mere_id else "departement"

    def validate(self, attrs):
        dep = attrs.get("departement", getattr(self.instance, "departement", None))
        mere = attrs.get("entreprise_mere", getattr(self.instance, "entreprise_mere", None))
        if dep and mere:
            raise serializers.ValidationError("Un sous-traitant est rattaché SOIT à ROXGOLD (avec son département), SOIT à une entreprise mère (ex. MOTA) — pas les deux.")
        # ni l'un ni l'autre = entreprise principale sans département (ex. MOTA) : autorisé uniquement pour l'existant
        if not dep and not mere and not (self.instance and self.instance.sous_traitants.exists()):
            raise serializers.ValidationError("Entreprise ROXGOLD : choisis son département ; sinon rattache-la à une entreprise mère (ex. MOTA).")
        if mere and self.instance and mere.pk == self.instance.pk:
            raise serializers.ValidationError("Une entreprise ne peut pas être sa propre mère.")
        return attrs
