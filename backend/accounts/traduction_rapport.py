"""
Version anglaise des rapports envoyés par email : le rapport est construit une fois en français, puis traduit
par dictionnaire (libellés fixes) et motifs (phrases avec chiffres). Les noms propres (restaurants, sociétés,
personnes, résidences) ne sont jamais touchés. Un test vérifie que tous les libellés des modèles y figurent.
Le texte inconnu reste en français plutôt que d'être mal traduit.
"""
import re

PHRASES = {
    # types / titres de sections
    "Synthèse générale (tout)": "General summary (all)", "Résidences & occupation (+ Camp Occupancy)": "Residences & occupancy (+ Camp Occupancy)",
    "Résidences & personnel": "Residences & staff", "Maintenance & incidents": "Maintenance & incidents", "Maintenance": "Maintenance",
    "Mobilité (départs / retours)": "Mobility (departures / returns)", "Mobilité": "Mobility", "Boutique & stock": "Shop & stock",
    "Restauration": "Catering", "Camp Occupancy": "Camp Occupancy",
    # tuiles / libellés
    "Chambres occupées": "Occupied rooms", "Chambres": "Rooms", "Occupées": "Occupied", "Libres": "Vacant",
    "Taux d'occupation": "Occupancy rate", "Répartition par statut": "Breakdown by status",
    "Occupation par bloc (chambres occupées)": "Occupancy by block (occupied rooms)",
    "Personnel actif par société": "Active staff by company", "Personnel actif par type": "Active staff by type",
    "Ouverts": "Open", "Dépassement SLA": "SLA breached", "Nouveaux (7 j)": "New (7 d)", "Résolus (7 j)": "Resolved (7 d)",
    "Incidents ouverts par priorité": "Open incidents by priority", "Incidents ouverts par catégorie": "Open incidents by category",
    "Incidents ouverts par statut": "Open incidents by status",
    "En voyage": "On the road", "À valider": "To validate", "Voyages par statut": "Trips by status",
    "Voyages par statut de validation": "Trips by validation status", "par destination": "by destination",
    "Départs": "Departures", "Retours": "Returns", "Aucun.": "None.",
    "Articles actifs": "Active items", "Épuisés": "Out of stock", "Articles par catégorie": "Items by category",
    "Stocks les plus bas": "Lowest stock levels", "épuisé": "out of stock",
    "Répartition du camp": "Camp breakdown", "Employés Roxgold par département": "Roxgold employees by department",
    "Employés Roxgold — par département": "Roxgold employees — by department",
    "Employés Roxgold": "Roxgold employees", "Sous-traitants (top 10)": "Subcontractors (top 10)",
    "Sous-traitants — par entreprise": "Subcontractors — by company", "Sous-traitants": "Subcontractors",
    "Visiteurs par département": "Visitors by department", "Visiteurs — par département": "Visitors — by department", "Visiteurs": "Visitors",
    "occupation des chambres (1 chambre occupée = 1)": "room occupancy (1 occupied room = 1)",
    "Occupation du camp —": "Camp occupancy —", "derniers jours": "last days", "Non renseigné": "Not specified",
    "Non renseignée": "Not specified", "Sous-traitant (société non renseignée)": "Subcontractor (company not specified)",
    "Rapport généré automatiquement": "Report generated automatically", "Total": "Total",
    # restauration
    "Repas servis": "Meals served", "Moyenne / jour": "Average / day", "Personnes distinctes": "Distinct people",
    "Couverture": "Coverage", "Satisfaction des repas": "Meal satisfaction", "Satisfaction": "Satisfaction", "Pic": "Peak",
    "Repas par jour": "Meals per day", "Par restaurant": "By restaurant", "Par entité": "By entity", "Superviseurs": "Supervisors",
    "Par société (top 10)": "By company (top 10)", "Répartition par repas": "Breakdown by meal",
    "Jour de la semaine × repas (moyenne / jour)": "Day of week × meal (average / day)", "À surveiller": "To watch",
    "par jour actif": "per active day", "avis": "reviews",
    "Petit-déjeuner": "Breakfast", "Déjeuner": "Lunch", "Dîner": "Dinner",
    "Lun": "Mon", "Mar": "Tue", "Mer": "Wed", "Jeu": "Thu", "Ven": "Fri", "Sam": "Sat", "Dim": "Sun",
    # libellés des modèles (statuts, priorités, catégories…)
    "Occupé": "Occupied", "Libre": "Vacant", "Réservé": "Reserved",
    "Critique": "Critical", "Haute": "High", "Moyenne": "Medium", "Basse": "Low",
    "Plomberie": "Plumbing", "Électricité": "Electrical", "Serrurerie": "Locksmith", "Climatisation": "Air conditioning",
    "Toiture": "Roofing", "Propreté": "Cleanliness", "Informatique": "IT", "Générateur": "Generator", "Véhicule": "Vehicle", "Autre": "Other",
    "Déclaré": "Reported", "Assigné": "Assigned", "En cours": "In progress", "Résolu": "Resolved", "Clôturé": "Closed", "Annulé": "Cancelled",
    "Planifié": "Planned", "Retour au camp": "Back at camp", "En attente": "Pending",
    "Agent Roxgold": "Roxgold agent", "Visiteur temporaire": "Temporary visitor",
    "Sous-traitant": "Subcontractor", "Sous-traitant (société non renseignée)": "Subcontractor (company not provided)",
    "pas de période précédente": "no previous period", "TABLEAU DE BORD RESTAURATION": "CATERING DASHBOARD",
    "repas servis": "meals served", "Aucun repas scanné sur la période.": "No meals scanned over the period.",
    "repas / (occupation × 3)": "meals / (occupancy × 3)",
    "aujourd'hui": "today", "7 derniers jours": "last 7 days", "semaine dernière (lun-dim)": "last week (Mon-Sun)",
    "mois en cours": "current month", "mois précédent": "previous month", "période choisie": "selected period", "hier": "yesterday",
}

# phrases avec valeurs : (motif français, remplacement anglais)
MOTIFS = [
    (r"Dans les (\d+) prochain\(s\) jour\(s\) : <b>(\d+)</b> départ\(s\) de résidence · <b>(\d+)</b> arrivée\(s\)",
     r"In the next \1 day(s): <b>\2</b> room departure(s) · <b>\3</b> arrival(s)"),
    (r"Départs sur (\d+) jours", r"Departures over \1 days"), (r"Retours sur (\d+) jours", r"Returns over \1 days"),
    (r"Départs aujourd'hui", "Departures today"), (r"Retours aujourd'hui", "Returns today"),
    (r"Occupation du camp — (\d+) derniers jours", r"Camp occupancy — last \1 days"),
    (r"\(part le (\d\d/\d\d)\)", r"(leaves on \1)"),
    (r"(\d+(?:\.\d+)?) par jour actif", r"\1 per active day"),
    (r"(.+?) n(?:'|&#x27;)a aucun superviseur affecté — personne ne peut y scanner\.", r"\1 has no supervisor assigned — nobody can scan there."),
    (r"(\d+) avis\b", r"\1 reviews"),
    (r"À surveiller \((\d+)", r"To watch (\1"),
    (r"Rapport généré automatiquement — ", "Report generated automatically — "),
]

import html as _html
for _k in list(PHRASES):                     # variantes échappées (&amp;, &#x27;) : les libellés passent par html.escape
    _e = _html.escape(_k)
    if _e != _k:
        PHRASES[_e] = _html.escape(PHRASES[_k])

_CLES = sorted(PHRASES, key=len, reverse=True)
_RE_TEXTE = re.compile(r"(>)([^<>]+)(<)")        # texte entre deux balises
_RE_ATTR = re.compile(r"(title|alt)='([^']*)'|(title|alt)=\"([^\"]*)\"")


def _traduire_texte(t):
    for k in _CLES:
        if k in t:
            t = re.sub(r"(?<![\wÀ-ÿ])" + re.escape(k) + r"(?![\wÀ-ÿ])", PHRASES[k], t)
    return t


def en_anglais(html):
    """Traduit le texte visible d'un fragment HTML (hors balises et attributs de style)."""
    for fr, en in MOTIFS:                       # motifs d'abord, sur tout le fragment (ils peuvent contenir des balises)
        html = re.sub(fr, en, html)
    return _RE_TEXTE.sub(lambda m: m.group(1) + _traduire_texte(m.group(2)) + m.group(3), html)


def libelles_manquants(libelles):
    """Libellés (choix de modèles) sans traduction — utilisé par les tests."""
    return [l for l in libelles if l and l.split(" ", 1)[-1] not in PHRASES and l not in PHRASES]
