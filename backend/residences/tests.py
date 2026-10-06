"""
Tests Gestion des Plaintes + Controle de Chambre (document dedie,
sections 51-54 - premiers tests reels de ce fichier, le stub etait vide).
Couvre precisement les regles de securite non negociables (section 54) :
un occupant ne peut jamais choisir sa chambre, voir/modifier la plainte
d'un autre, ni s'auto-qualifier/affecter/resoudre.
"""
from django.test import TestCase
from django.contrib.auth.models import User
from rest_framework.test import APIRequestFactory, force_authenticate

from .models import Personnel, Batiment, Plainte, ControleChambre, ResidentPrincipal, PointInteret, CheminCirculation
from .views import PlainteViewSet, ControleChambreViewSet, PointInteretViewSet, CheminCirculationViewSet
from .sig_classification import classifier
from django.core.management import call_command


def _admin():
    return User.objects.create_superuser("admintest", "a@a.com", "pass")


class PlainteCreationTests(TestCase):
    """Section 52 : qui peut deposer une plainte, et comment la chambre est determinee."""

    def setUp(self):
        self.rf = APIRequestFactory()
        self.admin = _admin()
        self.agent_u = User.objects.create_user("agentA", "a1@a.com", "pass")
        self.agent = Personnel.objects.create(nom="Kone", prenom="Ibrahim", societe="ROXGOLD",
            numero="TPX1", telephone="1", type_personnel="roxgold", user=self.agent_u)
        self.chambre = Batiment.objects.create(residence="A12", bloc="A", statut="Occupé", personnel=self.agent)

    def _creer(self, user, data):
        req = self.rf.post("/api/plaintes/", data, format="json")
        force_authenticate(req, user=user)
        return PlainteViewSet.as_view({"post": "create"})(req)

    def test_occupant_heberge_peut_deposer(self):
        resp = self._creer(self.agent_u, {"categorie": "Proprete", "sous_categorie": "poubelle", "description": "Poubelle jamais vidée"})
        self.assertEqual(resp.status_code, 201)
        self.assertEqual(resp.data["batiment_residence"], "A12")

    def test_sans_hebergement_actif_refuse(self):
        sans_logement_u = User.objects.create_user("sanslogement", "s@a.com", "pass")
        Personnel.objects.create(nom="Sans", prenom="Logement", societe="ROXGOLD",
            numero="TPX2", telephone="2", type_personnel="roxgold", user=sans_logement_u)
        resp = self._creer(sans_logement_u, {"categorie": "Proprete", "description": "Test"})
        self.assertEqual(resp.status_code, 403)

    def test_chambre_jamais_choisie_par_occupant(self):
        """Regle 36/37 : meme en envoyant un autre batiment_id dans la requete, le backend l'ignore."""
        autre_chambre = Batiment.objects.create(residence="Z99", bloc="Z", statut="Libre")
        resp = self._creer(self.agent_u, {"categorie": "Proprete", "description": "Test",
            "batiment": autre_chambre.id, "batiment_residence": "Z99"})
        self.assertEqual(resp.status_code, 201)
        self.assertEqual(resp.data["batiment_residence"], "A12")  # jamais Z99

    def test_type_occupant_deduit_resident_principal(self):
        ResidentPrincipal.objects.create(personnel=self.agent, batiment=self.chambre,
            date_debut="2026-01-01", affecte_par=self.admin)
        resp = self._creer(self.agent_u, {"categorie": "Proprete", "description": "Test"})
        self.assertEqual(resp.data["type_occupant"], "resident_principal")

    def test_visiteur_heberge_peut_deposer(self):
        visiteur_u = User.objects.create_user("visiteurA", "v@a.com", "pass")
        visiteur = Personnel.objects.create(nom="Visiteur", prenom="Test", societe="EXT",
            numero="TPX3", telephone="3", type_personnel="visiteur", user=visiteur_u)
        Batiment.objects.create(residence="V01", bloc="V", statut="Occupé", personnel=visiteur)
        resp = self._creer(visiteur_u, {"categorie": "Proprete", "description": "Test visiteur"})
        self.assertEqual(resp.status_code, 201)
        self.assertEqual(resp.data["type_occupant"], "visiteur")

    def test_categorie_et_description_obligatoires(self):
        resp = self._creer(self.agent_u, {"categorie": "Proprete"})
        self.assertEqual(resp.status_code, 400)

    def test_categorie_inconnue_refusee(self):
        resp = self._creer(self.agent_u, {"categorie": "Inexistante", "description": "Test"})
        self.assertEqual(resp.status_code, 400)


class PlainteCreerPourOccupantTests(TestCase):
    """Le bouton 'Signaler' sur Residents principaux - un admin cree une plainte pour un AUTRE occupant."""

    def setUp(self):
        self.rf = APIRequestFactory()
        self.admin = _admin()
        self.agent_u = User.objects.create_user("agentcpo", "acpo@a.com", "pass")
        self.agent = Personnel.objects.create(nom="Kone", prenom="Ibrahim", societe="ROXGOLD",
            numero="CPO1", telephone="1", type_personnel="roxgold", user=self.agent_u)
        Batiment.objects.create(residence="F09", bloc="F", statut="Occupé", personnel=self.agent)

    def _appel(self, data, user=None):
        req = self.rf.post("/api/plaintes/creer_pour_occupant/", data, format="json")
        force_authenticate(req, user=user or self.admin)
        return PlainteViewSet.as_view({"post": "creer_pour_occupant"})(req)

    def test_admin_cree_pour_occupant(self):
        resp = self._appel({"personnel": self.agent.id, "categorie": "Proprete", "sous_categorie": "sol", "description": "Sol sale"})
        self.assertEqual(resp.status_code, 201)
        self.assertEqual(resp.data["batiment_residence"], "F09")

    def test_non_habilite_refuse(self):
        resp = self._appel({"personnel": self.agent.id, "categorie": "Proprete", "description": "Test"}, user=self.agent_u)
        self.assertEqual(resp.status_code, 403)

    def test_personne_sans_hebergement_refuse(self):
        sans_u = User.objects.create_user("sanscpo", "s@a.com", "pass")
        sans_pers = Personnel.objects.create(nom="Sans", prenom="Logement", societe="ROXGOLD",
            numero="CPO2", telephone="2", type_personnel="roxgold", user=sans_u)
        resp = self._appel({"personnel": sans_pers.id, "categorie": "Proprete", "description": "Test"})
        self.assertEqual(resp.status_code, 400)


class PlainteSecuriteTests(TestCase):
    """Section 54 : tests de securite explicitement exiges par le document."""

    def setUp(self):
        self.rf = APIRequestFactory()
        self.admin = _admin()
        self.agent1_u = User.objects.create_user("agent1s", "a1@a.com", "pass")
        self.agent2_u = User.objects.create_user("agent2s", "a2@a.com", "pass")
        self.agent1 = Personnel.objects.create(nom="Kone", prenom="Ibrahim", societe="ROXGOLD",
            numero="SEC1", telephone="1", type_personnel="roxgold", user=self.agent1_u)
        self.agent2 = Personnel.objects.create(nom="Traore", prenom="Awa", societe="ROXGOLD",
            numero="SEC2", telephone="2", type_personnel="roxgold", user=self.agent2_u)
        Batiment.objects.create(residence="B05", bloc="B", statut="Occupé", personnel=self.agent1)
        req = self.rf.post("/api/plaintes/", {"categorie": "Proprete", "description": "Test"}, format="json")
        force_authenticate(req, user=self.agent1_u)
        self.plainte = PlainteViewSet.as_view({"post": "create"})(req).data

    def test_ne_peut_pas_consulter_plainte_dautrui(self):
        req = self.rf.get(f"/api/plaintes/{self.plainte['id']}/")
        force_authenticate(req, user=self.agent2_u)
        resp = PlainteViewSet.as_view({"get": "retrieve"})(req, pk=self.plainte["id"])
        self.assertEqual(resp.status_code, 404)

    def test_ne_peut_pas_qualifier(self):
        req = self.rf.post(f"/api/plaintes/{self.plainte['id']}/qualifier/", {"priorite": "haute"}, format="json")
        force_authenticate(req, user=self.agent1_u)
        resp = PlainteViewSet.as_view({"post": "qualifier"})(req, pk=self.plainte["id"])
        self.assertEqual(resp.status_code, 403)

    def test_ne_peut_pas_saffecter(self):
        req = self.rf.post(f"/api/plaintes/{self.plainte['id']}/affecter/", {"affecte_a": self.agent1_u.id}, format="json")
        force_authenticate(req, user=self.agent1_u)
        resp = PlainteViewSet.as_view({"post": "affecter"})(req, pk=self.plainte["id"])
        self.assertEqual(resp.status_code, 403)

    def test_ne_peut_pas_se_resoudre_soi_meme(self):
        req = self.rf.post(f"/api/plaintes/{self.plainte['id']}/resoudre/", {"resultat_resolution": "fait"}, format="json")
        force_authenticate(req, user=self.agent1_u)
        resp = PlainteViewSet.as_view({"post": "resoudre"})(req, pk=self.plainte["id"])
        self.assertEqual(resp.status_code, 403)

    def test_liste_filtree_par_occupant(self):
        req = self.rf.get("/api/plaintes/")
        force_authenticate(req, user=self.agent2_u)
        resp = PlainteViewSet.as_view({"get": "list"})(req)
        ids = [p["id"] for p in resp.data] if isinstance(resp.data, list) else [p["id"] for p in resp.data.get("results", [])]
        self.assertNotIn(self.plainte["id"], ids)

    def test_admin_voit_toutes_les_plaintes(self):
        req = self.rf.get("/api/plaintes/")
        force_authenticate(req, user=self.admin)
        resp = PlainteViewSet.as_view({"get": "list"})(req)
        ids = [p["id"] for p in resp.data] if isinstance(resp.data, list) else [p["id"] for p in resp.data.get("results", [])]
        self.assertIn(self.plainte["id"], ids)


class PlainteWorkflowTests(TestCase):
    """Section 26/51-53 : workflow complet, transitions historisees."""

    def setUp(self):
        self.rf = APIRequestFactory()
        self.admin = _admin()
        self.agent_u = User.objects.create_user("agentw", "aw@a.com", "pass")
        self.agent = Personnel.objects.create(nom="Kone", prenom="Ibrahim", societe="ROXGOLD",
            numero="WFX1", telephone="1", type_personnel="roxgold", user=self.agent_u)
        Batiment.objects.create(residence="C07", bloc="C", statut="Occupé", personnel=self.agent)
        req = self.rf.post("/api/plaintes/", {"categorie": "Electricite", "sous_categorie": "prise", "description": "Prise HS"}, format="json")
        force_authenticate(req, user=self.agent_u)
        self.pk = PlainteViewSet.as_view({"post": "create"})(req).data["id"]

    def _appel(self, action, data, user=None):
        req = self.rf.post(f"/api/plaintes/{self.pk}/{action}/", data, format="json")
        force_authenticate(req, user=user or self.admin)
        return PlainteViewSet.as_view({"post": action})(req, pk=self.pk)

    def test_workflow_complet_jusqua_cloture(self):
        r1 = self._appel("qualifier", {"priorite": "haute", "service": "Électricité"})
        self.assertEqual(r1.status_code, 200)
        r2 = self._appel("affecter", {"affecte_a": self.admin.id})
        self.assertEqual(r2.status_code, 200)
        self.assertEqual(r2.data["statut"], "affectee")
        r3 = self._appel("prendre_en_charge", {})
        self.assertEqual(r3.status_code, 200)
        r4 = self._appel("resoudre", {"resultat_resolution": "Prise remplacée", "action_resolution": "Remplacement"})
        self.assertEqual(r4.status_code, 200)
        self.assertEqual(r4.data["statut"], "resolue")
        # Confirmation par l'occupant lui-meme (pas l'admin)
        r5 = self._appel("confirmer", {"resolu": True}, user=self.agent_u)
        self.assertEqual(r5.status_code, 200)
        self.assertEqual(r5.data["statut"], "cloturee")

    def test_reouverture_si_non_resolu(self):
        self._appel("qualifier", {"priorite": "haute"})
        self._appel("affecter", {"affecte_a": self.admin.id})
        self._appel("prendre_en_charge", {})
        self._appel("resoudre", {"resultat_resolution": "fait"})
        r = self._appel("confirmer", {"resolu": False, "motif": "Toujours cassé"}, user=self.agent_u)
        self.assertEqual(r.status_code, 200)
        self.assertIn(r.data["statut"], ("reouverte", "en_cours"))

    def test_mise_en_attente_motif_obligatoire(self):
        self._appel("qualifier", {"priorite": "moyenne"})
        r = self._appel("mettre_en_attente", {})
        self.assertEqual(r.status_code, 400)
        r2 = self._appel("mettre_en_attente", {"motif_attente": "piece_indisponible"})
        self.assertEqual(r2.status_code, 200)

    def test_rejet_motif_obligatoire(self):
        r = self._appel("rejeter", {})
        self.assertEqual(r.status_code, 400)
        r2 = self._appel("rejeter", {"motif": "Doublon d'une autre plainte"})
        self.assertEqual(r2.status_code, 200)
        self.assertEqual(r2.data["statut"], "rejetee")

    def test_historique_conserve(self):
        """Section 37 : l'historique doit permettre de reconstruire le traitement."""
        self._appel("qualifier", {"priorite": "haute"})
        p = Plainte.objects.get(pk=self.pk)
        self.assertGreaterEqual(p.history.count(), 2)  # creation + qualification


class ControleChambreTests(TestCase):
    """Notation etoiles (1-5) sur la proprete + signal de mecontentement automatique."""

    def setUp(self):
        self.rf = APIRequestFactory()
        self.admin = _admin()
        self.agent_u = User.objects.create_user("agentc", "ac@a.com", "pass")
        self.agent = Personnel.objects.create(nom="Kone", prenom="Ibrahim", societe="ROXGOLD",
            numero="CTX1", telephone="1", type_personnel="roxgold", user=self.agent_u)
        Batiment.objects.create(residence="D03", bloc="D", statut="Occupé", personnel=self.agent)

    def _controler(self, notes):
        req = self.rf.post("/api/controles-chambre/", {"notes_proprete": notes}, format="json")
        force_authenticate(req, user=self.agent_u)
        return ControleChambreViewSet.as_view({"post": "create"})(req)

    def test_notes_correctes_acceptees(self):
        resp = self._controler({"sol": 5, "murs": 4, "wc": 3})
        self.assertEqual(resp.status_code, 201)
        self.assertIsNone(resp.data["plainte_generee_ref"])

    def test_note_basse_genere_plainte_automatique(self):
        resp = self._controler({"sol": 1, "murs": 4})
        self.assertEqual(resp.status_code, 201)
        self.assertIsNotNone(resp.data["plainte_generee_ref"])
        self.assertEqual(Plainte.objects.filter(occupant=self.agent, categorie="Proprete").count(), 1)

    def test_note_hors_intervalle_refusee(self):
        resp = self._controler({"sol": 7})
        self.assertEqual(resp.status_code, 400)

    def test_critere_inconnu_refuse(self):
        resp = self._controler({"critere_bidon": 3})
        self.assertEqual(resp.status_code, 400)

    def test_sans_hebergement_refuse(self):
        sans_u = User.objects.create_user("sanshebergement", "sh@a.com", "pass")
        Personnel.objects.create(nom="Sans", prenom="Hebergement", societe="ROXGOLD",
            numero="CTX2", telephone="2", type_personnel="roxgold", user=sans_u)
        req = self.rf.post("/api/controles-chambre/", {"notes_proprete": {"sol": 3}}, format="json")
        force_authenticate(req, user=sans_u)
        resp = ControleChambreViewSet.as_view({"post": "create"})(req)
        self.assertEqual(resp.status_code, 403)


class SigClassificationTests(TestCase):
    """Classification centralisee des elements SIG_V2.kml - noms
    specifiques avant generiques, normalisation accents/casse, repli sur
    le nom de couche quand le Placemark porte un identifiant generique."""

    def test_nom_specifique_reconnu(self):
        r = classifier("Infirmerie principale", ["SIG", "Infra"])
        self.assertTrue(r["reconnu"])
        self.assertEqual(r["categorie_sig"], "infrastructures")
        self.assertEqual(r["type_label"], "Infirmerie")

    def test_priorite_specifique_avant_generique(self):
        r = classifier("Salle de sport", ["SIG", "Infra"])
        self.assertEqual(r["type_label"], "Salle de sport")
        r2 = classifier("Toilette commune", ["SIG", "Infra"])
        self.assertEqual(r2["type_label"], "Toilette commune")
        r3 = classifier("Toilette", ["SIG", "Infra"])
        self.assertEqual(r3["type_label"], "Toilette")

    def test_normalisation_accents_casse(self):
        r1 = classifier("GUERITE", [])
        r2 = classifier("Guérite principale", [])
        r3 = classifier("guerite", [])
        for r in (r1, r2, r3):
            self.assertEqual(r["type_label"], "Guérite")

    def test_repli_sur_couche_si_nom_generique(self):
        r = classifier("kml_5", ["SIG", "Relief", "TALUS"])
        self.assertTrue(r["reconnu"])
        self.assertEqual(r["methode"], "couche_repli")
        self.assertEqual(r["categorie_sig"], "relief_terrain")
        self.assertEqual(r["code_champ"], "talus")

    def test_nom_non_reconnu_devient_autre_sig(self):
        r = classifier("Workshop", ["SIG", "Infra"])
        self.assertFalse(r["reconnu"])
        self.assertEqual(r["categorie_sig"], "autre_sig")


class ImportSigTests(TestCase):
    """L'import SIG_V2 doit etre idempotent et ne jamais toucher aux
    residences (Batiment)."""

    def test_import_est_idempotent_sans_doublons(self):
        call_command("import_sig")
        total_pi_1 = PointInteret.objects.count()
        total_cc_1 = CheminCirculation.objects.count()
        self.assertGreater(total_pi_1, 0)
        self.assertGreater(total_cc_1, 0)

        call_command("import_sig")  # re-import
        self.assertEqual(PointInteret.objects.count(), total_pi_1)
        self.assertEqual(CheminCirculation.objects.count(), total_cc_1)

    def test_import_ne_cree_aucune_residence(self):
        avant = Batiment.objects.count()
        call_command("import_sig")
        self.assertEqual(Batiment.objects.count(), avant)

    def test_elements_non_classifies_conserves_pas_supprimes(self):
        call_command("import_sig")
        self.assertTrue(PointInteret.objects.filter(categorie="autre", nom="Workshop").exists())
        self.assertTrue(PointInteret.objects.filter(categorie="autre", nom="Admin").exists())


class CarteSigListeCompleteTests(TestCase):
    """
    Regression : GET /api/points-interet/ et /api/chemins-circulation/
    doivent renvoyer l'INTEGRALITE du reseau, jamais une page tronquee.

    Root cause reelle trouvee en prod : MapPage.jsx lit `r.data.results ||
    r.data` en un seul appel (jamais de pagination cote frontend, la carte
    doit tout afficher d'un coup) alors que les deux ViewSet heritaient de
    la pagination DRF par defaut (PAGE_SIZE=50, voir settings.py). Avec
    des tracés deja existants avant l'import SIG_V2 (99 elements a eux
    seuls, cf ImportSigTests), le talus et la cloture tombaient au-dela de
    la page 1 et disparaissaient silencieusement de la carte - aucune
    erreur, juste des elements "invisibles" malgre des donnees correctes
    en base. Corrige en desactivant la pagination sur ces deux ViewSet
    (pagination_class = None) : ce test verifie que ca ne regresse pas.
    """

    def _get_liste(self, viewset_class, url):
        request = APIRequestFactory().get(url)
        force_authenticate(request, user=_admin())
        response = viewset_class.as_view({"get": "list"})(request)
        response.render() if hasattr(response, "render") else None
        return response

    def test_points_interet_pagination_desactivee(self):
        self.assertIsNone(PointInteretViewSet.pagination_class)

    def test_chemins_circulation_pagination_desactivee(self):
        self.assertIsNone(CheminCirculationViewSet.pagination_class)

    def test_plus_de_50_chemins_sont_tous_renvoyes(self):
        call_command("import_sig")  # 99 CheminCirculation (cf ImportSigTests) : > PAGE_SIZE (50)
        total = CheminCirculation.objects.filter(actif=True).count()
        self.assertGreater(total, 50, "le scenario de regression exige plus de 50 elements")

        response = self._get_liste(CheminCirculationViewSet, "/api/chemins-circulation/")
        self.assertEqual(response.status_code, 200)
        # Sans pagination, DRF renvoie une liste brute (pas de clef "results").
        self.assertNotIsInstance(response.data, dict)
        self.assertEqual(len(response.data), total)
        types = {el["type_chemin"] for el in response.data}
        self.assertIn("talus", types)
        self.assertIn("cloture", types)
        self.assertIn("escalier", types)


class PersonnelContactObligatoireTests(TestCase):
    """
    Demande explicite : envoi automatique des identifiants (creation
    individuelle ET import CSV) par le canal choisi dans Parametrage
    (canal_otp), et rendre obligatoire + valider le format du champ de
    contact correspondant (telephone/whatsapp/email). Voir
    accounts/contact_validation.py, accounts/notifications.py.
    """

    def setUp(self):
        from .views import PersonnelViewSet
        from accounts.models import Parametre
        self.rf = APIRequestFactory()
        self.admin = _admin()
        self.ViewSet = PersonnelViewSet
        Parametre.objects.update_or_create(cle="canal_otp", defaults={"valeur": "sms"})

    def _create(self, payload):
        request = self.rf.post("/api/personnel/", payload, format="json")
        force_authenticate(request, user=self.admin)
        return self.ViewSet.as_view({"post": "create"})(request)

    def test_canal_sms_sans_telephone_est_refuse(self):
        resp = self._create({"nom": "Kone", "prenom": "Awa", "societe": "ROXGOLD", "type_personnel": "roxgold", "numero_whatsapp": "0701234567"})
        self.assertEqual(resp.status_code, 400)

    def test_canal_sms_telephone_invalide_est_refuse(self):
        resp = self._create({"nom": "Kone", "prenom": "Awa", "societe": "ROXGOLD", "type_personnel": "roxgold", "telephone": "123", "numero_whatsapp": "0701234567"})
        self.assertEqual(resp.status_code, 400)

    def test_sans_whatsapp_est_refuse(self):
        """Durcissement : le numero WhatsApp est desormais TOUJOURS
        obligatoire, quel que soit le canal_otp configure (avant, il
        n'etait requis qu'en canal='whatsapp')."""
        resp = self._create({"nom": "Kone", "prenom": "Awa", "societe": "ROXGOLD", "type_personnel": "roxgold", "telephone": "0701234567"})
        self.assertEqual(resp.status_code, 400)

    def test_whatsapp_invalide_est_refuse(self):
        resp = self._create({"nom": "Kone", "prenom": "Awa", "societe": "ROXGOLD", "type_personnel": "roxgold", "telephone": "0701234567", "numero_whatsapp": "abc"})
        self.assertEqual(resp.status_code, 400)

    def test_canal_sms_telephone_et_whatsapp_valides_est_accepte(self):
        resp = self._create({"nom": "Kone", "prenom": "Awa", "societe": "ROXGOLD", "type_personnel": "roxgold", "telephone": "0701234567", "numero_whatsapp": "0701234567"})
        self.assertEqual(resp.status_code, 201)
        self.assertIn("identifiants_envoyes", resp.data)
        self.assertEqual(resp.data["identifiants_envoyes"]["canal"], "sms")

    def test_canal_email_sans_email_est_refuse(self):
        from accounts.models import Parametre
        Parametre.objects.update_or_create(cle="canal_otp", defaults={"valeur": "email"})
        resp = self._create({"nom": "Kone", "prenom": "Awa", "societe": "ROXGOLD", "type_personnel": "roxgold", "telephone": "0701234567", "numero_whatsapp": "0701234567"})
        self.assertEqual(resp.status_code, 400)

    def test_canal_email_avec_email_invalide_est_refuse(self):
        from accounts.models import Parametre
        Parametre.objects.update_or_create(cle="canal_otp", defaults={"valeur": "email"})
        resp = self._create({"nom": "Kone", "prenom": "Awa", "societe": "ROXGOLD", "type_personnel": "roxgold", "telephone": "0701234567", "numero_whatsapp": "0701234567", "email": "pas-un-email"})
        self.assertEqual(resp.status_code, 400)

    def test_canal_email_avec_email_valide_est_accepte_et_envoye(self):
        """Meme en canal 'email', telephone + whatsapp restent obligatoires
        (nouvelle regle) - seul l'email est en PLUS requis pour ce canal."""
        from accounts.models import Parametre
        Parametre.objects.update_or_create(cle="canal_otp", defaults={"valeur": "email"})
        Parametre.objects.update_or_create(cle="email_provider", defaults={"valeur": "test"})
        resp = self._create({"nom": "Kone", "prenom": "Awa", "societe": "ROXGOLD", "type_personnel": "roxgold", "telephone": "0701234567", "numero_whatsapp": "0701234567", "email": "awa.kone@example.com"})
        self.assertEqual(resp.status_code, 201)
        self.assertEqual(resp.data["identifiants_envoyes"]["canal"], "email")
        self.assertTrue(resp.data["identifiants_envoyes"]["ok"])

    def test_modification_personnel_existant_incomplet_non_bloquee(self):
        """Un Personnel deja en base sans telephone (cree avant cette
        regle) doit rester modifiable sur d'AUTRES champs, sans etre
        force de renseigner un telephone retroactivement."""
        p = Personnel.objects.create(nom="Old", prenom="Record", societe="ROXGOLD", numero="OLD1", type_personnel="roxgold")
        request = self.rf.patch(f"/api/personnel/{p.id}/", {"departement": "RH"}, format="json")
        force_authenticate(request, user=self.admin)
        resp = self.ViewSet.as_view({"patch": "partial_update"})(request, pk=p.id)
        self.assertEqual(resp.status_code, 200)


class PersonnelImportCsvIdentifiantsTests(TestCase):
    """Import CSV en masse : meme regle de contact obligatoire + meme
    envoi automatique des identifiants que la creation individuelle."""

    def setUp(self):
        from .views import PersonnelViewSet
        from accounts.models import Parametre
        self.rf = APIRequestFactory()
        self.admin = _admin()
        self.ViewSet = PersonnelViewSet
        Parametre.objects.update_or_create(cle="canal_otp", defaults={"valeur": "sms"})

    def _import(self, rows):
        request = self.rf.post("/api/personnel/import_csv_data/", {"rows": rows}, format="json")
        force_authenticate(request, user=self.admin)
        return self.ViewSet.as_view({"post": "import_csv_data"})(request)

    def test_ligne_sans_telephone_est_ignoree_avec_erreur(self):
        resp = self._import([{"nom": "Traore", "prenom": "Seydou", "societe": "ROXGOLD", "type_personnel": "roxgold", "numero_whatsapp": "0709876543"}])
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data["imported"], 0)
        self.assertEqual(len(resp.data["errors"]), 1)
        self.assertFalse(Personnel.objects.filter(nom="TRAORE").exists())

    def test_ligne_sans_whatsapp_est_ignoree_avec_erreur(self):
        """Durcissement : whatsapp desormais obligatoire aussi a l'import CSV."""
        resp = self._import([{"nom": "Traore", "prenom": "Seydou", "societe": "ROXGOLD", "type_personnel": "roxgold", "telephone": "0709876543"}])
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data["imported"], 0)
        self.assertEqual(len(resp.data["errors"]), 1)
        self.assertFalse(Personnel.objects.filter(nom="TRAORE").exists())

    def test_ligne_valide_est_importee_et_identifiants_envoyes(self):
        resp = self._import([{"nom": "Traore", "prenom": "Seydou", "societe": "ROXGOLD", "type_personnel": "roxgold", "telephone": "0709876543", "numero_whatsapp": "0709876543"}])
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data["imported"], 1)
        self.assertEqual(resp.data["errors"], [])
        self.assertEqual(resp.data["identifiants_envoyes"], 1)
        self.assertTrue(Personnel.objects.filter(nom="TRAORE").exists())

    def test_import_mixte_lignes_valides_et_invalides(self):
        resp = self._import([
            {"nom": "Bon", "prenom": "Un", "societe": "ROXGOLD", "type_personnel": "roxgold", "telephone": "0701111111", "numero_whatsapp": "0701111111"},
            {"nom": "Mauvais", "prenom": "Deux", "societe": "ROXGOLD", "type_personnel": "roxgold", "telephone": "abc", "numero_whatsapp": "0701111111"},
        ])
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data["imported"], 1)
        self.assertEqual(len(resp.data["errors"]), 1)
        self.assertTrue(Personnel.objects.filter(nom="BON").exists())
        self.assertFalse(Personnel.objects.filter(nom="MAUVAIS").exists())


class InductionDroitsTests(TestCase):
    """Induction QHSE : l'agent remplit ses étapes, pas la visite médicale ni le badge ; médical / HSE valident."""

    def setUp(self):
        from rest_framework.test import APIClient
        from accounts.models import Profile
        self.agent = User.objects.create_user("edgar", password="x")
        self.p = Personnel.objects.create(nom="K", prenom="Edgar", societe="R", user=self.agent)
        self.med = User.objects.create_user("doc", password="x")
        Profile.objects.update_or_create(user=self.med, defaults={"role": "medical"})
        self.hse = User.objects.create_user("hse", password="x")
        Profile.objects.update_or_create(user=self.hse, defaults={"role": "hse"})
        self.c = APIClient()

    def maj(self, user, etape):
        self.c.force_authenticate(User.objects.get(pk=user.pk))
        return self.c.post("/api/induction-records/update_etape/", {"personnel_id": self.p.id, "etape": etape}, format="json").status_code

    def test_droits_par_profil(self):
        self.assertEqual(self.maj(self.agent, "quiz"), 200)
        self.assertEqual(self.maj(self.agent, "medical"), 403)
        self.assertEqual(self.maj(self.agent, "badge"), 403)
        self.assertEqual(self.maj(self.med, "medical"), 200)
        self.assertEqual(self.maj(self.med, "quiz"), 403)
        self.assertEqual(self.maj(self.hse, "badge"), 200)
