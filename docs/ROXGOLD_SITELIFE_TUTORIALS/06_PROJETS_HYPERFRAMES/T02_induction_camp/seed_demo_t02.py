# Données de DÉMONSTRATION fictives pour une base locale vierge (DEBUG=True, SQLite). Ne jamais lancer sur la production.
# Crée un nouvel arrivant fictif (hébergé, induction non faite) et ANONYMISE les contacts réels du contenu d'induction
# chargé par migration (noms, téléphones, e-mails) — rien de réel ne doit apparaître à l'écran.
import datetime, json, os, re
from django.conf import settings
if not settings.DEBUG or os.environ.get('DATABASE_URL') or settings.DATABASES['default']['ENGINE'] != 'django.db.backends.sqlite3':
    raise SystemExit('Refusé : ce script ne tourne que sur une base SQLite locale avec DEBUG=True.')
from django.contrib.auth.models import User
from accounts.models import Profile
from residences.models import Personnel, Batiment, InductionCampRecord, InductionInfra, InductionQuizQuestion

u, _ = User.objects.get_or_create(username="demo.arrivant", defaults={"first_name": "Yao", "last_name": "DEMO"})
u.set_password("DemoSiteLife2026!"); u.save()
pr, _ = Profile.objects.get_or_create(user=u); pr.role = "agent"; pr.societe = "DEMO SARL"; pr.save()
p = Personnel.objects.filter(user=u).first() or Personnel.objects.create(nom="DEMO", prenom="Yao", societe="DEMO SARL", telephone="0700000001", user=u)
p.nom, p.prenom, p.societe = "DEMO", "Yao", "DEMO SARL"; p.save()
b, _ = Batiment.objects.get_or_create(residence="DEMO-A03", defaults={"bloc": "Bloc DEMO A"})
b.personnel = p; b.statut = "Occupé"; b.occupant = "DEMO Yao"; b.societe = "DEMO SARL"; b.date_arrivee = datetime.date.today(); b.save()
InductionCampRecord.objects.filter(user=u).delete()          # parcours à faire

TEL = re.compile(r"\(?\+?225\)?[\s0-9]{8,}")
MAIL = re.compile(r"\S+@\S+")
for inf in InductionInfra.objects.all():
    if inf.titre == "Contacts du camp":
        inf.details = ["CONTACT DÉMO 1 — Coordinateur du camp — +225 00 00 00 00 01",
                       "CONTACT DÉMO 2 — Camp Officer — +225 00 00 00 00 02",
                       "CONTACT DÉMO 3 — Responsable maintenance — +225 00 00 00 00 03"]
    else:
        inf.details = [MAIL.sub("demo@exemple.ci", TEL.sub("+225 00 00 00 00 00", l)) for l in inf.details]
        inf.details = [re.sub(r"chambre [A-Z]\d+", "chambre DEMO", l) for l in inf.details]
    inf.description = TEL.sub("+225 00 00 00 00 00", inf.description)
    inf.save()
# Vrais noms = ceux de la fiche « Contacts du camp » du contenu officiel (source : residences/induction_roxgold.py).
from residences.induction_roxgold import INFRAS as _SRC
_contacts = next(d for (t, *_r, d) in _SRC if t == "Contacts du camp")
NOMS = {}
for i, ligne in enumerate(_contacts, 1):
    complet = ligne.split("—")[0].strip()                 # « Prénom NOM »
    NOMS[complet] = f"CONTACT DÉMO {i}"
    NOMS[complet.split()[-1]] = f"CONTACT DÉMO {i}"         # NOM seul
    NOMS[complet.split()[0] + " "] = ""                       # prénom seul
def anonymiser(t):
    for vrai in sorted(NOMS, key=len, reverse=True):          # noms complets d'abord (idempotent : « CONTACT DÉMO » n'en contient aucun)
        t = t.replace(vrai, NOMS[vrai])
    return MAIL.sub("demo@exemple.ci", TEL.sub("+225 00 00 00 00 00", t)).replace("MEDECIS", "PRESTATAIRE MÉDICAL")
for q in InductionQuizQuestion.objects.all():
    q.options = [anonymiser(o) for o in q.options]
    q.question, q.explication = anonymiser(q.question), anonymiser(q.explication); q.save()
for inf in InductionInfra.objects.all():
    inf.details = [anonymiser(l) for l in inf.details]; inf.description = anonymiser(inf.description); inf.save()
rep = {q.question: q.options[q.bonne_reponse] for q in InductionQuizQuestion.objects.filter(actif=True)}
json.dump(rep, open(os.environ["T02_REPONSES"], "w"), ensure_ascii=False, indent=1)   # réponses justes, pour capture_t02.js
print("ok", u.id, len(rep), "questions")
