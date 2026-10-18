import datetime
from django.utils import timezone

from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient

from residences.models import Personnel
from evenements.models import SimpleNotification
from .models import Rotation, Voyage, SuiviConvoi, ArretConvoi, EvenementMonteeDescente, PositionConvoi


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
                personnel=p, rotation_id="ROT-T1", destination="Abidjan", statut_validation="valide",
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

    def test_ramassage_liste_et_montee(self):
        """Le chauffeur voit qui ramasser (arrivé après le départ ou descendu plus tôt) et le fait monter."""
        self.c.force_authenticate(self.chauffeur_user)
        self.c.post(self.url("partir"), {"latitude": 9.1, "longitude": -5.1}, format="json")
        # un passager affecté APRÈS le départ
        tard = Personnel.objects.create(nom="Retard", prenom="R", societe="ROXGOLD")
        today = datetime.date.today()
        v_tard = Voyage.objects.create(personnel=tard, rotation_id="ROT-T1", destination="Abidjan", statut_validation="valide",
                                       date_depart=today, date_retour_prevue=today + datetime.timedelta(days=14), origine="Péage")
        # un passager descend
        self.c.post(self.url("arret"), {"type": "depose", "lieu": "Bouaké", "deposes": [self.voyages[0].id]}, format="json")
        r = self.c.get("/api/suivi-convois/mes_convois/")
        liste = {x["voyage_id"]: x["etat"] for x in r.data[0]["suivi"]["a_ramasser"]}
        self.assertEqual(liste, {v_tard.id: "attendu", self.voyages[0].id: "descendu"})
        self.assertEqual(r.data[0]["suivi"]["nb_a_bord"], 2)

        r = self.c.post(self.url("arret"), {"type": "ramassage", "lieu": "Péage", "ramasses": [v_tard.id, self.voyages[0].id]}, format="json")
        self.assertEqual(r.status_code, 201, r.data)
        self.assertEqual(r.data["suivi"]["nb_a_bord"], 4)
        self.assertEqual(r.data["suivi"]["a_ramasser"], [])
        v_tard.refresh_from_db()
        self.assertEqual(v_tard.statut, "en_voyage")
        self.assertTrue(EvenementMonteeDescente.objects.filter(voyage=v_tard, type_evenement="montee").exists())

    def test_acces_refuse_aux_non_conducteurs(self):
        self.c.force_authenticate(self.autre_user)
        self.assertEqual(self.c.post(self.url("partir"), {}, format="json").status_code, 403)
        self.assertEqual(self.c.get("/api/suivi-convois/actifs/").status_code, 403)
        self.assertEqual(self.c.get("/api/suivi-convois/mes_convois/").data, [])
        self.assertFalse(SuiviConvoi.objects.exists())

    def test_admin_peut_demarrer(self):
        self.c.force_authenticate(self.admin)
        self.assertEqual(self.c.post(self.url("partir"), {}, format="json").status_code, 400)   # GPS obligatoire
        self.assertEqual(self.c.post(self.url("partir"), {"latitude": 9.1, "longitude": -5.1}, format="json").status_code, 201)


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
        d = datetime.date.today() + datetime.timedelta(days=3)
        self.dd = d + datetime.timedelta(days=(2 - d.weekday()) % 7)   # mercredi : départ Camp → Abidjan autorisé

    def demande_validee(self, nom, **donnees):
        u = User.objects.create_user(nom.lower(), password="x")
        Personnel.objects.create(nom=nom, prenom="X", societe="ROXGOLD", user=u)
        d = self.Demande.objects.create(type_demande="voyage", demandeur=u, message_demandeur="rotation",
                                        date_debut_souhaitee=self.dd, date_fin_souhaitee=self.dd + datetime.timedelta(days=13),
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

    def mardi_apres(self, n):
        """Premier mardi (jour de circulation Abidjan → Camp) à n jours ou plus d'aujourd'hui."""
        d = self.today + datetime.timedelta(days=n)
        return d + datetime.timedelta(days=(1 - d.weekday()) % 7)

    def test_retour_un_jour_sans_circulation_refuse_puis_force_par_admin(self):
        mauvais = self.mardi_apres(14) + datetime.timedelta(days=1)   # mercredi
        r = self.confirmer(date_retour=str(mauvais))
        self.assertEqual((r.status_code, r.data.get("code")), (400, "jour_non_autorise"), r.data)
        self.assertIn("mardi, jeudi, samedi", r.data["error"])
        self.c.force_authenticate(self.admin)
        r = self.c.post(f"/api/batiments/{self.b.id}/confirmer_depart/",
                        {"action": "confirme", "itineraire_id": self.camp_abj.id, "destination": "BOUAKE",
                         "date_retour": str(mauvais), "forcer_jour": True}, format="json")
        self.assertEqual(r.status_code, 200, r.data)

    def confirmer(self, **extra):
        self.c.force_authenticate(self.u)
        return self.c.post(f"/api/batiments/{self.b.id}/confirmer_depart/",
                           {"action": "confirme", "itineraire_id": self.camp_abj.id, "destination": "BOUAKE", **extra}, format="json")

    def test_depart_avec_date_de_retour_cree_le_trajet_retour(self):
        retour = self.mardi_apres(14)
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
        retour = self.mardi_apres(14)
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
        r = self.confirmer(date_retour=str(self.mardi_apres(14)))
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
        dd += datetime.timedelta(days=(1 - dd.weekday()) % 7)   # mardi : Abidjan → Camp autorisé
        d = Demande.objects.create(type_demande="voyage", demandeur=self.u, message_demandeur="retour",
                                   date_debut_souhaitee=dd, date_fin_souhaitee=dd + datetime.timedelta(days=27),   # lundi : départ du camp autorisé
                                   donnees={"itineraire_modele": abj_camp.id})
        self.c.force_authenticate(self.admin)
        self.assertEqual(self.c.post(f"/api/demandes/{d.id}/valider/", {}, format="json").status_code, 200)
        v = Voyage.objects.get(demande_origine=d)
        self.assertEqual((v.destination, v.statut, v.trajet_aller_seul), ("CAMP", "planifie", False))
        self.assertEqual(v.date_retour_prevue, dd + datetime.timedelta(days=27))
        self.b.refresh_from_db()
        self.assertEqual(self.b.statut, "Occupé")  # pas libérée par un trajet VERS le camp

    def test_trajets_qui_se_touchent_ne_sont_pas_en_conflit(self):
        from .views import _check_voyage_conflit
        j = self.today + datetime.timedelta(days=5)
        Voyage.objects.create(personnel=self.p, destination="ABIDJAN", date_depart=self.today, date_retour_prevue=j)
        self.assertIsNone(_check_voyage_conflit(self.p.id, j, j))
        self.assertIsNotNone(_check_voyage_conflit(self.p.id, j - datetime.timedelta(days=1), j))
        self.assertIsNotNone(_check_voyage_conflit(self.p.id, self.today, self.today))


class LiaisonConvoiResidenceTests(TestCase):
    """Camp->X libère la chambre à la date du convoi ; X->Camp reloge avec
    Arrivée = date du voyage, Départ = date « Retourne quand ? »."""

    def setUp(self):
        from django.core.cache import cache
        from residences.models import Batiment
        cache.clear()
        self.today = datetime.date.today()
        self.p = Personnel.objects.create(nom="KOUAME", prenom="Edgar", societe="ROXGOLD")
        self.b, _ = Batiment.objects.get_or_create(residence="TEST-LIAISON")
        self.b.statut = "Occupé"; self.b.personnel = self.p; self.b.occupant = "KOUAME Edgar"
        self.b.date_arrivee = self.today - datetime.timedelta(days=10); self.b.save()

    def _voyage(self, **kw):
        base = dict(personnel=self.p, statut="planifie", statut_validation="valide", trajet_aller_seul=True,
                    date_retour_prevue=self.today)
        base.update(kw)
        return Voyage.objects.create(**base)

    def test_depart_libere_chambre(self):
        from .automatisation import appliquer_voyages_du_jour
        from residences.models import ResidentPrincipal, Batiment
        ResidentPrincipal.objects.create(personnel=self.p, batiment=self.b, date_debut=self.today)
        v = self._voyage(origine="Camp Roxgold Sango", destination="Abidjan", date_depart=self.today,
                         date_retour_prevue=self.today + datetime.timedelta(days=14))
        r = appliquer_voyages_du_jour()
        self.assertEqual(r["departs"], 1)
        self.assertEqual(Batiment.objects.get(pk=self.b.pk).statut, "Libre")
        v.refresh_from_db()
        self.assertEqual(v.statut, "en_voyage")
        # idempotent
        self.assertEqual(appliquer_voyages_du_jour()["departs"], 0)

    def test_arrivee_reloge_avec_dates(self):
        from .automatisation import appliquer_voyages_du_jour
        from residences.models import ResidentPrincipal, Batiment
        ResidentPrincipal.objects.create(personnel=self.p, batiment=self.b, date_debut=self.today)
        self.b.statut = "Libre"; self.b.personnel = None; self.b.occupant = None; self.b.save()
        depart = self.today + datetime.timedelta(days=20)
        v = self._voyage(origine="Abidjan", destination="Camp Roxgold Sango", trajet_aller_seul=False,
                         date_depart=self.today, date_retour_prevue=depart)
        r = appliquer_voyages_du_jour()
        self.assertEqual(r["arrivees"], 1)
        b = Batiment.objects.get(pk=self.b.pk)
        self.assertEqual(b.statut, "Occupé")
        self.assertEqual(b.personnel_id, self.p.id)
        self.assertEqual(b.date_arrivee, self.today)
        self.assertEqual(b.date_depart, depart)
        v.refresh_from_db()
        self.assertEqual(v.statut, "retour")

    def test_trajet_futur_ou_non_valide_ignore(self):
        from .automatisation import appliquer_voyages_du_jour
        self._voyage(origine="Camp Roxgold Sango", destination="Abidjan",
                     date_depart=self.today + datetime.timedelta(days=1))
        self._voyage(origine="Camp Roxgold Sango", destination="Abidjan", date_depart=self.today,
                     statut_validation="en_attente")
        r = appliquer_voyages_du_jour()
        self.assertEqual(r["departs"], 0)


class CasEdgarTests(TestCase):
    """Chambre non rattachée au voyage : libérée puis restituée ; X->Camp terminé n'est pas un retour anticipé."""

    def test_cycle_sans_residence_principale(self):
        from residences.models import Batiment
        today = datetime.date.today()
        p = Personnel.objects.create(nom="KOUAME", prenom="Edgar", societe="ROXGOLD")
        b, _ = Batiment.objects.get_or_create(residence="TEST-EDGAR")
        b.statut = "Occupé"; b.personnel = p; b.occupant = "KOUAME Edgar"; b.save()
        aller = Voyage.objects.create(personnel=p, origine="Camp Roxgold Sango", destination="Abidjan", trajet_aller_seul=True,
                                      date_depart=today - datetime.timedelta(days=5), date_retour_prevue=today,
                                      statut="planifie", statut_validation="valide")
        aller.partir(aller.date_depart)
        b.refresh_from_db(); self.assertEqual(b.statut, "Libre")
        retour = Voyage.objects.create(personnel=p, origine="Abidjan", destination="CAMP", trajet_aller_seul=False,
                                       date_depart=today, date_retour_prevue=today + datetime.timedelta(days=14),
                                       statut="en_voyage", statut_validation="valide")
        from .automatisation import appliquer_voyages_du_jour
        self.assertEqual(appliquer_voyages_du_jour()["arrivees"], 1)
        b.refresh_from_db()
        self.assertEqual((b.statut, b.personnel_id, b.date_depart), ("Occupé", p.id, today + datetime.timedelta(days=14)))
        admin = User.objects.create_user("adm", password="x", is_staff=True)
        c = APIClient(); c.force_authenticate(admin)
        self.assertEqual(c.get("/api/voyages/retours_anticipes/").json(), [])


class RetourChambreReserveeTests(TestCase):
    def test_residence_principale_reservee_est_restituee(self):
        from residences.models import Batiment, ResidentPrincipal
        today = datetime.date.today()
        p = Personnel.objects.create(nom="KOUAME", prenom="Edgar", societe="ROXGOLD")
        b, _ = Batiment.objects.get_or_create(residence="TEST-RES")
        b.statut = "Réservé"; b.personnel = None; b.save()
        ResidentPrincipal.objects.create(personnel=p, batiment=b, date_debut=today)
        v = Voyage.objects.create(personnel=p, origine="Abidjan", destination="CAMP", trajet_aller_seul=False,
                                  date_depart=today, date_retour_prevue=today, statut="en_voyage", statut_validation="valide")
        r = v.revenir(today)
        b.refresh_from_db()
        self.assertTrue(r["chambre_restituee"])
        self.assertEqual((b.statut, b.personnel_id), ("Occupé", p.id))


class TermineArriveeLieuDescenteTests(TestCase):
    def test_terminer_hors_camp_ne_reloge_pas_et_pas_de_retour_anticipe(self):
        from residences.models import Batiment
        today = datetime.date.today()
        p = Personnel.objects.create(nom="K", prenom="E", societe="R")
        b, _ = Batiment.objects.get_or_create(residence="TEST-TERM")
        b.statut = "Libre"; b.personnel = None; b.save()
        v = Voyage.objects.create(personnel=p, origine="Camp Roxgold Sango", destination="Abidjan", trajet_aller_seul=False,
                                  batiment=b, date_depart=today - datetime.timedelta(days=1),
                                  date_retour_prevue=today + datetime.timedelta(days=10), statut="en_voyage", statut_validation="valide")
        r = v.revenir(today)
        b.refresh_from_db(); v.refresh_from_db()
        self.assertFalse(r["chambre_restituee"])
        self.assertEqual((b.statut, v.statut, v.date_retour_effective), ("Libre", "retour", None))
        admin = User.objects.create_user("adm2", password="x", is_staff=True)
        c = APIClient(); c.force_authenticate(admin)
        self.assertEqual(c.get("/api/voyages/retours_anticipes/").json(), [])


class ConvoiAllerSeulVersCampTests(TestCase):
    """Les convois sont créés avec trajet_aller_seul=True : l'arrivée au camp doit
    quand même reloger (cas Edgar : Abidjan -> Camp, résidence principale A2)."""

    def setUp(self):
        from residences.models import Batiment, ResidentPrincipal
        self.today = datetime.date.today()
        self.p = Personnel.objects.create(nom="KOUAME", prenom="Edgar", societe="ROXGOLD")
        self.b, _ = Batiment.objects.get_or_create(residence="TEST-A2")
        self.b.statut = "Libre"; self.b.personnel = None; self.b.save()
        ResidentPrincipal.objects.create(personnel=self.p, batiment=self.b, date_debut=self.today)

    def _v(self, statut):
        return Voyage.objects.create(personnel=self.p, origine="ABIDJAN", destination="CAMP", trajet_aller_seul=True,
                                     date_depart=self.today, date_retour_prevue=self.today + datetime.timedelta(days=1),
                                     statut=statut, statut_validation="valide")

    def test_terminer_reloge(self):
        v = self._v("en_voyage")
        self.assertTrue(v.revenir(self.today)["chambre_restituee"])
        self.b.refresh_from_db(); self.assertEqual((self.b.statut, self.b.personnel_id), ("Occupé", self.p.id))

    def test_rattrapage_arrivee_deja_terminee(self):
        self._v("retour")
        from .automatisation import appliquer_voyages_du_jour
        self.assertEqual(appliquer_voyages_du_jour()["arrivees"], 1)
        self.b.refresh_from_db(); self.assertEqual(self.b.personnel_id, self.p.id)
        self.assertEqual(appliquer_voyages_du_jour()["arrivees"], 0)


class JMPModeleTests(TestCase):
    def test_jmp_docx_rempli_depuis_le_modele(self):
        import io, docx
        admin = User.objects.create_user("adminjmp", password="x", is_staff=True)
        c = APIClient(); c.force_authenticate(admin)
        ch = Personnel.objects.create(nom="TRAORE", prenom="YSSOUF", societe="X", telephone="0501020304")
        today = datetime.date.today()
        Rotation.objects.create(rotation_id="JMPT1", origine="Camp Roxgold Sango", destination="Abidjan", vehicule="VIP BUS",
                                vehicule_matricule="AA-1", conducteur="TRAORE YSSOUF", conducteur_personnel=ch,
                                date_depart=today, date_retour_prevue=today)
        p = Personnel.objects.create(nom="KOUAME", prenom="Edgar", societe="ROXGOLD", telephone="0700000000")
        Voyage.objects.create(personnel=p, rotation_id="JMPT1", origine="Camp Roxgold Sango", destination="Abidjan",
                              date_depart=today, date_retour_prevue=today, statut_validation="valide")
        r = c.get("/api/voyages/jmp/?rotation_id=JMPT1&type=docx")
        self.assertEqual(r.status_code, 200)
        d = docx.Document(io.BytesIO(r.content))
        texte = "\n".join(cel.text for t in d.tables for row in t.rows for cel in row.cells)
        self.assertIn("KOUAME EDGAR", texte)
        self.assertIn("TRAORE YSSOUF", texte)
        self.assertIn("CAMP ROXGOLD SANGO", texte)
        self.assertIn("REGLES DE CONDUITE", "\n".join(p.text for p in d.paragraphs))  # texte fixe du modèle conservé
        self.assertEqual(c.get("/api/voyages/jmp/").status_code, 400)
        u = User.objects.create_user("simplejmp", password="x"); c2 = APIClient(); c2.force_authenticate(u)
        self.assertEqual(c2.get("/api/voyages/jmp/?rotation_id=JMPT1").status_code, 403)


class DepartBloqueTantQueDemandesEnAttenteTests(TestCase):
    def test_partir_refuse_si_voyageur_sans_statut(self):
        admin = User.objects.create_user("adminpart", password="x", is_staff=True)
        c = APIClient(); c.force_authenticate(admin)
        today = datetime.date.today()
        Rotation.objects.create(rotation_id="PB1", origine="Camp", destination="Abidjan", date_depart=today, date_retour_prevue=today)
        ok = Personnel.objects.create(nom="OK", prenom="A", societe="R")
        att = Personnel.objects.create(nom="ATT", prenom="B", societe="R")
        ref = Personnel.objects.create(nom="REF", prenom="C", societe="R")
        va = Voyage.objects.create(personnel=ok, rotation_id="PB1", origine="Camp", destination="Abidjan", date_depart=today, date_retour_prevue=today, statut_validation="valide")
        vb = Voyage.objects.create(personnel=att, rotation_id="PB1", origine="Camp", destination="Abidjan", date_depart=today, date_retour_prevue=today)
        vc = Voyage.objects.create(personnel=ref, rotation_id="PB1", origine="Camp", destination="Abidjan", date_depart=today, date_retour_prevue=today, statut_validation="refuse")
        r = c.post("/api/voyages/partir_rotation/", {"rotation_id": "PB1"}, format="json")
        self.assertEqual(r.status_code, 400)
        self.assertIn("ATT", r.json()["error"])
        vb.statut_validation = "refuse"; vb.save()
        r = c.post("/api/voyages/partir_rotation/", {"rotation_id": "PB1"}, format="json")
        self.assertEqual(r.json()["partis"], 1)
        va.refresh_from_db(); vc.refresh_from_db()
        self.assertEqual((va.statut, vc.statut), ("en_voyage", "planifie"))  # le refusé ne part pas


class JoursCirculationEtMaConduiteTests(TestCase):
    """Jours dédiés (Abidjan→Camp mar/jeu/sam, Camp→Abidjan lun/mer/ven) et « Ma conduite » par nom."""

    def test_jours_pour_selon_le_sens(self):
        from .models import ItineraireModele
        self.assertEqual(ItineraireModele.jours_pour("Camp Roxgold Sango", "Abidjan"), [0, 2, 4])
        self.assertEqual(ItineraireModele.jours_pour("Abidjan", "Camp Roxgold Sango"), [1, 3, 5])
        self.assertIsNone(ItineraireModele.jours_pour("Abidjan", "Daloa"))

    def test_ma_conduite_trouve_le_convoi_assigne_par_nom(self):
        from .views import _personnel_par_nom
        u = User.objects.create_user("edgar", password="x")
        p = Personnel.objects.create(nom="Kouamé", prenom="Edgar", societe="ROXGOLD", user=u)
        self.assertEqual(_personnel_par_nom("Kouamé Edgar"), p)
        self.assertEqual(_personnel_par_nom("edgar  kouamé"), p)
        self.assertIsNone(_personnel_par_nom("Inconnu Personne"))
        today = datetime.date.today()
        Rotation.objects.create(rotation_id="ROT-NOM", vehicule="BUS", conducteur="Kouamé Edgar",
                                origine="Abidjan", destination="Camp Roxgold Sango", date_depart=today,
                                date_retour_prevue=today + datetime.timedelta(days=14))
        c = APIClient()
        c.force_authenticate(u)
        r = c.get("/api/suivi-convois/mes_convois/")
        self.assertEqual(r.status_code, 200)
        self.assertEqual([x["rotation_id"] for x in r.json()], ["ROT-NOM"])

    def test_creer_rotation_jour_interdit_puis_force(self):
        admin = User.objects.create_user("adm", password="x", is_staff=True)
        c = APIClient()
        c.force_authenticate(admin)
        d = datetime.date.today() + datetime.timedelta(days=10)
        d += datetime.timedelta(days=(0 - d.weekday()) % 7)   # lundi : pas de départ Abidjan → Camp
        base = {"origine": "Abidjan", "destination": "Camp Roxgold Sango", "date_depart": str(d), "vehicule": "BUS-9"}
        r = c.post("/api/voyages/creer_rotation/", base, format="json")
        self.assertEqual(r.status_code, 400)
        self.assertEqual(r.json().get("code"), "jour_non_autorise")
        r = c.post("/api/voyages/creer_rotation/", {**base, "forcer_jour": True}, format="json")
        self.assertNotEqual(r.json().get("code"), "jour_non_autorise")


class DatesPasseesEtRetourPassagerTests(TestCase):
    """Pas d'antidatage ; date de retour d'un passager = trajet inverse soumis aux jours de circulation."""

    def setUp(self):
        self.admin = User.objects.create_user("adm", password="x", is_staff=True)
        self.c = APIClient()
        self.c.force_authenticate(self.admin)
        self.today = datetime.date.today()

    def prochain(self, weekday, apres=10):
        d = self.today + datetime.timedelta(days=apres)
        return d + datetime.timedelta(days=(weekday - d.weekday()) % 7)

    def test_rotation_dans_le_passe_refusee(self):
        r = self.c.post("/api/voyages/creer_rotation/", {"origine": "Camp Roxgold Sango", "destination": "Abidjan",
                        "date_depart": str(self.today - datetime.timedelta(days=1)), "vehicule": "BUS"}, format="json")
        self.assertEqual(r.status_code, 400)
        self.assertEqual(r.json()["code"], "date_passee")

    def test_demande_dans_le_passe_refusee_meme_admin(self):
        r = self.c.post("/api/demandes/", {"type_demande": "reservation_residence", "message_demandeur": "x",
                        "date_debut_souhaitee": str(self.today - datetime.timedelta(days=2))}, format="json")
        self.assertEqual(r.status_code, 400)
        self.assertEqual(r.json()["code"], "date_passee")

    def test_retour_passager_un_jour_sans_circulation(self):
        p = Personnel.objects.create(nom="Pax", prenom="A", societe="ROXGOLD")
        lundi = self.prochain(0)   # Camp → Abidjan : lundi OK
        Rotation.objects.create(rotation_id="ROT-J", vehicule="BUS", origine="Camp Roxgold Sango", destination="Abidjan",
                                date_depart=lundi, date_retour_prevue=lundi)
        base = {"rotation_id": "ROT-J", "personnel_id": p.id}
        mercredi = lundi + datetime.timedelta(days=9)   # Abidjan → Camp : un mercredi = interdit (mar/jeu/sam)
        r = self.c.post("/api/voyages/rejoindre_rotation/", {**base, "date_retour_prevue": str(mercredi)}, format="json")
        self.assertEqual(r.status_code, 400)
        self.assertEqual(r.json()["code"], "jour_non_autorise")
        r = self.c.post("/api/voyages/rejoindre_rotation/", {**base, "date_retour_prevue": str(mercredi + datetime.timedelta(days=1))}, format="json")
        self.assertEqual(r.status_code, 201, r.content)


class DemandeEdgarJoursDepartTests(TestCase):
    """Cas Edgar : demande Abidjan → Camp, « je repars du camp le » doit tomber un jour Camp → Abidjan (lun/mer/ven)."""

    def setUp(self):
        from .models import ItineraireModele
        self.u = User.objects.create_user("edgar2", password="x")
        Personnel.objects.create(nom="Kouamé", prenom="Edgar", societe="ROXGOLD", user=self.u)
        self.admin = User.objects.create_user("adm2", password="x", is_staff=True)
        self.today = datetime.date.today()
        # Itinéraire créé « à la main » SANS jours : la règle par défaut s'applique quand même.
        self.it = ItineraireModele.objects.create(nom="Abidjan-Camp", origine="ABIDJAN", destination="CAMP", jours_voyage=[])
        ItineraireModele.objects.filter(origine__iexact="CAMP").update(jours_voyage=[])

    def jour(self, weekday, apres=10):
        d = self.today + datetime.timedelta(days=apres)
        return d + datetime.timedelta(days=(weekday - d.weekday()) % 7)

    def poster(self, debut, fin, client=None):
        c = client or APIClient()
        c.force_authenticate(self.u)
        return c.post("/api/demandes/", {"type_demande": "voyage", "message_demandeur": "x",
                      "date_debut_souhaitee": str(debut), "date_fin_souhaitee": str(fin),
                      "donnees": {"itineraire_modele": self.it.id}}, format="json")   # ni origine ni destination dans donnees

    def test_depart_du_camp_un_samedi_refuse(self):
        mardi = self.jour(1)
        samedi = mardi + datetime.timedelta(days=11)
        r = self.poster(mardi, samedi)
        self.assertEqual(r.status_code, 400, r.content)
        self.assertEqual(r.json()["code"], "jour_non_autorise")

    def test_depart_du_camp_un_vendredi_accepte(self):
        mardi = self.jour(1)
        self.assertEqual(self.poster(mardi, mardi + datetime.timedelta(days=10)).status_code, 201)

    def test_validation_reverifie_les_jours(self):
        from residences.models import Demande
        mardi = self.jour(1)
        d = Demande.objects.create(type_demande="voyage", demandeur=self.u, message_demandeur="x",
                                   date_debut_souhaitee=mardi, date_fin_souhaitee=mardi + datetime.timedelta(days=11),
                                   donnees={"itineraire_modele": self.it.id})
        c = APIClient(); c.force_authenticate(self.admin)
        r = c.post(f"/api/demandes/{d.id}/valider/", {}, format="json")
        self.assertEqual((r.status_code, r.json()["code"]), (400, "jour_non_autorise"))
        d.refresh_from_db(); self.assertEqual(d.statut, "en_attente")
        self.assertEqual(c.post(f"/api/demandes/{d.id}/valider/", {"forcer_jour": True}, format="json").status_code, 200)


class OrganiserSensEtDateTests(TestCase):
    def setUp(self):
        from .models import ItineraireModele, VehiculeFlotte
        self.admin = User.objects.create_user("adm3", password="x", is_staff=True)
        self.c = APIClient(); self.c.force_authenticate(self.admin)
        VehiculeFlotte.objects.create(nom="Bus", categorie="bus", matricule="B1", capacite=20)
        self.chauffeur = Personnel.objects.create(nom="Dri", prenom="V", societe="ROXGOLD")
        self.aller = ItineraireModele.objects.get(nom="Camp → Abidjan")
        self.retour = ItineraireModele.objects.get(nom="Abidjan → Camp")
        d = datetime.date.today() + datetime.timedelta(days=5)
        self.lundi = d + datetime.timedelta(days=(0 - d.weekday()) % 7)

    def voyage(self, nom, date):
        p = Personnel.objects.create(nom=nom, prenom="X", societe="ROXGOLD")
        return Voyage.objects.create(personnel=p, origine="Camp Roxgold Sango", destination="Abidjan", date_depart=date,
                                     date_retour_prevue=date + datetime.timedelta(days=1), statut_validation="valide")

    def organiser(self, v_ids, it):
        return self.c.post("/api/voyages/organiser_demandes_en_rotation/", {"voyage_ids": v_ids, "vehicule_matricule": "B1",
                           "vehicule": "Bus", "conducteur_id": self.chauffeur.id, "itineraire_modele_id": it.id}, format="json")

    def test_itineraire_de_sens_contraire_refuse(self):
        v = self.voyage("A", self.lundi)
        r = self.organiser([v.id], self.retour)
        self.assertEqual((r.status_code, r.json()["code"]), (400, "sens_incompatible"))

    def test_dates_differentes_refusees(self):
        a, b = self.voyage("A", self.lundi), self.voyage("B", self.lundi + datetime.timedelta(days=2))
        r = self.organiser([a.id, b.id], self.aller)
        self.assertEqual((r.status_code, r.json()["code"]), (400, "dates_differentes"))

    def test_meme_sens_meme_jour_ok(self):
        a, b = self.voyage("A", self.lundi), self.voyage("B", self.lundi)
        self.assertEqual(self.organiser([a.id, b.id], self.aller).status_code, 201)


class AutomatisationHorsRequeteTests(TestCase):
    def test_pas_de_traitement_dans_la_requete_si_le_planificateur_tourne(self):
        from django.core.cache import cache
        from unittest import mock
        from . import automatisation
        cache.clear()
        with mock.patch.object(automatisation, "appliquer_voyages_du_jour", return_value={}) as m:
            cache.set("planificateur_tick", 1, 55)
            self.assertIsNone(automatisation.appliquer_si_necessaire())
            m.assert_not_called()
            cache.delete("planificateur_tick")
            automatisation.appliquer_si_necessaire()
            m.assert_called_once()


class SuiviGpsRapportTests(TestCase):
    """Ma conduite : GPS obligatoire, positions idempotentes, clôture serveur, historique, exports, permissions."""

    def setUp(self):
        self.admin = User.objects.create_user("adm4", password="x", is_staff=True)
        self.u = User.objects.create_user("chauf4", password="x")
        self.autre = User.objects.create_user("autre4", password="x")
        p = Personnel.objects.create(nom="Dri", prenom="Awa", societe="ROXGOLD", user=self.u)
        pa = Personnel.objects.create(nom="Autre", prenom="Chauf", societe="ROXGOLD", user=self.autre)
        today = datetime.date.today()
        mk = lambda rid, pers, nom: Rotation.objects.create(rotation_id=rid, vehicule="BUS", vehicule_matricule="9999ZZ", conducteur=nom,
            conducteur_personnel=pers, origine="Camp", destination="Abidjan", date_depart=today, date_retour_prevue=today)
        mk("R-A", p, "Awa Dri"); mk("R-B", pa, "Chauf Autre")
        self.c = APIClient()
        self.c.force_authenticate(self.u)

    def url(self, rid, a=""):
        return f"/api/suivi-convois/{rid}/{a + '/' if a else ''}"

    def demarrer(self, rid="R-A"):
        r = self.c.post(self.url(rid, "partir"), {"latitude": 9.10, "longitude": -5.10, "precision": 12}, format="json")
        self.assertEqual(r.status_code, 201, r.content)
        # départ simulé 10 min plus tôt pour pouvoir rejouer des points « passés »
        il_y_a = timezone.now() - datetime.timedelta(minutes=10)
        SuiviConvoi.objects.filter(rotation__rotation_id=rid).update(depart_at=il_y_a, position_at=il_y_a)
        PositionConvoi.objects.filter(suivi__rotation__rotation_id=rid).update(date_heure=il_y_a)

    def test_partir_sans_gps_ou_coordonnees_invalides_refuse(self):
        for body in ({}, {"latitude": 95, "longitude": 0}, {"latitude": 0, "longitude": 0}, {"latitude": "x", "longitude": 1}):
            r = self.c.post(self.url("R-A", "partir"), body, format="json")
            self.assertEqual((r.status_code, r.json().get("code")), (400, "gps_requis"), body)
        self.assertFalse(SuiviConvoi.objects.exists())

    def test_un_seul_trajet_actif_par_chauffeur_et_par_mission(self):
        self.demarrer()
        self.assertEqual(self.c.post(self.url("R-A", "partir"), {"latitude": 9.1, "longitude": -5.1}, format="json").status_code, 400)
        Rotation.objects.filter(rotation_id="R-B").update(conducteur_personnel=Personnel.objects.get(user=self.u), conducteur="Awa Dri")
        r = self.c.post(self.url("R-B", "partir"), {"latitude": 9.1, "longitude": -5.1}, format="json")
        self.assertEqual(r.json().get("code"), "trajet_en_cours")

    def test_positions_idempotentes_et_lot_apres_perte_reseau(self):
        self.demarrer()
        t0 = timezone.now()
        lot = [{"latitude": 9.0 + i * 0.01, "longitude": -5.1, "precision": 8, "client_id": f"p{i}",
                "horodatage": (t0 - datetime.timedelta(seconds=30 - i * 10)).isoformat()} for i in range(3)]
        r = self.c.post(self.url("R-A", "position"), {"points": lot}, format="json")
        self.assertEqual((r.json()["enregistres"], r.json()["doublons"]), (3, 0), r.content)
        r = self.c.post(self.url("R-A", "position"), {"points": lot}, format="json")   # renvoi identique
        self.assertEqual((r.json()["enregistres"], r.json()["doublons"]), (0, 3))
        self.assertEqual(PositionConvoi.objects.count(), 4)   # départ + 3
        # un point ancien renvoyé en différé n'écrase pas la position courante
        s = SuiviConvoi.objects.get()
        self.assertAlmostEqual(s.latitude, 9.02)
        # futur ramené à maintenant, avant départ rejeté, coordonnées invalides rejetées
        r = self.c.post(self.url("R-A", "position"), {"points": [
            {"latitude": 8.5, "longitude": -5, "client_id": "f", "horodatage": (t0 + datetime.timedelta(days=3)).isoformat()},
            {"latitude": 8.4, "longitude": -5, "client_id": "v", "horodatage": (t0 - datetime.timedelta(days=3)).isoformat()},
            {"latitude": 200, "longitude": -5, "client_id": "x"}]}, format="json")
        self.assertEqual((r.json()["enregistres"], r.json()["rejetes"]), (1, 2))
        self.assertLessEqual(PositionConvoi.objects.get(client_id="f").date_heure, timezone.now())
        self.assertEqual(self.c.post(self.url("R-A", "position"), {"latitude": 999, "longitude": 0}, format="json").status_code, 400)

    def test_cloture_serveur_idempotente_duree_distance(self):
        self.demarrer()
        t0 = timezone.now()
        self.c.post(self.url("R-A", "position"), {"points": [
            {"latitude": 9.05, "longitude": -5.10, "client_id": "a", "horodatage": (t0 - datetime.timedelta(minutes=5)).isoformat()},
            {"latitude": 9.00, "longitude": -5.10, "client_id": "b", "horodatage": (t0 - datetime.timedelta(minutes=2)).isoformat()}]}, format="json")
        r = self.c.post(self.url("R-A", "arriver"), {"latitude": 8.99, "longitude": -5.10, "duree_s": 99999, "distance_km": 5}, format="json")   # valeurs client ignorées
        self.assertEqual(r.status_code, 200, r.content)
        s = SuiviConvoi.objects.get()
        self.assertEqual(s.statut, "arrive")
        self.assertEqual(s.cloture_par, self.u)
        self.assertAlmostEqual(s.duree_s, 600, delta=10)   # 10 min simulées ; le 99999 du client est ignoré
        self.assertAlmostEqual(s.distance_km, 12.2, delta=0.5)   # 0,11° de latitude ≈ 12,2 km
        n = SimpleNotification.objects.filter(user=self.admin).count()
        r = self.c.post(self.url("R-A", "arriver"), {}, format="json")   # clôture répétée
        self.assertTrue(r.json().get("deja_cloture"))
        self.assertEqual(SimpleNotification.objects.filter(user=self.admin).count(), n)
        self.assertEqual(self.c.post(self.url("R-A", "reprendre"), {}, format="json").status_code, 400)

    def test_historique_filtres_et_permissions(self):
        self.demarrer()
        self.c.post(self.url("R-A", "arriver"), {"latitude": 9.0, "longitude": -5.1}, format="json")
        ca = APIClient(); ca.force_authenticate(self.autre)
        ca.post(self.url("R-B", "partir"), {"latitude": 9.1, "longitude": -5.1}, format="json")
        mes = self.c.get("/api/suivi-convois/historique/").json()
        self.assertEqual([x["rotation_id"] for x in mes], ["R-A"])               # le chauffeur ne voit QUE le sien
        adm = APIClient(); adm.force_authenticate(self.admin)
        self.assertEqual({x["rotation_id"] for x in adm.get("/api/suivi-convois/historique/").json()}, {"R-A", "R-B"})
        self.assertEqual([x["rotation_id"] for x in adm.get("/api/suivi-convois/historique/?statut=arrive").json()], ["R-A"])
        self.assertEqual([x["rotation_id"] for x in adm.get("/api/suivi-convois/historique/?chauffeur=autre").json()], ["R-B"])
        self.assertEqual(adm.get("/api/suivi-convois/historique/?vehicule=ABSENT").json(), [])
        # l'autre chauffeur ne peut ni lire ni exporter le trajet de R-A
        for a in ("rapport", "export_csv", "export_pdf"):
            self.assertEqual(ca.get(self.url("R-A", a)).status_code, 403, a)
            self.assertEqual(self.c.get(self.url("R-B", a)).status_code, 403, a)
        self.assertEqual(APIClient().get("/api/suivi-convois/historique/").status_code, 401)

    def test_exports_csv_pdf_donnees_reelles_et_provisoire(self):
        self.demarrer()
        self.c.post(self.url("R-A", "arret"), {"type": "pause", "lieu": "Péage", "latitude": 9.0, "longitude": -5.1}, format="json")
        r = self.c.get(self.url("R-A", "rapport")).json()
        self.assertTrue(r["provisoire"])
        self.assertEqual(r["completude"] in ("complete", "partielle"), True)
        csv_ = self.c.get(self.url("R-A", "export_csv"))
        self.assertEqual(csv_.status_code, 200)
        txt = csv_.content.decode("utf-8-sig")
        self.assertIn("position;", txt); self.assertIn("Péage", txt); self.assertIn(";oui", txt)   # provisoire
        pdf = self.c.get(self.url("R-A", "export_pdf"))
        self.assertEqual((pdf.status_code, pdf["Content-Type"]), (200, "application/pdf"))
        self.assertTrue(pdf.content.startswith(b"%PDF"))
        self.c.post(self.url("R-A", "arriver"), {"latitude": 8.9, "longitude": -5.1}, format="json")
        r = self.c.get(self.url("R-A", "rapport")).json()
        self.assertFalse(r["provisoire"])
        self.assertEqual([e["type"] for e in r["chronologie"]][0], "depart")
        self.assertEqual(r["chronologie"][-1]["type"], "arrivee")
        self.assertIn(";non", self.c.get(self.url("R-A", "export_csv")).content.decode("utf-8-sig"))

    def test_persistance_apres_redemarrage_donnees_en_base(self):
        self.demarrer()
        self.c.post(self.url("R-A", "position"), {"latitude": 9.0, "longitude": -5.1, "client_id": "z"}, format="json")
        self.c = APIClient(); self.c.force_authenticate(self.u)   # « nouvelle session »
        self.assertEqual(self.c.get(self.url("R-A", "rapport")).json()["nb_positions"], 2)

    def test_position_ancienne_signalee_par_le_serveur(self):
        self.demarrer()
        SuiviConvoi.objects.update(position_at=timezone.now() - datetime.timedelta(minutes=10))
        s = self.c.get(self.url("R-A")).json()["suivi"]
        self.assertTrue(s["position_ancienne"])
        self.assertGreaterEqual(s["position_age_s"], 600)


class ModifierRotationEtStatutTests(TestCase):
    """Changer chauffeur/véhicule d'un convoi (même en route) + statut rotation issu de Ma conduite."""

    def setUp(self):
        self.admin = User.objects.create_user("adm5", password="x", is_staff=True)
        self.simple = User.objects.create_user("simple5", password="x")
        self.uc = User.objects.create_user("chauf5", password="x")
        self.p1 = Personnel.objects.create(nom="Un", prenom="Chauf", societe="ROXGOLD", user=self.uc)
        self.p2 = Personnel.objects.create(nom="Deux", prenom="Chauf", societe="ROXGOLD")
        self.p3 = Personnel.objects.create(nom="Trois", prenom="Chauf", societe="ROXGOLD")
        d = datetime.date.today()
        Rotation.objects.create(rotation_id="R-M", vehicule="BUS", vehicule_matricule="1111AA", nb_places_total=10, conducteur="Un Chauf",
                                conducteur_personnel=self.p1, origine="Camp", destination="Abidjan", date_depart=d, date_retour_prevue=d)
        Rotation.objects.create(rotation_id="R-N", vehicule="CAR", vehicule_matricule="2222BB", nb_places_total=10, conducteur="Trois Chauf",
                                conducteur_personnel=self.p3, origine="Camp", destination="Abidjan", date_depart=d, date_retour_prevue=d)
        self.c = APIClient(); self.c.force_authenticate(self.admin)

    def post(self, body):
        return self.c.post("/api/voyages/modifier_rotation/", {"rotation_id": "R-M", **body}, format="json")

    def test_changer_chauffeur_et_vehicule(self):
        r = self.post({"conducteur_id": self.p2.id, "vehicule_matricule": "3333CC", "vehicule": "PICKUP", "motif": "panne"})
        self.assertEqual(r.status_code, 200, r.content)
        rot = Rotation.objects.get(rotation_id="R-M")
        self.assertEqual((rot.conducteur_personnel_id, rot.vehicule_matricule), (self.p2.id, "3333CC"))

    def test_permissions_et_conflits(self):
        c = APIClient(); c.force_authenticate(self.simple)
        self.assertEqual(c.post("/api/voyages/modifier_rotation/", {"rotation_id": "R-M"}, format="json").status_code, 403)
        self.assertEqual(self.post({"vehicule_matricule": "2222BB"}).status_code, 400)  # véhicule pris par R-N
        self.assertEqual(self.post({"conducteur_id": self.p3.id}).status_code, 400)      # chauffeur pris par R-N

    def test_convoi_en_route_modifiable_et_arrive_refuse(self):
        suivi = SuiviConvoi.objects.create(rotation=Rotation.objects.get(rotation_id="R-M"), statut="en_route", chauffeur=self.uc,
                                           depart_at=timezone.now()) if "chauffeur" in [f.name for f in SuiviConvoi._meta.fields] else \
            SuiviConvoi.objects.create(rotation=Rotation.objects.get(rotation_id="R-M"), statut="en_route", depart_at=timezone.now())
        self.assertEqual(self.post({"conducteur_id": self.p2.id}).status_code, 200)
        SuiviConvoi.objects.filter(pk=suivi.pk).update(statut="arrive")
        self.assertEqual(self.post({"conducteur_id": self.p2.id}).status_code, 400)

    def test_partir_rotation_refuse_si_deja_parti_par_chauffeur(self):
        SuiviConvoi.objects.create(rotation=Rotation.objects.get(rotation_id="R-M"), statut="en_route", depart_at=timezone.now())
        r = self.c.post("/api/voyages/partir_rotation/", {"rotation_id": "R-M"}, format="json")
        self.assertEqual(r.status_code, 400)
        self.assertIn("déjà parti", r.json()["error"])


    def test_rotation_sans_passager_passe_en_voyage_quand_le_chauffeur_part(self):
        def statut():
            resp = self.c.get("/api/voyages/rotations/")
            d = resp.json()
            return [x for x in d["rotations"] if x["rotation_id"] == "R-M"][0]
        self.assertEqual(statut()["statut"], "planifie")
        s = SuiviConvoi.objects.create(rotation=Rotation.objects.get(rotation_id="R-M"), statut="en_route", depart_at=timezone.now())
        r = statut()
        self.assertEqual((r["statut"], r["suivi_statut"]), ("en_voyage", "en_route"))
        SuiviConvoi.objects.filter(pk=s.pk).update(statut="arrive", arrivee_at=timezone.now())
        self.assertEqual(statut()["statut"], "retour")


class ChambresDoublesTests(TestCase):
    """Chambres partagées : alternance (1 place / 2 résidents) et rotation (2 places B104-A/B / 3 résidents)."""

    def setUp(self):
        from residences.models import Batiment
        self.today = datetime.date.today()
        self.admin = User.objects.create_user("admd", password="x", is_staff=True)
        self.c = APIClient(); self.c.force_authenticate(self.admin)
        self.P = [Personnel.objects.create(nom=f"N{i}", prenom="P", societe="ROXGOLD") for i in range(4)]
        self.Batiment = Batiment

    def declarer(self, p, b):
        return self.c.post("/api/residents-principaux/declarer/", {"personnel": p.id, "batiment": b.id}, format="json")

    def loger(self, p, b):
        self.Batiment.objects.filter(pk=b.pk).update(statut="Occupé", personnel=p, occupant=f"{p.nom} {p.prenom}")

    def voyage(self, p, statut="en_voyage"):
        return Voyage.objects.create(personnel=p, origine="Abidjan", destination="CAMP", trajet_aller_seul=False, date_depart=self.today,
                                     date_retour_prevue=self.today, statut=statut, statut_validation="valide")

    def test_alternance_un_lit_deux_residents(self):
        b = self.Batiment.objects.create(residence="B104", bloc="B", statut="Libre", residents_principaux_max=2)
        a, c2, c3 = self.P[0], self.P[1], self.P[2]
        self.assertEqual(self.declarer(a, b).status_code, 201)
        self.assertEqual(self.declarer(c2, b).status_code, 201)
        r = self.declarer(c3, b)
        self.assertEqual(r.status_code, 409); self.assertIn("complète", r.json()["error"])
        # A est sur le camp ; B revient : la chambre est prise -> conflit signalé, pas d'écrasement
        self.loger(a, b)
        res = self.voyage(c2).revenir(self.today)
        b.refresh_from_db()
        self.assertEqual((res["chambre_restituee"], b.personnel_id), (False, a.id))
        self.assertIn("N0", res["chambre_occupee_par"])
        # A part (libère), B revient : OK
        va = self.voyage(a, "planifie"); va.partir(self.today)
        b.refresh_from_db(); self.assertEqual(b.statut, "Libre")
        self.assertTrue(self.voyage(c2).revenir(self.today)["chambre_restituee"])
        b.refresh_from_db(); self.assertEqual(b.personnel_id, c2.id)

    def test_rotation_trois_residents_deux_places(self):
        a = self.Batiment.objects.create(residence="B104-A", bloc="B", statut="Libre", groupe_chambre="B104", residents_principaux_max=3)
        b = self.Batiment.objects.create(residence="B104-B", bloc="B", statut="Libre", groupe_chambre="B104", residents_principaux_max=3)
        p1, p2, p3, p4 = self.P
        self.assertEqual(self.declarer(p1, a).status_code, 201)
        self.assertEqual(self.declarer(p2, b).status_code, 201)
        self.assertEqual(self.declarer(p3, a).status_code, 201)   # le 3e : sur le groupe, quelle que soit la place
        self.assertEqual(self.declarer(p4, b).status_code, 409)    # le 4e : groupe complet
        self.loger(p1, a); self.loger(p2, b)
        # p3 revient alors que les 2 places sont prises : conflit
        res = self.voyage(p3).revenir(self.today)
        self.assertFalse(res["chambre_restituee"])
        # p1 part -> la place A se libère ; p3 revient et prend A (ou la première place libre du groupe)
        self.voyage(p1, "planifie").partir(self.today)
        a.refresh_from_db(); self.assertEqual(a.statut, "Libre")
        res = self.voyage(p3).revenir(self.today)
        a.refresh_from_db()
        self.assertEqual((res["chambre_restituee"], a.personnel_id), (True, p3.id))
        # p2 (en B) part : libère SA place B, pas A
        self.voyage(p2, "planifie").partir(self.today)
        a.refresh_from_db(); b.refresh_from_db()
        self.assertEqual((a.personnel_id, b.personnel_id), (p3.id, None))

    def test_invite_refuse_si_residents_ont_besoin_des_places_et_chambre_ordinaire_inchangee(self):
        from residences.views import conflit_residence_principale
        a = self.Batiment.objects.create(residence="C20-A", bloc="C", statut="Libre", groupe_chambre="C20", residents_principaux_max=2)
        b = self.Batiment.objects.create(residence="C20-B", bloc="C", statut="Libre", groupe_chambre="C20", residents_principaux_max=2)
        self.declarer(self.P[0], a); self.declarer(self.P[1], b)
        self.loger(self.P[0], a); self.loger(self.P[1], b)
        invite = self.P[3]
        self.assertIsNotNone(conflit_residence_principale(self.Batiment.objects.get(pk=a.pk), invite, None, None))
        simple = self.Batiment.objects.create(residence="D1", bloc="D", statut="Libre")
        self.assertIsNone(conflit_residence_principale(simple, invite, None, None))
        self.assertEqual(self.declarer(self.P[0], simple).status_code, 409)  # déjà résident de C20-A


class ReplanifierRotationsTests(TestCase):
    """Centre de mobilité → Rotations : changer la date / l'itinéraire d'un ou plusieurs convois."""

    def setUp(self):
        from .models import ItineraireModele, EtapeItineraireModele
        self.admin = User.objects.create_user("adm-rp", password="x", is_staff=True)
        self.up = User.objects.create_user("pass-rp", password="x")
        self.pers = Personnel.objects.create(nom="Kone", prenom="Awa", societe="ROXGOLD", user=self.up)
        self.d = datetime.date.today() + datetime.timedelta(days=3)
        for rid in ("RP-1", "RP-2"):
            Rotation.objects.create(rotation_id=rid, vehicule="BUS", origine="Camp", destination="Abidjan",
                                    date_depart=self.d, date_retour_prevue=self.d + datetime.timedelta(days=14))
        self.v = Voyage.objects.create(personnel=self.pers, rotation_id="RP-1", origine="Camp", destination="Abidjan",
                                       date_depart=self.d, date_retour_prevue=self.d + datetime.timedelta(days=14), statut="planifie")
        self.it = ItineraireModele.objects.create(nom="Camp → Bouaké", origine="Camp", destination="Bouaké")
        EtapeItineraireModele.objects.create(itineraire=self.it, ordre=1, ville="Yamoussoukro")
        EtapeItineraireModele.objects.create(itineraire=self.it, ordre=2, ville="Bouaké")
        self.c = APIClient(); self.c.force_authenticate(self.admin)

    def post(self, body):
        return self.c.post("/api/voyages/replanifier_rotations/", body, format="json")

    def test_changer_date_en_masse_decale_les_passagers_et_notifie(self):
        from evenements.models import SimpleNotification
        nd = self.d + datetime.timedelta(days=2)
        r = self.post({"rotation_ids": ["RP-1", "RP-2"], "date_depart": nd.isoformat(), "motif": "pluie"})
        self.assertEqual(r.status_code, 200, r.content)
        self.assertEqual(len(r.json()["ok"]), 2)
        self.v.refresh_from_db()
        self.assertEqual(self.v.date_depart, nd)
        self.assertEqual(self.v.date_retour_prevue, nd + datetime.timedelta(days=14))
        self.assertEqual(Rotation.objects.get(rotation_id="RP-2").date_depart, nd)
        self.assertTrue(SimpleNotification.objects.filter(user=self.up, titre__contains="RP-1").exists())

    def test_changer_itineraire(self):
        from .models import EtapeVoyage
        r = self.post({"rotation_ids": ["RP-1"], "itineraire_id": self.it.id})
        self.assertEqual(r.status_code, 200, r.content)
        rot = Rotation.objects.get(rotation_id="RP-1")
        self.assertEqual((rot.destination, rot.itineraire_modele_id), ("Bouaké", self.it.id))
        self.v.refresh_from_db()
        self.assertEqual(self.v.destination, "Bouaké")  # Abidjan n'est plus sur le trajet
        self.assertEqual(list(EtapeVoyage.objects.filter(voyage=self.v, sens="aller").order_by("ordre").values_list("destination", flat=True)),
                         ["Yamoussoukro", "Bouaké"])

    def test_refus(self):
        c = APIClient(); c.force_authenticate(self.up)
        self.assertEqual(c.post("/api/voyages/replanifier_rotations/", {"rotation_ids": ["RP-1"], "date_depart": "2099-01-01"}, format="json").status_code, 403)
        self.assertEqual(self.post({"rotation_ids": ["RP-1"]}).status_code, 400)
        self.assertEqual(self.post({"rotation_ids": ["RP-1"], "date_depart": "2000-01-01"}).status_code, 400)
        SuiviConvoi.objects.create(rotation=Rotation.objects.get(rotation_id="RP-1"), statut="en_route", depart_at=timezone.now())
        r = self.post({"rotation_ids": ["RP-1", "RP-2"], "date_depart": (self.d + datetime.timedelta(days=1)).isoformat()})
        self.assertEqual(r.status_code, 200)
        self.assertEqual([e["rotation_id"] for e in r.json()["echecs"]], ["RP-1"])


class TypesVehiculeTests(TestCase):
    """Types de véhicule créables (bus, ambulance...) et utilisables par la flotte."""

    def setUp(self):
        from rest_framework.test import APIClient
        from django.contrib.auth.models import User
        self.c = APIClient()
        self.admin = User.objects.create_superuser("tvadmin", "t@t.com", "pass")
        self.agent = User.objects.create_user("tvagent", password="x")

    def test_types_de_depart_presents(self):
        self.c.force_authenticate(self.agent)
        codes = {t["code"] for t in self.c.get("/api/types-vehicule/").data}
        self.assertTrue({"4x4", "pickup", "minibus", "bus"} <= codes)

    def test_admin_cree_un_type_et_un_vehicule(self):
        self.c.force_authenticate(self.admin)
        r = self.c.post("/api/types-vehicule/", {"code": "ambulance", "label": "Ambulance", "icone": "🚑"}, format="json")
        self.assertEqual(r.status_code, 201, r.data)
        r = self.c.post("/api/vehicules-flotte/", {"nom": "Amb 1", "categorie": "ambulance", "capacite": 2}, format="json")
        self.assertEqual(r.status_code, 201, r.data)
        self.assertIn("Ambulance", r.data["categorie_label"])

    def test_vehicule_type_inconnu_refuse(self):
        self.c.force_authenticate(self.admin)
        r = self.c.post("/api/vehicules-flotte/", {"nom": "X", "categorie": "inexistant", "capacite": 2}, format="json")
        self.assertEqual(r.status_code, 400)

    def test_agent_ne_peut_pas_creer(self):
        self.c.force_authenticate(self.agent)
        self.assertEqual(self.c.post("/api/types-vehicule/", {"code": "x", "label": "X"}, format="json").status_code, 403)

    def test_suppression_refusee_si_utilise(self):
        self.c.force_authenticate(self.admin)
        self.c.post("/api/vehicules-flotte/", {"nom": "B1", "categorie": "bus", "capacite": 50}, format="json")
        from .models import TypeVehicule
        t = TypeVehicule.objects.get(code="bus")
        self.assertEqual(self.c.delete(f"/api/types-vehicule/{t.id}/").status_code, 400)
