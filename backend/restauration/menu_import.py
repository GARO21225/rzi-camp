"""
Import du menu hebdomadaire de restauration depuis le fichier .docx fourni
chaque semaine par le prestataire (ex: "ROXgold CDI 5th - 11th OCT 2026.docx").

Le fichier contient, dans l'ordre, des titres en zones de texte puis des tables :
  - "LUNCH MENU"       -> table DÉJEUNER  (repas = midi)
  - "DINNER MENU"      -> table DÎNER     (repas = soir)
  - "TASTE OF THE WORLD" -> tables récap : petit-déjeuner (matin) + thème du dîner (soir)

Les tables contiennent des cellules fusionnées (gridSpan, gridBefore) et les
colonnes du dîner ne sont pas alignées exactement sur celles de l'en-tête.
`row.cells` de python-docx n'est donc PAS fiable ici : on lit le XML, on
calcule la position horizontale réelle de chaque cellule (largeurs de
`w:tblGrid` + `gridSpan` + `gridBefore`) et on l'associe au jour dont la
colonne de l'en-tête la recouvre le plus.

Lignes pleine largeur = titres de section (SOUP OF THE DAY, SALAD BAR, NOURISH
HARVEST TABLE, MAINS, DESSERT, DRINKS) ou informations communes à tous les
jours (corbeille de pain, buffet harvest, boissons) -> dupliquées sur les 7 jours.
"""
import re
import datetime

from docx.oxml.ns import qn
from docx.text.paragraph import Paragraph


class MenuImportError(Exception):
    pass


# (clé normalisée du titre, type_plat, libellé de section stocké en description)
SECTIONS = [
    ('SOUPOFTHEDAY', 'entree', 'Soupe du jour'),
    ('SALADBAR', 'entree', 'Salad bar'),
    ('NOURISHHARVESTTABLE', 'entree', 'Nourish Harvest Table'),
    ('MAINS', 'plat', 'Plats principaux'),
    ('DESSERT', 'dessert', 'Dessert'),
    ('DRINKS', 'boisson', 'Boissons'),
]
WEEKDAYS = {'MONDAY', 'TUESDAY', 'WEDESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'}
TAGS = {'V': 'Végétarien', 'H': 'Healthier choice', 'A': 'A'}
TAG_RE = re.compile(r'\(\s*([VHA])\s*\)', re.I)


def _norm(s):
    return re.sub(r'\s+', '', (s or '')).upper()


def _clean(s):
    return re.sub(r'\s+', ' ', (s or '')).strip()


def _cell_text(tc):
    parts = []
    for p in tc.findall(qn('w:p')):
        t = _clean(Paragraph(p, None).text)
        if t:
            parts.append(t)
    return ' / '.join(parts)


def _int_attr(el, name='w:val'):
    return int(el.get(qn(name))) if el is not None else 0


def _table_rows(tbl):
    """Retourne (rows, grid_total). rows = liste de listes de (x0, x1, texte)."""
    grid = [int(g.get(qn('w:w'))) for g in tbl.find(qn('w:tblGrid'))]
    rows = []
    for tr in tbl.findall(qn('w:tr')):
        pr = tr.find(qn('w:trPr'))
        before = _int_attr(pr.find(qn('w:gridBefore'))) if pr is not None else 0
        col = before
        x = sum(grid[:before])
        cells = []
        for tc in tr.findall(qn('w:tc')):
            tcpr = tc.find(qn('w:tcPr'))
            span = 1
            if tcpr is not None and tcpr.find(qn('w:gridSpan')) is not None:
                span = _int_attr(tcpr.find(qn('w:gridSpan')))
            w = sum(grid[col:col + span])
            cells.append((x, x + w, _cell_text(tc)))
            x += w
            col += span
        rows.append(cells)
    return rows, sum(grid)


def _day_for(cell, day_ranges):
    x0, x1, _ = cell
    best, best_ov = None, 0
    for i, (a, b) in enumerate(day_ranges):
        ov = min(x1, b) - max(x0, a)
        if ov > best_ov:
            best, best_ov = i, ov
    return best


def _make_entry(date, repas, type_plat, texte, section_label):
    """Symboles (V)/(H) conservés dans le nom, comme sur le document source.
    (A) n'est pas défini dans la légende du fichier -> non repris."""
    tags = {m.upper() for m in TAG_RE.findall(texte)}
    nom = _clean(re.sub(r'\(+\s*$', '', TAG_RE.sub('', texte))).strip(' /')
    if not nom:
        return None
    sym = ''.join(f'({t})' for t in ('V', 'H') if t in tags)
    if len(nom) > 200:
        return None
    return {
        'date_service': date, 'repas': repas, 'type_plat': type_plat,
        'nom': f'{nom} {sym}'.strip(), 'description': section_label or '',
    }


def _section_of(norm):
    if len(norm) > 70:
        return None
    for key, tp, label in SECTIONS:
        if norm.startswith(key):
            return tp, label
    return None


def _parse_menu_table(tbl, repas, dates=None):
    """Table déjeuner/dîner. Retourne (entries, dates)."""
    rows, total = _table_rows(tbl)
    if not rows:
        return [], dates

    header = rows[0]
    if len(header) != 7:
        raise MenuImportError(
            f"L'en-tête du menu ({repas}) devrait avoir 7 colonnes (un jour chacune) — "
            f"trouvé {len(header)}. Le gabarit du fichier a peut-être changé."
        )
    day_ranges = [(c[0], c[1]) for c in header]

    if dates is None:
        dates = []
        for c in header:
            m = re.search(r'(\d{1,2})-(\d{1,2})-(\d{4})', c[2])
            if not m:
                raise MenuImportError(f"Date introuvable dans l'en-tête : {c[2]!r}")
            d, mo, y = map(int, m.groups())
            dates.append(datetime.date(y, mo, d))

    entries = []
    section = None  # (type_plat, label)
    for cells in rows[1:]:
        texts = [c[2] for c in cells]
        if not any(texts):
            continue
        norms = [_norm(t) for t in texts]
        full = len(cells) == 1 and (cells[0][1] - cells[0][0]) >= total * 0.95

        if full:
            sec = _section_of(norms[0])
            if sec:
                section = sec
                continue
            if section is None:
                continue
            tp, label = section
            if label == 'Nourish Harvest Table':
                continue
            if 'BREAD' in norms[0]:
                label = 'Corbeille de pain'
            for date in dates:
                e = _make_entry(date, repas, tp, texts[0], label)
                if e:
                    entries.append(e)
            continue

        # ligne de noms de jours répétée
        if all(n in WEEKDAYS for n in norms if n):
            continue
        if section is None:
            continue

        tp, label = section
        if repas == 'soir' and tp == 'entree' and label == 'Soupe du jour':
            # au dîner, la ligne sous "soup of the day" ne porte que le thème de la soirée
            tp, label = 'special', 'Thème de la soirée'

        for cell in cells:
            if not cell[2]:
                continue
            i = _day_for(cell, day_ranges)
            if i is None:
                continue
            e = _make_entry(dates[i], repas, tp, cell[2], label)
            if e:
                entries.append(e)
    return entries, dates


def _parse_taste_tables(tables, dates):
    """Tables récap 'Taste of the World' : BREAKFAST / LUNCH / DINNER, 7 jours
    (les 7 dernières cellules de chaque ligne, la 1ère étant le libellé)."""
    entries = []
    for tbl in tables:
        rows, _ = _table_rows(tbl)
        for cells in rows:
            if len(cells) < 8:
                continue
            label = _norm(cells[0][2])
            repas = {'BREAKFAST': 'matin', 'LUNCH': 'midi', 'DINNER': 'soir'}.get(label)
            if not repas:
                continue
            for i, cell in enumerate(cells[-7:]):
                if not cell[2]:
                    continue
                e = _make_entry(dates[i], repas, 'special', cell[2], 'Taste of the World')
                if e:
                    entries.append(e)
    return entries


def _context_titles(p):
    n = _norm(''.join(p.itertext()))
    if 'LUNCHMENU' in n:
        return 'lunch'
    if 'DINNERMENU' in n:
        return 'dinner'
    if 'TASTEOFTHEWORLD' in n:
        return 'taste'
    if 'LIVECOOKINGSTATION' in n:
        return 'live'
    return None


def extraire_menu_semaine(fichier):
    """fichier : objet file-like (ex: request.FILES['fichier']). Retourne
    (entries, dates) — entries : dicts prêts pour MenuJour.objects.create(**e),
    dates : les 7 dates couvertes (pour effacer avant ré-import)."""
    import docx
    try:
        d = docx.Document(fichier)
    except Exception as e:
        raise MenuImportError(f"Fichier .docx illisible : {e}")

    context = None
    lunch_tbl = dinner_tbl = None
    taste_tbls = []
    for el in d.element.body.iterchildren():
        tag = el.tag.split('}')[1]
        if tag == 'p':
            ctx = _context_titles(el)
            if ctx:
                context = ctx
        elif tag == 'tbl':
            if context == 'lunch' and lunch_tbl is None:
                lunch_tbl = el
            elif context == 'dinner' and dinner_tbl is None:
                dinner_tbl = el
            elif context == 'taste':
                taste_tbls.append(el)

    if lunch_tbl is None:
        raise MenuImportError("Table « LUNCH MENU » introuvable — gabarit inattendu.")

    entries, dates = _parse_menu_table(lunch_tbl, 'midi')
    if dinner_tbl is not None:
        e2, _ = _parse_menu_table(dinner_tbl, 'soir', dates)
        entries += e2
    if taste_tbls:
        entries += _parse_taste_tables(taste_tbls, dates)

    # dédoublonnage (ex: "BBQ NIGHT" présent dans le dîner et dans Taste of the World)
    seen, uniq = set(), []
    for e in entries:
        k = (e['date_service'], e['repas'], e['type_plat'], e['nom'].lower())
        if k in seen:
            continue
        seen.add(k)
        uniq.append(e)

    if not uniq:
        raise MenuImportError("Aucun plat reconnu dans ce fichier — gabarit inattendu.")
    return uniq, dates
