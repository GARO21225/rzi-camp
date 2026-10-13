"""
Tests Gestion des Plaintes + Controle de Chambre (document dedie,
sections 51-54 - premiers tests reels de ce fichier, le stub etait vide).
Couvre precisement les regles de securite non negociables (section 54) :
un occupant ne peut jamais choisir sa chambre, voir/modifier la plainte
d'un autre, ni s'auto-qualifier/affecter/resoudre.
"""
SIG = "data:image/png;base64," + "A" * 3000
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
        self.assertEqual(resp.data["imported"], 1, resp.data)
        self.assertEqual(resp.data["errors"], [])
        self.assertEqual(resp.data["identifiants_envoyes"], 1)
        self.assertTrue(Personnel.objects.filter(nom="TRAORE").exists())

    def test_import_mixte_lignes_valides_et_invalides(self):
        resp = self._import([
            {"nom": "Bon", "prenom": "Un", "societe": "ROXGOLD", "type_personnel": "roxgold", "telephone": "0701111111", "numero_whatsapp": "0701111111"},
            {"nom": "Mauvais", "prenom": "Deux", "societe": "ROXGOLD", "type_personnel": "roxgold", "telephone": "abc", "numero_whatsapp": "0701111111"},
        ])
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data["imported"], 1, resp.data)
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


class ChambresAdminTests(TestCase):
    """Historique, KML, étages, actions en masse (admin)."""

    KML = (b'<?xml version="1.0"?><kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>kml</name>'
           b'<Placemark><name>kml_1</name><LineString><coordinates>'
           b'-6.822,8.1114,0 -6.8219,8.1115,0 -6.8218,8.1114,0 -6.822,8.1114,0</coordinates></LineString></Placemark>'
           b'</Document></kml>')

    def setUp(self):
        from rest_framework.test import APIClient
        self.su = User.objects.create_superuser("root", "r@r.fr", "x")
        self.c = APIClient()
        self.c.force_authenticate(self.su)

    def test_supprimer_historique_courant_libere_la_chambre(self):
        import datetime
        from .models import OccupationHistory
        p = Personnel.objects.create(nom="K", prenom="Edgar")
        b = Batiment.objects.create(residence="B1", bloc="Bloc_B", statut="Occupé", personnel=p,
                                    occupant="K Edgar", date_arrivee=datetime.date(2026, 10, 5))
        h = OccupationHistory.objects.create(batiment=b, personnel=p, occupant_nom="K Edgar",
                                             date_arrivee=datetime.date(2026, 10, 5))
        r = self.c.delete(f"/api/occupation-history-admin/{h.id}/")
        self.assertEqual(r.status_code, 200)
        self.assertTrue(r.data["chambre_liberee"])
        b.refresh_from_db()
        self.assertEqual((b.statut, b.personnel_id, b.date_arrivee), ("Libre", None, None))

    def test_supprimer_ligne_en_cours_synthetique_libere_la_chambre(self):
        import datetime
        p = Personnel.objects.create(nom="K", prenom="Edgar")
        b = Batiment.objects.create(residence="B2", bloc="Bloc_B", statut="Occupé", personnel=p,
                                    occupant="K Edgar", date_arrivee=datetime.date(2026, 10, 5))
        r = self.c.delete(f"/api/occupation-history-admin/bat-{b.id}/")
        self.assertEqual(r.status_code, 200)
        b.refresh_from_db()
        self.assertEqual((b.statut, b.personnel_id), ("Libre", None))

    def test_supprimer_historique_ancien_ne_touche_pas_la_chambre(self):
        import datetime
        from .models import OccupationHistory
        p = Personnel.objects.create(nom="K", prenom="Edgar")
        b = Batiment.objects.create(residence="B1", bloc="Bloc_B", statut="Occupé", personnel=p, occupant="K Edgar")
        h = OccupationHistory.objects.create(batiment=b, personnel=p, occupant_nom="K Edgar",
                                             date_arrivee=datetime.date(2026, 1, 1), date_depart=datetime.date(2026, 2, 1))
        self.c.delete(f"/api/occupation-history-admin/{h.id}/")
        b.refresh_from_db()
        self.assertEqual(b.statut, "Occupé")

    def test_kml_nom_generique_refuse_puis_nom_fourni(self):
        from django.core.files.uploadedfile import SimpleUploadedFile
        r = self.c.post("/api/batiments/importer-kml/", {"fichier": SimpleUploadedFile("carte.kml", self.KML)}, format="multipart")
        self.assertEqual(r.status_code, 400)
        self.assertTrue(r.data["nom_requis"])
        r = self.c.post("/api/batiments/importer-kml/", {"fichier": SimpleUploadedFile("f95a0259-B106.kml", self.KML)}, format="multipart")
        self.assertEqual(r.data["importes"][0]["nom"], "B106")
        r = self.c.post("/api/batiments/importer-kml/", {"fichier": SimpleUploadedFile("c.kml", self.KML), "nom": "B107", "etage": "1"}, format="multipart")
        self.assertEqual(Batiment.objects.get(residence="B107").etage, 1)

    def test_action_masse_statut_ignore_les_occupees(self):
        p = Personnel.objects.create(nom="K", prenom="E")
        a = Batiment.objects.create(residence="X1", bloc="B", statut="Réservé")
        b = Batiment.objects.create(residence="X2", bloc="B", statut="Occupé", personnel=p)
        r = self.c.post("/api/batiments/action-masse/", {"ids": [a.id, b.id], "action": "statut", "statut": "Libre"}, format="json")
        self.assertEqual((r.data["modifies"], r.data["ignores"]), (1, 1))

    def test_action_masse_statut_liberer_occupants(self):
        p = Personnel.objects.create(nom="K", prenom="E")
        b = Batiment.objects.create(residence="X3", bloc="B", statut="Occupé", personnel=p, occupant="K E")
        r = self.c.post("/api/batiments/action-masse/", {"ids": [b.id], "action": "statut", "statut": "Réservé", "liberer_occupants": True}, format="json")
        self.assertEqual((r.data["modifies"], r.data["liberes"]), (1, 1))
        b.refresh_from_db()
        self.assertEqual((b.statut, b.personnel_id), ("Réservé", None))

    def test_retours_anticipes_nominatifs_reserves_aux_admins(self):
        from rest_framework.test import APIClient
        u = User.objects.create_user("simple", password="x")
        c = APIClient(); c.force_authenticate(u)
        self.assertEqual(c.get("/api/voyages/retours_anticipes/").json(), [])


class ConflitResidencePrincipaleTests(TestCase):
    """Loger quelqu'un dans la résidence principale d'un autre doit avertir (409), sauf confirmation."""

    def setUp(self):
        from rest_framework.test import APIClient
        import datetime
        self.today = datetime.date.today()
        self.admin = User.objects.create_user("admc", is_staff=True, is_superuser=True)
        self.c = APIClient(); self.c.force_authenticate(self.admin)
        self.rp = Personnel.objects.create(nom="Titulaire", prenom="Paul", societe="ROXGOLD", actif=True)
        self.autre = Personnel.objects.create(nom="Remplacant", prenom="Luc", societe="ROXGOLD", actif=True)
        self.bat = Batiment.objects.create(residence="CP1", bloc="BX", statut="Libre")
        ResidentPrincipal.objects.create(batiment=self.bat, personnel=self.rp, date_debut=self.today)

    def _loger(self, **extra):
        d = {"personnel": self.autre.id, "statut": "Occupé", **extra}
        return self.c.patch(f"/api/batiments/{self.bat.id}/", d, format="json")

    def test_absent_avec_retour_chevauchant(self):
        import datetime
        from voyages.models import Voyage
        Voyage.objects.create(personnel=self.rp, origine="Camp", destination="Abidjan", date_depart=self.today,
                              date_retour_prevue=self.today + datetime.timedelta(days=10), statut="en_voyage")
        r = self._loger()
        self.assertEqual(r.status_code, 409)
        self.assertTrue(r.data["conflit_residence_principale"])
        self.assertEqual(r.data["retour_prevu"], str(self.today + datetime.timedelta(days=10)))
        # séjour qui finit avant le retour : pas de conflit
        r = self._loger(date_depart=str(self.today + datetime.timedelta(days=3)))
        self.assertEqual(r.status_code, 200, r.data)

    def test_absent_sans_date_de_retour_connue_avertit(self):
        r = self._loger()
        self.assertEqual(r.status_code, 409)
        self.assertIsNone(r.data["retour_prevu"])

    def test_titulaire_present_avertit_et_confirmation_passe(self):
        Batiment.objects.filter(pk=self.bat.pk).update(statut="Occupé", personnel=self.rp, occupant="Titulaire Paul")
        r = self._loger()
        self.assertEqual(r.status_code, 409)
        self.assertTrue(r.data["present"])
        r = self._loger(ignorer_conflit_residence=True)
        self.assertEqual(r.status_code, 200, r.data)

    def test_chambre_sans_resident_principal_libre(self):
        ResidentPrincipal.objects.all().delete()
        self.assertEqual(self._loger().status_code, 200)


class DepartementsEntreprisesTests(TestCase):
    def setUp(self):
        from rest_framework.test import APIClient
        self.admin = User.objects.create_user("admd", is_staff=True, is_superuser=True)
        self.user = User.objects.create_user("simple")
        self.c = APIClient(); self.c.force_authenticate(self.admin)

    def test_semis_depuis_le_fichier(self):
        from .models import Departement, Entreprise
        self.assertEqual(Departement.objects.count(), 13)
        self.assertEqual(Entreprise.objects.get(nom="MOTA ENGIL").departement.nom, "Mining")
        mota = Entreprise.objects.get(nom="MOTA")
        self.assertIsNone(mota.departement)
        jachris = Entreprise.objects.get(nom="JACHRIS")
        self.assertEqual(jachris.entreprise_mere, mota)
        self.assertIsNone(jachris.departement_effectif)

    def test_ecriture_admin_lecture_ouverte(self):
        from rest_framework.test import APIClient
        c = APIClient(); c.force_authenticate(self.user)
        self.assertEqual(c.get("/api/departements/").status_code, 200)
        self.assertEqual(c.post("/api/departements/", {"nom": "Nouveau"}, format="json").status_code, 403)

    def test_rattachement_exclusif(self):
        from .models import Departement, Entreprise
        dep = Departement.objects.get(nom="Process")
        mota = Entreprise.objects.get(nom="MOTA")
        self.assertEqual(self.c.post("/api/entreprises/", {"nom": "X1"}, format="json").status_code, 400)
        self.assertEqual(self.c.post("/api/entreprises/", {"nom": "X2", "departement": dep.id, "entreprise_mere": mota.id}, format="json").status_code, 400)
        self.assertEqual(self.c.post("/api/entreprises/", {"nom": "X3", "entreprise_mere": mota.id}, format="json").status_code, 201)

    def test_personnel_sous_traitant_departement_deduit_et_casse_corrigee(self):
        base = {"prenom": "A", "telephone": "+2250102030405", "email": "a@b.com", "numero_whatsapp": "+2250102030405"}
        r = self.c.post("/api/personnel/", {**base, "nom": "ST", "societe": "NEEMBA", "type_personnel": "sous_traitant"}, format="json")
        self.assertEqual(r.status_code, 201, r.data)
        self.assertEqual(r.data["departement"], "")  # NEEMBA -> MOTA : MOTA n'a pas de département
        r = self.c.post("/api/personnel/", {**base, "nom": "RX", "societe": "ROXGOLD", "type_personnel": "roxgold", "departement": "it"}, format="json")
        self.assertEqual(r.status_code, 201, r.data)
        self.assertEqual(r.data["departement"], "IT")

    def test_suppression_refusee_si_utilise_et_renommage_propage(self):
        from .models import Departement
        dep = Departement.objects.get(nom="Finance")
        Personnel.objects.create(nom="F", prenom="x", societe="ROXGOLD", departement="Finance")
        self.assertEqual(self.c.delete(f"/api/departements/{dep.id}/").status_code, 400)
        self.assertEqual(self.c.patch(f"/api/departements/{dep.id}/", {"nom": "Finance & Compta"}, format="json").status_code, 200)
        self.assertEqual(Personnel.objects.get(nom="F").departement, "Finance & Compta")


class DroitMobiliteTests(TestCase):
    def setUp(self):
        from rest_framework.test import APIClient
        self.admin = User.objects.create_user("admm", is_staff=True, is_superuser=True)
        self.c = APIClient(); self.c.force_authenticate(self.admin)
        self.p = Personnel.objects.create(nom="Kone", prenom="Aya", societe="ROXGOLD",
                                          type_personnel="roxgold")

    def _droit(self):
        return self.c.get(f"/api/personnel/{self.p.pk}/").json()["a_droit_mobilite"]

    def test_retirer_puis_rajouter_roxgold(self):
        self.assertTrue(self._droit())
        r = self.c.patch(f"/api/personnel/{self.p.pk}/", {"mobilite": False}, format="json")
        self.assertEqual(r.status_code, 200, r.content)
        self.assertFalse(self._droit())
        self.c.patch(f"/api/personnel/{self.p.pk}/", {"mobilite": True}, format="json")
        self.assertTrue(self._droit())

    def test_visiteur_ajout_et_retrait(self):
        self.p.type_personnel = "visiteur"; self.p.save()
        self.assertFalse(self._droit())
        self.c.patch(f"/api/personnel/{self.p.pk}/", {"mobilite": True}, format="json")
        self.assertTrue(self._droit())
        self.c.patch(f"/api/personnel/{self.p.pk}/", {"mobilite": False}, format="json")
        self.assertFalse(self._droit())

    def test_filtre_droit_mobilite(self):
        self.c.patch(f"/api/personnel/{self.p.pk}/", {"mobilite": False}, format="json")
        ids = [x["id"] for x in self.c.get("/api/personnel/?droit_mobilite=true&page_size=500").json().get("results", [])]
        self.assertNotIn(self.p.pk, ids)

    def test_motifs_par_defaut(self):
        r = self.c.get("/api/parametres/")
        cles = [x["cle"] for x in (r.json() if isinstance(r.json(), list) else r.json()["results"])]
        self.assertIn("mobilite_motifs", cles)


class InductionCampRecordTests(TestCase):
    def test_fin_de_parcours_est_memorisee_par_utilisateur(self):
        from django.contrib.auth.models import User
        from rest_framework.test import APIClient
        u = User.objects.create_user("edgar", password="x")
        autre = User.objects.create_user("autre", password="x")
        c = APIClient(); c.force_authenticate(u)
        self.assertEqual(c.get("/api/induction-camp/").json(), [])
        r = c.post("/api/induction-camp/", {"signature_base64": SIG, "appareils": [{"type": "TV"}], "quiz_score": 5}, format="json")
        self.assertEqual(r.status_code, 201)
        c.post("/api/induction-camp/", {"signature_base64": SIG}, format="json")   # idempotent
        d = c.get("/api/induction-camp/").json()
        self.assertEqual([x["user"] for x in d], [u.id])
        c2 = APIClient(); c2.force_authenticate(autre)
        self.assertEqual(c2.get("/api/induction-camp/").json(), [])


class InductionCampResumeTests(TestCase):
    def test_chiffres_admin_comptent_le_parcours_camp(self):
        from django.contrib.auth.models import User
        from rest_framework.test import APIClient
        adm = User.objects.create_user("adm", password="x", is_staff=True)
        ue = User.objects.create_user("edgar", password="x"); ud = User.objects.create_user("dylan", password="x")
        Personnel.objects.create(nom="Kouamé", prenom="Edgar", societe="ROXGOLD", user=ue)
        Personnel.objects.create(nom="Dylan", prenom="D", societe="ROXGOLD", user=ud)
        Personnel.objects.create(nom="SansCompte", prenom="X", societe="ROXGOLD")
        c = APIClient(); c.force_authenticate(ue)
        c.post("/api/induction-camp/", {"signature_base64": SIG, "appareils": [{"type": "TV"}]}, format="json")
        self.assertEqual(c.get("/api/induction-camp/resume/").status_code, 403)
        c.force_authenticate(adm)
        d = c.get("/api/induction-camp/resume/").json()
        self.assertEqual((d["total"], d["termines"], d["non_commences"]), (2, 1, 1))
        self.assertEqual([l["nom"] for l in d["lignes"] if l["complete"]], ["KOUAMÉ EDGAR"])


class BatimentNomsTests(TestCase):
    def test_noms_ouvert_a_un_non_admin_sans_occupants(self):
        from rest_framework.test import APIClient
        from django.contrib.auth.models import User
        Batiment.objects.create(residence="R-7", bloc="B", statut="Libre")
        u = User.objects.create_user("simple", password="x")
        c = APIClient(); c.force_authenticate(u)
        r = c.get("/api/batiments/noms/")
        self.assertEqual(r.status_code, 200)
        self.assertIn({"residence": "R-7", "bloc": "B"}, r.json()["residences"])
        self.assertNotIn("personnel", str(r.json()))


class PlainteAssignationEtFriseTests(TestCase):
    """Assigner / réassigner / retirer + frise d'étapes reconstituée depuis l'historique."""

    def setUp(self):
        self.rf = APIRequestFactory()
        self.admin = _admin()
        self.t1 = User.objects.create_user("tech1", "t1@a.com", "pass", first_name="Awa", last_name="Tech")
        self.t2 = User.objects.create_user("tech2", "t2@a.com", "pass", first_name="Ben", last_name="Tech")
        from accounts.models import Profile
        for u in (self.t1, self.t2):
            Profile.objects.update_or_create(user=u, defaults={"role": "technicien"})
        occ_u = User.objects.create_user("occup", "o@a.com", "pass")
        occ = Personnel.objects.create(nom="Zadi", prenom="Eric", societe="ROXGOLD", numero="PF1", telephone="1", type_personnel="roxgold", user=occ_u)
        Batiment.objects.create(residence="D01", bloc="D", statut="Occupé", personnel=occ)
        req = self.rf.post("/api/plaintes/", {"categorie": "Electricite", "sous_categorie": "prise", "description": "Prise HS"}, format="json")
        force_authenticate(req, user=occ_u)
        self.pk = PlainteViewSet.as_view({"post": "create"})(req).data["id"]

    def _post(self, action, data=None):
        req = self.rf.post(f"/api/plaintes/{self.pk}/{action}/", data or {}, format="json")
        force_authenticate(req, user=self.admin)
        return PlainteViewSet.as_view({"post": action})(req, pk=self.pk)

    def _get(self, action, detail=True):
        req = self.rf.get(f"/api/plaintes/{self.pk}/{action}/")
        force_authenticate(req, user=self.admin)
        view = PlainteViewSet.as_view({"get": action})
        return view(req, pk=self.pk) if detail else view(req)

    def test_agents_liste_les_techniciens_avec_charge(self):
        self._post("affecter", {"affecte_a": self.t1.id})
        noms = {a["id"]: a for a in self._get("agents", detail=False).data}
        self.assertIn(self.t1.id, noms)
        self.assertEqual(noms[self.t1.id]["en_cours"], 1)
        self.assertEqual(noms[self.t2.id]["en_cours"], 0)

    def test_affecter_reaffecter_retirer_et_frise(self):
        self.assertEqual(self._post("affecter", {"affecte_a": self.t1.id}).status_code, 200)
        self.assertEqual(self._post("affecter", {"affecte_a": self.t2.id}).data["affecte_a"], self.t2.id)
        r = self._post("retirer")
        self.assertEqual(r.status_code, 200)
        self.assertIsNone(r.data["affecte_a"])
        cles = [e["cle"] for e in self._get("chronologie").data["etapes"]]
        self.assertEqual(cles[0], "depose")
        self.assertEqual(cles[1:4], ["affectee", "reaffectee", "retiree"])

    def test_agents_refuse_un_simple_occupant(self):
        occ_u = User.objects.get(username="occup")
        req = self.rf.get("/api/plaintes/agents/")
        force_authenticate(req, user=occ_u)
        self.assertEqual(PlainteViewSet.as_view({"get": "agents"})(req).status_code, 403)


class HistoriqueChambreExacteTests(TestCase):
    """Chambre A2 : ne ramène pas A20…A29, liste tous les occupants (passés + actuel) et un résumé."""

    def setUp(self):
        import datetime
        from .models import OccupationHistory
        self.admin = _admin()
        self.rf = APIRequestFactory()
        self.a2 = Batiment.objects.create(residence="A2", bloc="A", statut="Occupé")
        self.a21 = Batiment.objects.create(residence="A21", bloc="A", statut="Libre")
        d = datetime.date
        OccupationHistory.objects.create(batiment=self.a2, occupant_nom="Un", date_arrivee=d(2025, 1, 1), date_depart=d(2025, 1, 11))
        OccupationHistory.objects.create(batiment=self.a2, occupant_nom="Deux", date_arrivee=d(2025, 2, 1), date_depart=d(2025, 2, 6))
        OccupationHistory.objects.create(batiment=self.a21, occupant_nom="Intrus", date_arrivee=d(2025, 3, 1), date_depart=d(2025, 3, 3))
        actuel = Personnel.objects.create(nom="Actuel", prenom="P", societe="ROXGOLD", numero="HC1", telephone="1", type_personnel="roxgold")
        self.a2.personnel, self.a2.occupant, self.a2.date_arrivee = actuel, "Actuel P", d(2025, 6, 1)
        self.a2.save()
        # l'occupant actuel a déjà une ligne d'historique pour une autre personne : il doit rester visible
        self.view = None

    def _rech(self, **params):
        from .views import OccupationHistoryViewSet
        req = self.rf.get("/api/occupation-history/recherche/", params)
        force_authenticate(req, user=self.admin)
        return OccupationHistoryViewSet.as_view({"get": "recherche"})(req).data

    def test_exact_exclut_a21_et_inclut_occupant_actuel(self):
        r = self._rech(batiment="A2", exact=1)
        noms = sorted(x["occupant"] for x in r["results"])
        self.assertEqual(noms, ["Actuel P", "Deux", "Un"])
        self.assertEqual(r["resume"]["nb_personnes"], 3)

    def test_sans_exact_comportement_historique(self):
        noms = {x["occupant"] for x in self._rech(batiment="A2")["results"]}
        self.assertIn("Intrus", noms)


class HistoriqueChambreTraceAuditTests(TestCase):
    """Un occupant passé seulement tracé par l'audit de la chambre (pas d'OccupationHistory) doit apparaître."""

    def test_occupant_trace_par_audit_est_liste(self):
        import datetime
        from .views import OccupationHistoryViewSet
        admin = _admin()
        b = Batiment.objects.create(residence="A02", bloc="A", statut="Libre")
        p1 = Personnel.objects.create(nom="Kouassi", prenom="Jean", societe="ROXGOLD", numero="TR1", telephone="1", type_personnel="roxgold")
        b.statut, b.personnel, b.occupant, b.date_arrivee = "Occupé", p1, "Kouassi Jean", datetime.date(2025, 3, 1)
        b.save()                       # génère une ligne HistoricalBatiment
        b.statut, b.personnel, b.occupant = "Libre", None, None
        b.save()                       # chambre libérée SANS OccupationHistory
        req = APIRequestFactory().get("/api/occupation-history/recherche/", {"batiment": "A02", "exact": 1})
        force_authenticate(req, user=admin)
        data = OccupationHistoryViewSet.as_view({"get": "recherche"})(req).data
        self.assertEqual([r["occupant"] for r in data["results"]], ["Kouassi Jean"])
        self.assertEqual(data["results"][0]["source"], "trace")


class PlainteAntiDoublonTests(TestCase):
    """Valider plusieurs fois de suite (double-clic) ne crée qu'une seule plainte."""

    def test_cinq_validations_une_seule_plainte(self):
        rf = APIRequestFactory()
        admin = _admin()
        occ = Personnel.objects.create(nom="Yao", prenom="Paul", societe="ROXGOLD", numero="AD1", telephone="1", type_personnel="roxgold")
        Batiment.objects.create(residence="F01", bloc="F", statut="Occupé", personnel=occ)
        ids = set()
        for _ in range(5):
            req = rf.post("/api/plaintes/creer_pour_occupant/", {"personnel": occ.id, "categorie": "Electricite", "description": "Prise HS"}, format="json")
            force_authenticate(req, user=admin)
            r = PlainteViewSet.as_view({"post": "creer_pour_occupant"})(req)
            self.assertIn(r.status_code, (200, 201))
            ids.add(r.data["id"])
        self.assertEqual(len(ids), 1)
        self.assertEqual(Plainte.objects.count(), 1)


class HistoriqueChambreConfidentialiteTests(TestCase):
    """Un résident ne voit que ses propres séjours dans une chambre, jamais ceux des autres."""

    def setUp(self):
        import datetime
        from .models import OccupationHistory
        self.rf = APIRequestFactory()
        self.moi_u = User.objects.create_user("moi_h", "m@a.com", "pass")
        self.moi = Personnel.objects.create(nom="Moi", prenom="M", societe="ROXGOLD", numero="CF1", telephone="1", type_personnel="roxgold", user=self.moi_u)
        self.autre = Personnel.objects.create(nom="Autre", prenom="A", societe="ROXGOLD", numero="CF2", telephone="1", type_personnel="roxgold")
        b = Batiment.objects.create(residence="A2", bloc="A", statut="Libre")
        d = datetime.date
        OccupationHistory.objects.create(batiment=b, personnel=self.moi, occupant_nom="Moi M", date_arrivee=d(2026, 1, 1), date_depart=d(2026, 1, 5))
        OccupationHistory.objects.create(batiment=b, personnel=self.autre, occupant_nom="Autre A", date_arrivee=d(2026, 2, 1), date_depart=d(2026, 2, 5))

    def _vue(self, action, user, params=None):
        from .views import OccupationHistoryViewSet
        req = self.rf.get("/x/", params or {})
        force_authenticate(req, user=user)
        return OccupationHistoryViewSet.as_view({"get": action})(req)

    def test_recherche_et_liste_limitees_a_soi(self):
        noms = [r["occupant"] for r in self._vue("recherche", self.moi_u, {"batiment": "A2"}).data["results"]]
        self.assertEqual(noms, ["Moi M"])
        liste = self._vue("list", self.moi_u, {"batiment": "A2"}).data
        liste = liste.get("results", liste)
        self.assertEqual([r["occupant_nom"] for r in liste], ["Moi M"])

    def test_recherche_ignore_le_filtre_personnel_dun_autre(self):
        data = self._vue("recherche", self.moi_u, {"personnel": self.autre.id}).data
        self.assertEqual([r["occupant"] for r in data["results"]], ["Moi M"])

    def test_admin_voit_tout(self):
        noms = {r["occupant"] for r in self._vue("recherche", _admin(), {"batiment": "A2"}).data["results"]}
        self.assertEqual(noms, {"Moi M", "Autre A"})
