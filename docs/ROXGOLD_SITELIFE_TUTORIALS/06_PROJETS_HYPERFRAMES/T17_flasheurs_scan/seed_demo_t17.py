# Données de DÉMONSTRATION fictives pour une base locale vierge (DEBUG=True, SQLite). Ne jamais lancer sur la production.
# Prérequis : T05_signaler_incident/seed_demo.py (Aya DEMO) et T03_demander_voyage/seed_demo_t03.py (demo.admin).
#
# Rejoue la VRAIE chaîne par l'API de l'application (APIClient) :
#   1. l'administrateur (rôle Camp Boss) crée « Restaurant DÉMO » et y affecte le flasheur demo.flasheur ;
#   2. le flasheur scanne, par l'API de scan, les QR signés de deux résidents fictifs (petit-déjeuner et déjeuner),
#      pour que les compteurs et l'historique du jour ne soient pas vides ;
#   3. Aya n'a encore rien pris au déjeuner : c'est elle que l'on scanne en direct pendant la capture.
# Écrit aussi, dans le dossier passé en variable QR_DIR, les images des QR utilisés par la fausse caméra :
#   qr_aya.png (QR réel d'Aya, signé par cette instance) et qr_inconnu.png (texte quelconque, refusé par l'application).
import datetime, base64, os
# Lancer AVEC la même variable SECRET_KEY que le serveur Daphne de démo (sinon la signature des QR diffère).
from django.conf import settings
if not settings.DEBUG or os.environ.get('DATABASE_URL') or settings.DATABASES['default']['ENGINE'] != 'django.db.backends.sqlite3':
    raise SystemExit('Refusé : ce script ne tourne que sur une base SQLite locale avec DEBUG=True.')
from django.contrib.auth.models import User
from rest_framework.test import APIClient
from accounts.models import Profile
from residences.models import Personnel
from restauration.models import Restaurant, SuperviseurRestaurant, RepasLog, QRToken, AvisRestauration

admin = User.objects.get(username="demo.admin")
aya = Personnel.objects.get(user__username="demo.resident")

fl, _ = User.objects.get_or_create(username="demo.flasheur", defaults={"first_name": "Koffi", "last_name": "DEMO"})
fl.first_name, fl.last_name = "Koffi", "DEMO"; fl.set_password("DemoSiteLife2026!"); fl.save()
pf, _ = Profile.objects.get_or_create(user=fl); pf.role = "restauration"; pf.save()
pfl = Personnel.objects.filter(user=fl).first() or Personnel.objects.create(nom="DEMO", prenom="Koffi", societe="DEMO RESTAURATION", user=fl)

residents = [aya]
for nom, prenom, soc in [("DEMO", "Mariam", "DEMO SARL"), ("DEMO", "Konan", "DEMO BTP")]:
    p = Personnel.objects.filter(nom=nom, prenom=prenom.upper()).first() or Personnel.objects.create(nom=nom, prenom=prenom, societe=soc)
    p.generer_qr()
    p.refresh_from_db(); residents.append(p)
aya.generer_qr()   # toujours re-signer : la clé locale (SECRET_KEY) doit être celle du serveur de démo
aya.refresh_from_db()

# Repas et avis de la démo remis à zéro
ids = [p.id for p in residents]
RepasLog.objects.filter(personnel_id__in=ids).delete(); QRToken.objects.filter(personnel_id__in=ids).delete()
AvisRestauration.objects.filter(personnel_id__in=ids).delete() if hasattr(AvisRestauration, "personnel") else None
SuperviseurRestaurant.objects.all().delete(); Restaurant.objects.all().delete()

ca = APIClient(); ca.force_authenticate(admin)
r = ca.post("/api/restaurants/", {"nom": "Restaurant DÉMO"}, format="json"); assert r.status_code == 201, r.data
rid = r.data["id"]
r = ca.post(f"/api/restaurants/{rid}/affecter/", {"user_ids": [fl.id]}, format="json"); assert r.status_code == 200, r.data

cf = APIClient(); cf.force_authenticate(fl)
for p, repas in [(residents[1], "petit_dejeuner"), (residents[2], "petit_dejeuner"), (residents[1], "dejeuner"), (residents[2], "dejeuner")]:
    r = cf.post("/api/qr/scan/", {"qr_data": p.qr_code_string, "type_repas": repas, "restaurant_id": rid}, format="json")
    assert r.status_code in (200, 201), (r.status_code, r.data)

qr_dir = os.environ.get("QR_DIR")
if qr_dir:
    os.makedirs(qr_dir, exist_ok=True)
    open(os.path.join(qr_dir, "qr_aya.png"), "wb").write(base64.b64decode(aya.qr_code_data))
    import qrcode
    qrcode.make("CARTE-DEMO-INCONNUE", box_size=20, border=6).save(os.path.join(qr_dir, "qr_inconnu.png"))
print(f"ok restaurant {rid} | flasheur {fl.username} | repas du jour {RepasLog.objects.count()} | QR Aya {aya.qr_code_string}")
