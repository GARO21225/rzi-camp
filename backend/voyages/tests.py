import datetime

from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient

from residences.models import Personnel
from evenements.models import SimpleNotification
from .models import Rotation, Voyage, SuiviConvoi, ArretConvoi, EvenementMonteeDescente


class SuiviConvoiTests(TestCase):
    """Parcours complet du suivi en direct : partir -> positions -> arrêt/dépose -> reprendre -> arriver."""

    def setUp(self):
        self.admin = User.objects.create_user("admin", password="x", is_staff=True)
        self.chauffeur_user = User.objects.create_user("chauffeur", password="x")
        self.autre_user = User.objects.create_user("autre", password="x")
        self.chauffeur = Personnel.objects.create(nom="Traoré", prenom="Moussa", societe="ROXGOLD", user=self.chauffeur_user)
        today = datetime.date.today()
        self.rotation = Rotation.objects.create(
            rotation_id="ROT-T1", vehicule="BUS-01", vehicule_matricule="1234AB01",
            conducteur="Moussa Traoré", conducteur_personnel=self.chauffeur,
            origine="Camp Roxgold Sango", destination="Abidjan",
            date_depart=today, date_retour_prevue=today + datetime.timedelta(days=14),
        )
        self.voyages = []
        for i in range(3):
            p = Personnel.objects.create(nom=f"Passager{i}", prenom="P", societe="ROXGOLD")
            self.voyages.append(Voyage.objects.create(
                personnel=p, rotation_id="ROT-T1", destination="Abidjan",
                date_depart=today, date_retour_prevue=today + datetime.timedelta(days=14),
            ))
        self.c = APIClient()

    def url(self, action=""):
        return f"/api/suivi-convois/ROT-T1/{action + '/' if action else ''}"

    def test_parcours_complet(self):
        self.c.force_authenticate(self.chauffeur_user)
        r = self.c.get("/api/suivi-convois/mes_convois/")
        self.assertEqual(r.status_code, 200)
        self.assertEqual([x["rotation_id"] for x in r.data], ["ROT-T1"])

        # Une position avant le départ est refusée
        self.assertEqual(self.c.post(self.url("position"), {"latitude": 9.1, "longitude": -5.1}, format="json").status_code, 400)

        r = self.c.post(self.url("partir"), {"latitude": 9.10, "longitude": -5.10}, format="json")
        self.assertEqual(r.status_code, 201, r.data)
        self.assertEqual(r.data["suivi"]["nb_a_bord"], 3)
        self.assertTrue(all(v.statut == "en_voyage" for v in Voyage.objects.filter(rotation_id="ROT-T1")))
        self.assertEqual(self.c.post(self.url("partir"), {}, format="json").status_code, 400)

        r = self.c.post(self.url("position"), {"latitude": 8.9, "longitude": -5.0, "vitesse_kmh": 72}, format="json")
        self.assertEqual(r.status_code, 200)

        r = self.c.post(self.url("arret"), {
            "type": "depose", "lieu": "Yamoussoukro", "deposes": [self.voyages[0].id],
        }, format="json")
        self.assertEqual(r.status_code, 201, r.data)
        self.assertEqual(r.data["suivi"]["statut"], "arret")
        self.assertEqual(r.data["suivi"]["nb_a_bord"], 2)
        self.assertEqual(ArretConvoi.objects.get().nb_a_bord, 2)
        self.assertTrue(EvenementMonteeDescente.objects.filter(voyage=self.voyages[0], type_evenement="descente").exists())

        r = self.c.post(self.url("reprendre"), {}, format="json")
        self.assertEqual(r.data["suivi"]["statut"], "en_route")
        self.assertIsNotNone(ArretConvoi.objects.get().fin)

        r = self.c.post(self.url("arriver"), {"latitude": 5.35, "longitude": -4.0}, format="json")
        self.assertEqual(r.data["suivi"]["statut"], "arrive")

        # Admin notifié : départ + arrêt + arrivée
        self.assertEqual(SimpleNotification.objects.filter(user=self.admin).count(), 3)

        # Carte admin
        self.c.force_authenticate(self.admin)
        r = self.c.get("/api/suivi-convois/actifs/")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data[0]["suivi"]["nb_a_bord"], 2)
        self.assertGreaterEqual(len(r.data[0]["suivi"]["trace"]), 1)

    def test_acces_refuse_aux_non_conducteurs(self):
        self.c.force_authenticate(self.autre_user)
        self.assertEqual(self.c.post(self.url("partir"), {}, format="json").status_code, 403)
        self.assertEqual(self.c.get("/api/suivi-convois/actifs/").status_code, 403)
        self.assertEqual(self.c.get("/api/suivi-convois/mes_convois/").data, [])
        self.assertFalse(SuiviConvoi.objects.exists())

    def test_admin_peut_demarrer(self):
        self.c.force_authenticate(self.admin)
        self.assertEqual(self.c.post(self.url("partir"), {}, format="json").status_code, 201)


class ConfirmerDepartItineraireTests(TestCase):
    """Départ résidence confirmé par le résident : choix de l'itinéraire + lieu de descente parmi ses villes."""

    def setUp(self):
        from residences.models import Batiment
        from .models import ItineraireModele
        User.objects.create_user("admin", password="x", is_staff=True)
        self.u = User.objects.create_user("edgar", password="x")
        self.p = Personnel.objects.create(nom="Kouamé", prenom="Edgar", societe="ROXGOLD", user=self.u)
        self.b = Batiment.objects.create(residence="A2", bloc="A", statut="Occupé", personnel=self.p,
                                         date_depart=datetime.date.today())
        # Camp → Abidjan est créé par la migration 0031
        self.camp_abj = ItineraireModele.objects.get(nom="Camp → Abidjan")
        self.c = APIClient()
        self.c.force_authenticate(self.u)

    def url(self):
        return f"/api/batiments/{self.b.id}/confirmer_depart/"

    def test_villes_de_l_itineraire_par_defaut(self):
        self.assertEqual(self.camp_abj.villes_descente(),
                         ["SEGUELA", "MANKONO", "TIENINGBOUE", "BOUAKE", "YAMOUSSOUKRO", "ABIDJAN"])

    def test_descente_dans_une_ville_de_l_itineraire(self):
        r = self.c.post(self.url(), {"action": "confirme", "itineraire_id": self.camp_abj.id, "destination": "bouake"}, format="json")
        self.assertEqual(r.status_code, 200, r.data)
        v = Voyage.objects.get(pk=r.data["voyage_id"])
        self.assertEqual(v.destination, "BOUAKE")
        self.assertEqual(v.origine, "CAMP")
        self.assertEqual(v.statut, "en_voyage")
        self.assertEqual(v.etapes.filter(sens="aller").count(), 6)

    def test_ville_hors_itineraire_refusee(self):
        r = self.c.post(self.url(), {"action": "confirme", "itineraire_id": self.camp_abj.id, "destination": "Korhogo"}, format="json")
        self.assertEqual(r.status_code, 400)
        self.assertFalse(Voyage.objects.exists())

    def test_sans_itineraire_defaut_camp_abidjan(self):
        r = self.c.post(self.url(), {"action": "confirme"}, format="json")
        self.assertEqual(r.status_code, 200, r.data)
        self.assertEqual(r.data["destination"], "ABIDJAN")
        self.assertEqual(r.data["itineraire"], "Camp → Abidjan")


class OrganiserRotationTests(TestCase):
    """« À organiser » : compléter un convoi existant, capacité du véhicule, véhicule personnel."""

    def setUp(self):
        from residences.models import Demande
        from .models import ItineraireModele, VehiculeFlotte
        self.Demande = Demande
        self.admin = User.objects.create_user("admin", password="x", is_staff=True)
        self.c = APIClient()
        self.c.force_authenticate(self.admin)
        self.itin = ItineraireModele.objects.get(nom="Camp → Abidjan")
        self.bus = VehiculeFlotte.objects.create(nom="Coaster", categorie="bus", matricule="1111AA01", capacite=20)
        self.chauffeur = Personnel.objects.create(nom="Traoré", prenom="Moussa", societe="ROXGOLD")
        self.dd = datetime.date.today() + datetime.timedelta(days=3)

    def demande_validee(self, nom, **donnees):
        u = User.objects.create_user(nom.lower(), password="x")
        Personnel.objects.create(nom=nom, prenom="X", societe="ROXGOLD", user=u)
        d = self.Demande.objects.create(type_demande="voyage", demandeur=u, message_demandeur="rotation",
                                        date_debut_souhaitee=self.dd, date_fin_souhaitee=self.dd + datetime.timedelta(days=14),
                                        donnees=donnees)
        r = self.c.post(f"/api/demandes/{d.id}/valider/", {}, format="json")
        self.assertEqual(r.status_code, 200, r.data)
        return d

    def organiser(self, **body):
        return self.c.post("/api/voyages/organiser_demandes_en_rotation/", body, format="json")

    def test_une_demande_organisee_reste_un_convoi_extensible(self):
        d1 = self.demande_validee("Kone", itineraire_modele=self.itin.id)
        r = self.organiser(demande_ids=[d1.id], vehicule_matricule="1111AA01", vehicule="Coaster", conducteur_id=self.chauffeur.id)
        self.assertEqual(r.status_code, 201, r.data)
        rid = r.data["rotation_id"]
        self.assertEqual(r.data["nb_places_total"], 20)  # capacité du véhicule, pas 1
        # Le convoi formé automatiquement à la validation est conservé (pas un nouveau)
        self.assertEqual(Voyage.objects.get(demande_origine=d1).rotation_id, rid)
        # Une 2e demande validée plus tard s'ajoute au MÊME convoi
        d2 = self.demande_validee("Yao")
        r = self.organiser(demande_ids=[d2.id], rotation_id=rid)
        self.assertEqual(r.status_code, 201, r.data)
        self.assertEqual(r.data["nb_passagers_total"], 2)
        v2 = Voyage.objects.get(demande_origine=d2)
        self.assertEqual((v2.rotation_id, v2.vehicule_matricule, v2.conducteur_personnel_id), (rid, "1111AA01", self.chauffeur.id))
        self.assertEqual(v2.etapes.filter(sens="aller").count(), 6)  # itinéraire du convoi appliqué
        # Et un passager peut encore rejoindre (le convoi n'est pas « complet »)
        p3 = Personnel.objects.create(nom="Bamba", prenom="I", societe="ROXGOLD")
        r = self.c.post("/api/voyages/rejoindre_rotation/", {"rotation_id": rid, "personnel_id": p3.id}, format="json")
        self.assertEqual(r.status_code, 201, r.data)

    def test_demande_sans_itineraire_n_est_plus_un_convoi_fantome(self):
        d = self.demande_validee("Kone")
        v = Voyage.objects.get(demande_origine=d)
        self.assertIsNone(v.rotation_id)
        self.assertEqual(v.type_voyage, "individuel")
        ids = [x["demande_id"] for x in self.c.get("/api/voyages/demandes_a_organiser/").data["demandes_a_organiser"]]
        self.assertIn(d.id, ids)

    def test_vehicule_personnel(self):
        d = self.demande_validee("Kone", itineraire_modele=self.itin.id, vehicule_personnel=True, immatriculation="7788 BB 01")
        v = Voyage.objects.get(demande_origine=d)
        self.assertTrue(v.vehicule_personnel)
        self.assertIsNone(v.rotation_id)
        self.assertEqual(v.vehicule_matricule, "7788 BB 01")
        self.assertEqual(v.etapes.count(), 6)
        ids = [x["demande_id"] for x in self.c.get("/api/voyages/demandes_a_organiser/").data["demandes_a_organiser"]]
        self.assertNotIn(d.id, ids)
        self.assertEqual(self.organiser(voyage_ids=[v.id], vehicule_matricule="1111AA01", conducteur_id=self.chauffeur.id).status_code, 400)

    def test_capacite_du_vehicule_respectee(self):
        from .models import VehiculeFlotte
        VehiculeFlotte.objects.create(nom="4x4", categorie="4x4", matricule="2222", capacite=1)
        d1, d2 = self.demande_validee("Kone"), self.demande_validee("Yao")
        r = self.organiser(demande_ids=[d1.id, d2.id], vehicule_matricule="2222", conducteur_id=self.chauffeur.id)
        self.assertEqual(r.status_code, 400)


class TrajetsAllerSimpleTests(TestCase):
    """Camp → X : « je reviens le » + trajet retour automatique ; X → Camp : « je repars le » -> date d'hébergement."""

    def setUp(self):
        from residences.models import Batiment, ResidentPrincipal
        from .models import ItineraireModele
        self.admin = User.objects.create_user("admin", password="x", is_staff=True)
        self.u = User.objects.create_user("edgar", password="x")
        self.p = Personnel.objects.create(nom="Kouamé", prenom="Edgar", societe="ROXGOLD", user=self.u)
        self.today = datetime.date.today()
        self.b = Batiment.objects.create(residence="A2", bloc="A", statut="Occupé", personnel=self.p, date_depart=self.today)
        ResidentPrincipal.objects.create(personnel=self.p, batiment=self.b, date_debut=self.today - datetime.timedelta(days=30))
        self.camp_abj = ItineraireModele.objects.get(nom="Camp → Abidjan")
        self.c = APIClient()

    def confirmer(self, **extra):
        self.c.force_authenticate(self.u)
        return self.c.post(f"/api/batiments/{self.b.id}/confirmer_depart/",
                           {"action": "confirme", "itineraire_id": self.camp_abj.id, "destination": "BOUAKE", **extra}, format="json")

    def test_depart_avec_date_de_retour_cree_le_trajet_retour(self):
        retour = self.today + datetime.timedelta(days=14)
        r = self.confirmer(date_retour=str(retour))
        self.assertEqual(r.status_code, 200, r.data)
        aller = Voyage.objects.get(pk=r.data["voyage_id"])
        self.assertTrue(aller.trajet_aller_seul)
        self.assertEqual(aller.date_retour_prevue, retour)
        v = Voyage.objects.get(pk=r.data["retour_voyage_id"])
        self.assertEqual((v.origine, v.destination, v.date_depart, v.statut), ("BOUAKE", "CAMP", retour, "planifie"))
        self.assertFalse(v.trajet_aller_seul)
        rot = Rotation.objects.get(rotation_id=v.rotation_id)
        self.assertEqual(rot.itineraire_modele.nom, "Abidjan → Camp")
        self.assertEqual(rot.date_depart, retour)

    def test_date_de_retour_avant_le_depart_refusee(self):
        r = self.confirmer(date_retour=str(self.today))
        self.assertEqual(r.status_code, 400)
        self.assertFalse(Voyage.objects.exists())

    def test_arrivee_au_camp_restitue_la_chambre_et_fixe_le_prochain_depart(self):
        retour = self.today + datetime.timedelta(days=14)
        r = self.confirmer(date_retour=str(retour))
        v = Voyage.objects.get(pk=r.data["retour_voyage_id"])
        self.c.force_authenticate(self.admin)
        self.assertEqual(self.c.post(f"/api/voyages/{v.id}/partir/", {}, format="json").status_code, 200)
        prochain = self.today + datetime.timedelta(days=40)
        r = self.c.post(f"/api/voyages/{v.id}/revenir/", {"prochain_depart": str(prochain)}, format="json")
        self.assertEqual(r.status_code, 200, r.data)
        self.b.refresh_from_db()
        self.assertEqual((self.b.statut, self.b.personnel_id, self.b.date_depart), ("Occupé", self.p.id, prochain))

    def test_arrivee_a_abidjan_ne_touche_pas_a_la_chambre(self):
        r = self.confirmer(date_retour=str(self.today + datetime.timedelta(days=14)))
        self.c.force_authenticate(self.admin)
        r = self.c.post(f"/api/voyages/{r.data['voyage_id']}/revenir/", {}, format="json")
        self.assertEqual(r.status_code, 200, r.data)
        self.b.refresh_from_db()
        self.assertEqual(self.b.statut, "Libre")

    def test_demande_vers_le_camp_ne_libere_pas_la_chambre(self):
        from residences.models import Demande
        from .models import ItineraireModele
        abj_camp = ItineraireModele.objects.get(nom="Abidjan → Camp")
        dd = self.today + datetime.timedelta(days=3)
        d = Demande.objects.create(type_demande="voyage", demandeur=self.u, message_demandeur="retour",
                                   date_debut_souhaitee=dd, date_fin_souhaitee=dd + datetime.timedelta(days=28),
                                   donnees={"itineraire_modele": abj_camp.id})
        self.c.force_authenticate(self.admin)
        self.assertEqual(self.c.post(f"/api/demandes/{d.id}/valider/", {}, format="json").status_code, 200)
        v = Voyage.objects.get(demande_origine=d)
        self.assertEqual((v.destination, v.statut, v.trajet_aller_seul), ("CAMP", "planifie", False))
        self.assertEqual(v.date_retour_prevue, dd + datetime.timedelta(days=28))
        self.b.refresh_from_db()
        self.assertEqual(self.b.statut, "Occupé")  # pas libérée par un trajet VERS le camp

    def test_trajets_qui_se_touchent_ne_sont_pas_en_conflit(self):
        from .views import _check_voyage_conflit
        j = self.today + datetime.timedelta(days=5)
        Voyage.objects.create(personnel=self.p, destination="ABIDJAN", date_depart=self.today, date_retour_prevue=j)
        self.assertIsNone(_check_voyage_conflit(self.p.id, j, j))
        self.assertIsNotNone(_check_voyage_conflit(self.p.id, j - datetime.timedelta(days=1), j))
        self.assertIsNotNone(_check_voyage_conflit(self.p.id, self.today, self.today))
