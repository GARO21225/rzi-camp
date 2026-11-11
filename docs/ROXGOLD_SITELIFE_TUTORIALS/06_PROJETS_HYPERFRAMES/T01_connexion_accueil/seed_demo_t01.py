# Données de DÉMONSTRATION fictives pour une base locale vierge (DEBUG=True, SQLite). Ne jamais lancer sur la production.
# Prérequis : T05_signaler_incident/seed_demo.py (compte demo.resident « Aya DEMO », chambre DEMO-A02).
# Ajoute un prochain trajet validé et une demande en attente, et remet le mot de passe de démo (la vidéo le change).
import datetime, os
from django.conf import settings
if not settings.DEBUG or os.environ.get('DATABASE_URL') or settings.DATABASES['default']['ENGINE'] != 'django.db.backends.sqlite3':
    raise SystemExit('Refusé : ce script ne tourne que sur une base SQLite locale avec DEBUG=True.')
from django.contrib.auth.models import User
from residences.models import Personnel, Demande
from voyages.models import Voyage

u = User.objects.get(username="demo.resident")
u.set_password("DemoSiteLife2026!"); u.save()
p = Personnel.objects.filter(user=u).first()
aujourd_hui = datetime.date(2026, 11, 11)
Voyage.objects.filter(personnel=p).delete()
Voyage.objects.create(personnel=p, origine="Camp Roxgold Sango", destination="Abidjan", motif="Repos de fin de rotation (DÉMO)",
                      date_depart=aujourd_hui + datetime.timedelta(days=4), date_retour_prevue=aujourd_hui + datetime.timedelta(days=18),
                      statut="planifie", statut_validation="valide", heure_depart=datetime.time(6, 30), point_rdv="Parking principal (DÉMO)")
Demande.objects.filter(demandeur=u).delete()
Demande.objects.create(demandeur=u, type_demande="voyage", statut="en_attente", message_demandeur="Demande de démonstration",
                       donnees={"motif": "Formation (DÉMO)", "destination": "Yamoussoukro"})
print("ok", Voyage.objects.filter(personnel=p).count(), "voyage(s),", Demande.objects.filter(demandeur=u).count(), "demande(s)")
