# Données de DÉMONSTRATION fictives pour une base locale vierge (DEBUG=True, SQLite). Ne jamais lancer sur la production.
import datetime, os
from django.conf import settings
if not settings.DEBUG or os.environ.get('DATABASE_URL') or settings.DATABASES['default']['ENGINE'] != 'django.db.backends.sqlite3':
    raise SystemExit('Refusé : ce script ne tourne que sur une base SQLite locale avec DEBUG=True.')
from django.contrib.auth.models import User
from accounts.models import Profile
from residences.models import Personnel, Batiment, InductionCampRecord
from maintenance.models import Incident
u,_=User.objects.get_or_create(username="demo.resident", defaults={"first_name":"Aya","last_name":"DEMO"})
u.set_password("DemoSiteLife2026!"); u.save()
pr,_=Profile.objects.get_or_create(user=u); pr.role="agent"; pr.societe="DEMO SARL"; pr.save()
# Fiche liée au compte (le prénom est stocké en majuscules : get_or_create sur « Aya » échouait à la relance)
p=Personnel.objects.filter(user=u).first() or Personnel.objects.create(nom="DEMO", prenom="Aya", societe="DEMO SARL", telephone="0700000000")
p.user=u; p.save()
for i,res in enumerate(["DEMO-A01","DEMO-A02","DEMO-A03","DEMO-B01","DEMO-B02"]):
    b,_=Batiment.objects.get_or_create(residence=res, defaults={"bloc":"Bloc DEMO "+res[5]})
    if i==1:
        b.personnel=p; b.statut="Occupé"; b.occupant="DEMO Aya"; b.societe="DEMO SARL"; b.date_arrivee=datetime.date.today(); b.save()
InductionCampRecord.objects.get_or_create(user=u, defaults={"quiz_score":100})
Incident.objects.filter(auteur=u).delete()   # liste « Maintenance » vide au début de la démo
print("ok", u.id, p.id)
