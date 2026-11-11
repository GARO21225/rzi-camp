# Données de DÉMONSTRATION fictives pour une base locale vierge (DEBUG=True, SQLite). Ne jamais lancer sur la production.
# Prérequis : T05_signaler_incident/seed_demo.py (compte demo.resident « Aya DEMO »).
# Remet Aya sans trajet ni demande, et crée un compte administrateur de démo (demo.admin) qui validera la demande.
import os
from django.conf import settings
if not settings.DEBUG or os.environ.get('DATABASE_URL') or settings.DATABASES['default']['ENGINE'] != 'django.db.backends.sqlite3':
    raise SystemExit('Refusé : ce script ne tourne que sur une base SQLite locale avec DEBUG=True.')
from django.contrib.auth.models import User
from accounts.models import Profile
import datetime
from residences.models import Personnel, Demande, Batiment, OccupationHistory, ResidentPrincipal
from voyages.models import Voyage
from evenements.models import SimpleNotification

u = User.objects.get(username="demo.resident"); u.set_password("DemoSiteLife2026!"); u.save()
p = Personnel.objects.filter(user=u).first()
Voyage.objects.filter(personnel=p).delete()
Demande.objects.filter(demandeur=u).delete()
SimpleNotification.objects.filter(user=u).delete()
# Aya est logée dans DEMO-A02 (résidente principale), comme au premier jour de la démo
b = Batiment.objects.get(residence="DEMO-A02")
b.personnel = p; b.statut = "Occupé"; b.occupant = "DEMO Aya"; b.societe = "DEMO SARL"; b.date_arrivee = datetime.date(2026, 11, 1); b.date_depart = None; b.save()
OccupationHistory.objects.filter(batiment=b, personnel=p).delete()
ResidentPrincipal.objects.filter(personnel=p).delete()
ResidentPrincipal.objects.create(personnel=p, batiment=b, date_debut=datetime.date(2026, 11, 1))
a, _ = User.objects.get_or_create(username="demo.admin", defaults={"first_name": "Admin", "last_name": "DEMO", "is_staff": True})
a.is_staff = True; a.set_password("DemoSiteLife2026!"); a.save()
pa, _ = Profile.objects.get_or_create(user=a); pa.role = "admin"; pa.save()
print("ok : Aya sans trajet ni demande ; demo.admin prêt")
