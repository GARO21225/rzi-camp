# Données de DÉMONSTRATION fictives pour une base locale vierge (DEBUG=True, SQLite). Ne jamais lancer sur la production.
# Prérequis : T05_signaler_incident/seed_demo.py (Aya DEMO) et T03_demander_voyage/seed_demo_t03.py (demo.admin).
# Rejoue la VRAIE chaîne par l'API de l'application (APIClient) :
#   1. Aya demande Camp -> Yamoussoukro pour aujourd'hui ; demo.admin valide (convoi de l'itinéraire créé) ;
#   2. un chauffeur fictif (demo.chauffeur) est affecté au convoi et clique « Partir » depuis le camp ;
#   3. le téléphone du chauffeur envoie ses positions GPS (lot de points horodatés) jusqu'entre Mankono et Bouaké.
# Les positions sont fictives (tracé interpolé entre les villes connues de l'application), pas un vrai trajet.
import datetime, math, os
from django.conf import settings
if not settings.DEBUG or os.environ.get('DATABASE_URL') or settings.DATABASES['default']['ENGINE'] != 'django.db.backends.sqlite3':
    raise SystemExit('Refusé : ce script ne tourne que sur une base SQLite locale avec DEBUG=True.')
from django.utils import timezone
from django.contrib.auth.models import User
from rest_framework.test import APIClient
from accounts.models import Profile
from residences.models import Personnel, Demande, Batiment, OccupationHistory, ResidentPrincipal
from voyages.models import Voyage, Rotation, SuiviConvoi, PositionConvoi, ItineraireModele
from evenements.models import SimpleNotification

u = User.objects.get(username="demo.resident"); p = Personnel.objects.filter(user=u).first()
admin = User.objects.get(username="demo.admin")
SuiviConvoi.objects.all().delete(); Voyage.objects.filter(personnel=p).delete(); Demande.objects.filter(demandeur=u).delete()
SimpleNotification.objects.filter(user=u).delete()
b = Batiment.objects.get(residence="DEMO-A02")
b.personnel = p; b.statut = "Occupé"; b.occupant = "DEMO Aya"; b.societe = "DEMO SARL"; b.date_arrivee = datetime.date(2026, 11, 1); b.date_depart = None; b.save()
OccupationHistory.objects.filter(batiment=b, personnel=p).delete(); ResidentPrincipal.objects.filter(personnel=p).delete()
ResidentPrincipal.objects.create(personnel=p, batiment=b, date_debut=datetime.date(2026, 11, 1))

ch, _ = User.objects.get_or_create(username="demo.chauffeur", defaults={"first_name": "Chauffeur", "last_name": "DEMO"})
ch.set_password("DemoSiteLife2026!"); ch.save()
pc, _ = Profile.objects.get_or_create(user=ch); pc.role = "agent"; pc.save()
pch = Personnel.objects.filter(user=ch).first() or Personnel.objects.create(nom="DEMO", prenom="Chauffeur", societe="DEMO TRANSPORT", user=ch)

today = datetime.date.today()
itin = ItineraireModele.objects.get(nom="Camp → Abidjan")
d = Demande.objects.create(type_demande="voyage", demandeur=u, statut="en_attente", message_demandeur="Repos — démonstration",
                           date_debut_souhaitee=today, date_fin_souhaitee=today + datetime.timedelta(days=10),
                           donnees={"itineraire_modele": itin.id, "origine": "CAMP", "destination": "YAMOUSSOUKRO", "motif": "repos"})
ca = APIClient(); ca.force_authenticate(admin)
r = ca.post(f"/api/demandes/{d.id}/valider/", {"forcer_jour": True, "commentaire": "Validée — bon voyage."}, format="json")
assert r.status_code == 200, r.data
v = Voyage.objects.get(demande_origine=d, destination__icontains="YAMOUSSOUKRO")
rot = Rotation.objects.get(rotation_id=v.rotation_id)
# Véhicule et chauffeur affectés comme depuis le Centre de Mobilité (action « modifier_rotation » de l'API)
from voyages.models import VehiculeFlotte
VehiculeFlotte.objects.get_or_create(matricule="DEMO-001", defaults={"nom": "Bus DÉMO", "categorie": "bus", "capacite": 30})
r = ca.post("/api/voyages/modifier_rotation/", {"rotation_id": rot.rotation_id, "vehicule_matricule": "DEMO-001", "vehicule": "Bus DÉMO",
            "conducteur_id": pch.id, "motif": "Affectation (démo)"}, format="json")
assert r.status_code == 200, r.data
rot.refresh_from_db()

CAMP, SEG, MAN, BKE = (8.05, -6.75), (7.9611, -6.6731), (8.0583, -6.1889), (7.6906, -5.0300)
cc = APIClient(); cc.force_authenticate(ch)
r = cc.post(f"/api/suivi-convois/{rot.rotation_id}/partir/", {"latitude": CAMP[0], "longitude": CAMP[1], "precision": 8}, format="json")
assert r.status_code == 201, r.data
s = SuiviConvoi.objects.get(rotation=rot)
duree = datetime.timedelta(hours=2, minutes=40)
debut = timezone.now() - duree
SuiviConvoi.objects.filter(pk=s.pk).update(depart_at=debut, position_at=debut)
PositionConvoi.objects.filter(suivi=s).update(date_heure=debut)

def tracer(points, n):
    seg = [(a, bb, math.dist(a, bb)) for a, bb in zip(points, points[1:])]
    tot = sum(x[2] for x in seg); out = []
    for i in range(1, n + 1):
        cible, acc = tot * i / n, 0
        for a, bb, l in seg:
            if acc + l >= cible:
                f = (cible - acc) / l; out.append((a[0] + (bb[0] - a[0]) * f, a[1] + (bb[1] - a[1]) * f)); break
            acc += l
    return out
fin = (MAN[0] + (BKE[0] - MAN[0]) * 0.45, MAN[1] + (BKE[1] - MAN[1]) * 0.45)   # entre Mankono et Bouaké
pts = tracer([CAMP, SEG, MAN, fin], 32)
lot = [{"latitude": la, "longitude": lo, "precision": 10, "vitesse_kmh": 72, "client_id": f"demo-{i}",
        "horodatage": (debut + duree * (i + 1) / len(pts)).isoformat()} for i, (la, lo) in enumerate(pts)]
r = cc.post(f"/api/suivi-convois/{rot.rotation_id}/position/", {"points": lot}, format="json")
assert r.status_code in (200, 201), r.data
v.refresh_from_db(); s.refresh_from_db()
print("ok convoi", rot.rotation_id, "statut", s.statut, "| voyage Aya", v.statut, v.origine, "->", v.destination, "| points", PositionConvoi.objects.filter(suivi=s).count())
