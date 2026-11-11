# Données de DÉMONSTRATION fictives pour une base locale vierge (DEBUG=True, SQLite). Ne jamais lancer sur la production.
# Prérequis : T05_signaler_incident/seed_demo.py (Aya DEMO) et T03_demander_voyage/seed_demo_t03.py (demo.admin).
#
# Ce que fait le script, et par quel chemin :
#   - menu du jour, articles du bar, bon de caisse annuel : par la VRAIE API (APIClient, en demo.admin),
#     comme le ferait l'administrateur ou l'équipe restauration ;
#   - consommations d'Aya au bar : par l'ORM, avec la même logique que la caisse (montant = prix × quantité,
#     stock décrémenté, bon débité). La caisse (ConsommationBoutiqueViewSet.create) écrit en SQL brut
#     propre à PostgreSQL (NOW(), GREATEST) et ne peut pas tourner sur cette base SQLite de démonstration.
#   - Aya revient au camp (aucun voyage en cours), pour un accueil neutre.
# Plats, articles et prix sont fictifs (aucun prix réel du bar du site).
import datetime, os
from django.conf import settings
if not settings.DEBUG or os.environ.get('DATABASE_URL') or settings.DATABASES['default']['ENGINE'] != 'django.db.backends.sqlite3':
    raise SystemExit('Refusé : ce script ne tourne que sur une base SQLite locale avec DEBUG=True.')
from django.db.models import F
from django.utils import timezone
from django.contrib.auth.models import User
from rest_framework.test import APIClient
from residences.models import Personnel, Demande, Batiment, OccupationHistory, ResidentPrincipal
from voyages.models import Voyage, SuiviConvoi
from evenements.models import SimpleNotification
from restauration.models import MenuJour, ArticleBoutique, ConsommationBoutique, BonCaisse

u = User.objects.get(username="demo.resident"); p = Personnel.objects.filter(user=u).first()
admin = User.objects.get(username="demo.admin")

# Aya au camp, sans voyage en cours (efface l'état laissé par T04)
SuiviConvoi.objects.all().delete(); Voyage.objects.filter(personnel=p).delete(); Demande.objects.filter(demandeur=u).delete()
SimpleNotification.objects.filter(user=u).delete()
b = Batiment.objects.get(residence="DEMO-A02")
b.personnel = p; b.statut = "Occupé"; b.occupant = "DEMO Aya"; b.societe = "DEMO SARL"; b.date_arrivee = datetime.date(2026, 11, 1); b.date_depart = None; b.save()
OccupationHistory.objects.filter(batiment=b, personnel=p).delete(); ResidentPrincipal.objects.filter(personnel=p).delete()
ResidentPrincipal.objects.create(personnel=p, batiment=b, date_debut=datetime.date(2026, 11, 1))
if not p.qr_code_data:
    p.generer_qr()

ca = APIClient(); ca.force_authenticate(admin)
today = datetime.date.today()

# ── Menu du jour (API menu, comme l'équipe restauration) ──
MenuJour.objects.filter(date_service=today).delete()
MENU = [
    ("matin", "boisson", "Café, thé ou chocolat chaud", ""),
    ("matin", "plat", "Omelette et pain frais", "Avec beurre et confiture"),
    ("matin", "dessert", "Fruits de saison", ""),
    ("midi", "entree", "Salade de crudités", ""),
    ("midi", "plat", "Riz sauce arachide au poulet", ""),
    ("midi", "plat", "Attiéké et poisson braisé", "Alloco en accompagnement"),
    ("midi", "dessert", "Yaourt nature", ""),
    ("soir", "plat", "Foutou sauce graine", ""),
    ("soir", "plat", "Pâtes à la bolognaise", ""),
    ("soir", "dessert", "Salade de fruits", ""),
]
for repas, typ, nom, desc in MENU:
    r = ca.post("/api/menu/", {"nom": nom, "description": desc, "type_plat": typ, "repas": repas,
                               "date_service": today.isoformat(), "disponible": True}, format="json")
    assert r.status_code in (200, 201), (r.status_code, r.data)

# ── Carte du bar (API articles, réservée à l'administrateur) ──
ConsommationBoutique.objects.all().delete(); ArticleBoutique.objects.all().delete()
ARTICLES = [  # nom, catégorie, prix FCFA (fictifs), stock
    ("Eau minérale 1,5 L", "boissons", 500, 48),
    ("Soda 33 cl", "boissons", 700, 36),
    ("Jus de bissap 50 cl", "boissons", 600, 20),
    ("Café expresso", "boissons", 400, 60),
    ("Jus de gingembre 50 cl", "boissons", 600, 0),
    ("Biscuits secs", "snacks", 500, 25),
    ("Arachides grillées", "snacks", 300, 30),
    ("Savon de toilette", "hygiène", 800, 15),
    ("Dentifrice", "hygiène", 1200, 10),
]
art = {}
for nom, cat, prix, stock in ARTICLES:
    r = ca.post("/api/boutique/articles/", {"nom": nom, "categorie": cat, "prix": prix, "stock": stock, "actif": True}, format="json")
    assert r.status_code in (200, 201), (r.status_code, r.data)
    art[nom] = ArticleBoutique.objects.get(id=r.data["id"])

# ── Bon de caisse annuel d'Aya (API « créditer », réservée à l'administrateur) ──
BonCaisse.objects.filter(personnel=p).delete()
r = ca.post("/api/boutique/bons/crediter/", {"personnel_id": p.id, "montant": 100000, "annee": today.year}, format="json")
assert r.status_code in (200, 201), (r.status_code, r.data)
bon = BonCaisse.objects.get(personnel=p, annee=today.year)

# ── Consommations d'Aya (même logique que la caisse) ──
CONSOS = [  # article, quantité, mode, il y a N jours, heure (Abidjan = UTC)
    ("Eau minérale 1,5 L", 2, "bon", 1, "19:20"),
    ("Café expresso", 1, "bon", 1, "07:15"),
    ("Biscuits secs", 1, "especes", 2, "20:05"),
    ("Soda 33 cl", 2, "bon", 4, "18:40"),
    ("Savon de toilette", 1, "bon", 6, "17:30"),
    ("Jus de bissap 50 cl", 1, "bon", 8, "19:45"),
]
for nom, q, mode, j, hm in CONSOS:
    a = art[nom]
    c = ConsommationBoutique.objects.create(personnel=p, article=a, quantite=q, mode_paiement=mode, valide_par=admin)
    ConsommationBoutique.objects.filter(id=c.id).update(date_conso=datetime.datetime.combine(
        today - datetime.timedelta(days=j), datetime.time(*map(int, hm.split(":"))), tzinfo=datetime.timezone.utc))
    ArticleBoutique.objects.filter(id=a.id).update(stock=F("stock") - q)
    if mode == "bon":
        BonCaisse.objects.filter(id=bon.id).update(credit_restant=F("credit_restant") - c.montant)
bon.refresh_from_db()
print(f"ok menu {MenuJour.objects.filter(date_service=today).count()} plats | articles {len(art)} | "
      f"consos {ConsommationBoutique.objects.filter(personnel=p).count()} | bon {bon.credit_restant}/{bon.credit_initial} FCFA")
