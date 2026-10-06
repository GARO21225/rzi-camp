"""
Import du menu hebdomadaire de restauration depuis le fichier .docx fourni
chaque semaine par le prestataire (ex: "ROXgold CDI 5th - 11th OCT 2026.docx").

Structure réelle observée dans ce type de fichier (confirmée via python-docx,
pas supposée) :
  - Table 0 = DÉJEUNER : 7 colonnes (1 par jour), AUCUNE fusion de cellule -
    fiable à 100%, importée automatiquement ligne par ligne.
  - Table 1 = DÎNER (détail plat par plat) : colonnes fusionnées pour les
    soirées à thème (BBQ night, Pasta night...), mais le nombre de colonnes
    fusionnées par ligne N'EST PAS CONSTANT d'une ligne à l'autre (vérifié :
    la ligne d'en-tête groupe différemment des lignes de plats). Impossible
    de reconstituer à coup sûr quel plat appartient à quel jour sans risquer
    une association erronée (un plat attribué au mauvais jour serait pire
    qu'une absence d'import) - donc VOLONTAIREMENT PAS importée en détail.
  - Table 3 = petit récap BREAKFAST/LUNCH/DINNER : fiable (pas de fusion),
    utilisée uniquement pour récupérer le THÈME de la soirée (ex: "BBQ
    NIGHT") en tant qu'unique entrée 'spécial' du dîner, et "Eggs your way"
    générique du petit-déjeuner.

Si le prestataire change un jour la mise en page (plus de fusions
irrégulières), le détail du dîner pourra être ajouté de la même façon que
le déjeuner - la détection par mots-clés de section ci-dessous fonctionnerait
alors à l'identique sur cette table.
"""
import re
import datetime

SECTION_MAP = [
    (['SOUPOFTHEDAY'], 'entree'),
    (['SALADBAR'], 'entree'),
    (['NOURISHHARVESTTABLE'], 'skip'),
    (['MAINS'], 'plat'),
    (['DESSERT'], 'dessert'),
    (['DRINKS'], 'skip'),
]
WEEKDAYS_NORM_VARIANTS = [
    'MONDAY', 'TUESDAY', 'WEDESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY',
]


def _norm(s):
    return re.sub(r'\s+', '', (s or '')).upper()


def _clean(s):
    return re.sub(r'\s+', ' ', (s or '')).strip()


class MenuImportError(Exception):
    pass


def _parse_lunch_table(table):
    header_cells = [c.text for c in table.rows[0].cells]
    if len(header_cells) != 7:
        raise MenuImportError(
            f"La table du menu déjeuner devrait avoir 7 colonnes (une par jour) — "
            f"trouvé {len(header_cells)}. Le gabarit du fichier a peut-être changé."
        )
    dates = []
    for h in header_cells:
        m = re.search(r'(\d{1,2})-(\d{1,2})-(\d{4})', h)
        if not m:
            raise MenuImportError(f"Date introuvable dans l'en-tête de colonne : {h!r}")
        d, mo, y = map(int, m.groups())
        dates.append(datetime.date(y, mo, d))

    current_section = None
    entries = []
    for row in table.rows[1:]:
        cells = [c.text for c in row.cells]
        if len(cells) != 7:
            continue
        normed = [_norm(c) for c in cells]

        if len(set(normed)) == 1 and normed[0]:
            matched = next((sec for keys, sec in SECTION_MAP if any(k in normed[0] for k in keys)), None)
            if matched:
                current_section = matched
                continue

        if all(normed[i] in WEEKDAYS_NORM_VARIANTS for i in range(7) if normed[i]):
            continue

        if current_section in (None, 'skip'):
            continue

        for i, cell in enumerate(cells):
            nom = _clean(cell)
            if not nom or len(nom) > 70:
                continue
            entries.append({
                'date_service': dates[i], 'repas': 'midi',
                'type_plat': current_section, 'nom': nom,
            })
    return entries, dates


def _parse_recap_table(table, dates):
    """Table BREAKFAST/LUNCH/DINNER - thème du dîner + petit-déjeuner
    générique, alignés sur les mêmes 7 dates que le déjeuner (ordre
    Lundi->Dimanche, déjà vérifié identique entre les tables de ce fichier)."""
    entries = []
    for row in table.rows:
        cells = [_clean(c.text) for c in row.cells]
        if not cells or not cells[0]:
            continue
        label = cells[0].upper()
        if label not in ('BREAKFAST', 'DINNER'):
            continue
        jours = [c for c in cells[1:] if c]  # ignore la/les colonnes vides de fusion
        jours = jours[-7:] if len(jours) >= 7 else jours
        repas = 'matin' if label == 'BREAKFAST' else 'soir'
        for i, theme in enumerate(jours):
            if i >= len(dates):
                break
            entries.append({
                'date_service': dates[i], 'repas': repas,
                'type_plat': 'special', 'nom': theme,
            })
    return entries


def extraire_menu_semaine(fichier):
    """fichier : objet file-like (ex: request.FILES['fichier']). Retourne
    (entries, dates) où entries est une liste de dicts prêts pour
    MenuJour.objects.create(**e), et dates la liste des 7 dates couvertes
    (pour savoir quoi effacer avant ré-import)."""
    import docx
    try:
        d = docx.Document(fichier)
    except Exception as e:
        raise MenuImportError(f"Fichier .docx illisible : {e}")

    if len(d.tables) < 1:
        raise MenuImportError("Aucun tableau trouvé dans ce fichier — gabarit inattendu.")

    entries, dates = _parse_lunch_table(d.tables[0])

    if len(d.tables) >= 4:
        try:
            entries += _parse_recap_table(d.tables[3], dates)
        except Exception:
            pass  # le récap petit-déj/dîner est un bonus, jamais bloquant

    if not entries:
        raise MenuImportError("Aucun plat reconnu dans ce fichier — gabarit inattendu.")

    return entries, dates
