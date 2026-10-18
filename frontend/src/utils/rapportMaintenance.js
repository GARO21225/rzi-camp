// ── Rapport de maintenance (HTML autonome, imprimable en A4) ──────────────
// Même signature qu'avant : genererRapport(incidents, stats, periode).
// Tout est calculé sur les incidents de la PÉRIODE choisie (les compteurs
// globaux de `stats` ne servent plus que de secours), pour que chaque chiffre
// du rapport corresponde aux lignes listées.

const NAVY = '#0F2A5C', NAVY_D = '#081B3D', OR = '#C9972B', OR_L = '#F5E6C4'
const ENCRE = '#0F172A', GRIS = '#64748B', BORD = '#E2E8F0'

const STATUTS = [
  ['declare', 'Déclaré', '#3B82F6'], ['assigne', 'Assigné', '#F97316'], ['en_cours', 'En cours', '#EAB308'],
  ['resolu', 'Résolu', '#16A34A'], ['cloture', 'Clôturé', '#64748B'], ['annule', 'Annulé', '#CBD5E1'],
]
const PRIOS = [['critique', 'Critique', '#DC2626'], ['haute', 'Haute', '#F97316'], ['moyenne', 'Moyenne', '#EAB308'], ['basse', 'Basse', '#16A34A']]
const LIB_STATUT = Object.fromEntries(STATUTS.map(([k, l]) => [k, l]))
const COUL_STATUT = Object.fromEntries(STATUTS.map(([k, , c]) => [k, c]))
const LIB_PRIO = Object.fromEntries(PRIOS.map(([k, l]) => [k, l]))
const COUL_PRIO = Object.fromEntries(PRIOS.map(([k, , c]) => [k, c]))
const LIB_CAT = { Electricite: 'Électricité', Proprete: 'Propreté', Generateur: 'Générateur', Vehicule: 'Véhicule' }
const PALETTE = [NAVY, OR, '#2563EB', '#16A34A', '#7C3AED', '#0891B2', '#DC2626', '#DB2777', '#EA580C', '#64748B']

const esc = (v) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const jour = (d) => d ? new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'
const jourCourt = (d) => d ? new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }) : '—'
const heures = (a, b) => (new Date(b) - new Date(a)) / 3600000
const duree = (h) => h == null ? '—' : h < 1 ? `${Math.max(1, Math.round(h * 60))} min` : h < 48 ? `${h.toFixed(1).replace('.', ',')} h` : `${(h / 24).toFixed(1).replace('.', ',')} j`
const pct = (n, t) => t ? Math.round(n / t * 100) : 0
const OUVERTS = ['declare', 'assigne', 'en_cours']

function compter(liste, cle) {
  const m = {}
  liste.forEach(i => { const k = typeof cle === 'function' ? cle(i) : i[cle]; if (k) m[k] = (m[k] || 0) + 1 })
  return Object.entries(m).sort((a, b) => b[1] - a[1])
}

// ── Petits graphiques SVG ──
function anneau(valeur, couleur, taille = 92, epaisseur = 10) {
  const r = (taille - epaisseur) / 2, c = 2 * Math.PI * r, v = Math.max(0, Math.min(100, valeur))
  return `<svg width="${taille}" height="${taille}" viewBox="0 0 ${taille} ${taille}">
    <circle cx="${taille / 2}" cy="${taille / 2}" r="${r}" fill="none" stroke="#EEF2F7" stroke-width="${epaisseur}"/>
    <circle cx="${taille / 2}" cy="${taille / 2}" r="${r}" fill="none" stroke="${couleur}" stroke-width="${epaisseur}" stroke-linecap="round"
      stroke-dasharray="${(c * v / 100).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 ${taille / 2} ${taille / 2})"/>
    <text x="50%" y="52%" text-anchor="middle" dominant-baseline="middle" font-size="${taille / 4.6}" font-weight="800" fill="${ENCRE}">${v}%</text>
  </svg>`
}

function donut(parts, taille = 150) {
  const total = parts.reduce((s, p) => s + p.n, 0)
  if (!total) return `<div class="vide">Aucune donnée</div>`
  const r = taille / 2 - 14, c = 2 * Math.PI * r
  let cumul = 0
  const arcs = parts.filter(p => p.n).map(p => {
    const long = c * p.n / total
    const arc = `<circle cx="${taille / 2}" cy="${taille / 2}" r="${r}" fill="none" stroke="${p.c}" stroke-width="22"
      stroke-dasharray="${long.toFixed(2)} ${(c - long).toFixed(2)}" stroke-dashoffset="${(-cumul).toFixed(2)}" transform="rotate(-90 ${taille / 2} ${taille / 2})"/>`
    cumul += long
    return arc
  }).join('')
  return `<svg width="${taille}" height="${taille}" viewBox="0 0 ${taille} ${taille}">${arcs}
    <text x="50%" y="46%" text-anchor="middle" font-size="26" font-weight="800" fill="${ENCRE}">${total}</text>
    <text x="50%" y="60%" text-anchor="middle" font-size="10" fill="${GRIS}">incidents</text></svg>`
}

const legende = (parts) => {
  const total = parts.reduce((s, p) => s + p.n, 0)
  return `<div class="legende">${parts.map(p => `<div class="leg"><span class="pastille" style="background:${p.c}"></span>
    <span class="leg-l">${esc(p.l)}</span><b>${p.n}</b><span class="leg-p">${pct(p.n, total)}%</span></div>`).join('')}</div>`
}

function barresH(lignes, max) {
  if (!lignes.length) return `<div class="vide">Aucune donnée</div>`
  const m = max || Math.max(...lignes.map(l => l.n), 1)
  return `<div class="barres">${lignes.map(l => `<div class="barre">
    <div class="barre-l">${esc(l.l)}</div>
    <div class="barre-piste"><div class="barre-v" style="width:${Math.max(3, l.n / m * 100).toFixed(1)}%;background:${l.c || NAVY}"></div></div>
    <div class="barre-n">${l.n}</div></div>`).join('')}</div>`
}

function histogramme(series) {
  if (series.length < 2) return `<div class="vide">Période trop courte pour une tendance</div>`
  const W = 520, H = 150, bas = 122, max = Math.max(...series.map(s => s.n), 1)
  const pas = (W - 30) / series.length, lb = Math.min(34, pas * 0.62)
  const barres = series.map((s, i) => {
    const h = Math.round(s.n / max * 96), x = 22 + i * pas + (pas - lb) / 2
    const hr = Math.round(s.r / max * 96)
    return `<rect x="${x.toFixed(1)}" y="${bas - h}" width="${lb.toFixed(1)}" height="${h}" rx="4" fill="${NAVY}"/>
      ${hr ? `<rect x="${(x + lb * 0.22).toFixed(1)}" y="${bas - hr}" width="${(lb * 0.56).toFixed(1)}" height="${hr}" rx="3" fill="${OR}"/>` : ''}
      ${s.n ? `<text x="${(x + lb / 2).toFixed(1)}" y="${bas - h - 5}" text-anchor="middle" font-size="10" font-weight="700" fill="${NAVY}">${s.n}</text>` : ''}
      <text x="${(x + lb / 2).toFixed(1)}" y="${bas + 15}" text-anchor="middle" font-size="9" fill="${GRIS}">${esc(s.l)}</text>`
  }).join('')
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" style="max-height:200px" preserveAspectRatio="xMidYMid meet">
    <line x1="18" y1="${bas}" x2="${W - 6}" y2="${bas}" stroke="${BORD}"/>${barres}</svg>
    <div class="legende ligne"><div class="leg"><span class="pastille" style="background:${NAVY}"></span><span class="leg-l">Déclarés</span></div>
    <div class="leg"><span class="pastille" style="background:${OR}"></span><span class="leg-l">Résolus</span></div></div>`
}

const badge = (texte, couleur) => `<span class="badge" style="background:${couleur}1A;color:${couleur};border-color:${couleur}40">${esc(texte)}</span>`

export function genererRapport(incidents, stats = {}, periode = {}) {
  const maintenant = new Date()
  const genereLe = maintenant.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const genereA = maintenant.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  const libPeriode = periode.debut || periode.fin
    ? `Du ${periode.debut ? jour(periode.debut) : 'début'} au ${periode.fin ? jour(periode.fin) : 'aujourd\'hui'}`
    : 'Toute la période'
  const ref = `RM-${maintenant.toISOString().slice(0, 10).replace(/-/g, '')}-${String(incidents.length).padStart(3, '0')}`

  const actifs = incidents.filter(i => i.statut !== 'annule')
  const ouverts = incidents.filter(i => OUVERTS.includes(i.statut))
  const resolus = incidents.filter(i => ['resolu', 'cloture'].includes(i.statut))
  const critiquesOuverts = ouverts.filter(i => i.priorite === 'critique')
  const slaDepasses = incidents.filter(i => i.sla_depasse)
  const slaOuvertsDepasses = ouverts.filter(i => i.sla_depasse || (i.sla_echeance && new Date(i.sla_echeance) < maintenant))
  const avecDuree = resolus.filter(i => i.date_creation && i.date_resolution)
  const dureeMoy = avecDuree.length ? avecDuree.reduce((s, i) => s + heures(i.date_creation, i.date_resolution), 0) / avecDuree.length : null
  const resolusDansSla = resolus.filter(i => !i.sla_depasse).length
  const tauxResolution = pct(resolus.length, actifs.length)
  const tauxSla = resolus.length ? pct(resolusDansSla, resolus.length) : null
  const ageJ = (i) => Math.floor((maintenant - new Date(i.date_creation)) / 86400000)
  const plusAncien = ouverts.length ? ouverts.reduce((a, b) => new Date(a.date_creation) < new Date(b.date_creation) ? a : b) : null

  // Répartitions
  const parStatut = STATUTS.map(([k, l, c]) => ({ l, c, n: incidents.filter(i => i.statut === k).length || (incidents.length ? 0 : (stats[k] || 0)) })).filter(p => p.n)
  const parPrio = PRIOS.map(([k, l, c]) => ({ l, c, n: incidents.filter(i => i.priorite === k).length })).filter(p => p.n)
  const parCat = compter(incidents, 'categorie').map(([k, n], i) => ({ l: LIB_CAT[k] || k, n, c: PALETTE[i % PALETTE.length] }))
  const parLieu = compter(incidents, i => i.residence ? `${i.residence}${i.bloc ? ' · ' + i.bloc : ''}` : null).slice(0, 8).map(([l, n]) => ({ l, n, c: OR }))

  // Évolution : par semaine si ≤ 10 semaines couvertes, sinon par mois (12 derniers)
  const dates = incidents.map(i => new Date(i.date_creation)).filter(d => !isNaN(d))
  let series = []
  if (dates.length) {
    const min = new Date(Math.min(...dates)), max = new Date(Math.max(...dates, maintenant))
    const semaines = (max - min) / (7 * 86400000)
    if (semaines <= 10) {
      const lundi = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x }
      for (let d = lundi(min); d <= max; d = new Date(d.getTime() + 7 * 86400000)) {
        const f = new Date(d.getTime() + 7 * 86400000)
        series.push({ l: jourCourt(d), n: incidents.filter(i => new Date(i.date_creation) >= d && new Date(i.date_creation) < f).length,
          r: resolus.filter(i => i.date_resolution && new Date(i.date_resolution) >= d && new Date(i.date_resolution) < f).length })
      }
    } else {
      const cle = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const mois = {}
      for (let d = new Date(min.getFullYear(), min.getMonth(), 1); d <= max; d = new Date(d.getFullYear(), d.getMonth() + 1, 1))
        mois[cle(d)] = { l: d.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' }), n: 0, r: 0 }
      incidents.forEach(i => { const m = mois[cle(new Date(i.date_creation))]; if (m) m.n++ })
      resolus.forEach(i => { if (i.date_resolution) { const m = mois[cle(new Date(i.date_resolution))]; if (m) m.r++ } })
      series = Object.values(mois).slice(-12)
    }
  }

  // Performance par technicien
  const techs = {}
  incidents.filter(i => i.assigne_nom).forEach(i => {
    if (!techs[i.assigne_nom]) techs[i.assigne_nom] = { nom: i.assigne_nom, total: 0, resolus: 0, encours: 0, dansSla: 0, heures: [] }
    const t = techs[i.assigne_nom]
    t.total++
    if (['resolu', 'cloture'].includes(i.statut)) {
      t.resolus++
      if (!i.sla_depasse) t.dansSla++
      if (i.date_creation && i.date_resolution) t.heures.push(heures(i.date_creation, i.date_resolution))
    } else if (OUVERTS.includes(i.statut)) t.encours++
  })
  const listeTechs = Object.values(techs).sort((a, b) => b.total - a.total)
  const nonAssignes = ouverts.filter(i => !i.assigne_nom).length

  // Points d'attention
  const alertes = []
  if (critiquesOuverts.length) alertes.push(['🚨', `${critiquesOuverts.length} incident(s) critique(s) encore ouvert(s)`, critiquesOuverts.slice(0, 4).map(i => `#${i.id} ${i.titre} — ${i.residence || ''}`).join(' · ')])
  if (slaOuvertsDepasses.length) alertes.push(['⏰', `${slaOuvertsDepasses.length} incident(s) ouvert(s) hors délai SLA`, 'À traiter en priorité pour revenir dans les délais contractuels.'])
  if (nonAssignes) alertes.push(['👷', `${nonAssignes} incident(s) ouvert(s) sans technicien assigné`, 'Ces dossiers n\'ont encore aucun responsable.'])
  if (plusAncien && ageJ(plusAncien) >= 7) alertes.push(['📅', `Plus ancien dossier ouvert : ${ageJ(plusAncien)} jours`, `#${plusAncien.id} ${plusAncien.titre} — déclaré le ${jour(plusAncien.date_creation)}`])

  const ouvertsTries = [...ouverts].sort((a, b) => {
    const pa = PRIOS.findIndex(p => p[0] === a.priorite), pb = PRIOS.findIndex(p => p[0] === b.priorite)
    return pa - pb || new Date(a.date_creation) - new Date(b.date_creation)
  })
  const resolusRecents = [...resolus].filter(i => i.date_resolution).sort((a, b) => new Date(b.date_resolution) - new Date(a.date_resolution)).slice(0, 12)

  const kpi = (icone, valeur, libelle, sous, couleur) => `<div class="kpi" style="--c:${couleur}">
    <div class="kpi-tete"><span class="kpi-ico">${icone}</span><span class="kpi-lib">${libelle}</span></div>
    <div class="kpi-val">${valeur}</div><div class="kpi-sous">${sous}</div></div>`

  const titreSection = (num, titre, sous) => `<div class="sec-titre"><span class="sec-num">${num}</span>
    <div><h2>${titre}</h2>${sous ? `<p>${sous}</p>` : ''}</div></div>`

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Rapport de maintenance — ${esc(libPeriode)}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0 }
  body { font-family: 'Inter', 'Segoe UI', Arial, sans-serif; color: ${ENCRE}; background: #F1F4F9; font-size: 12.5px; line-height: 1.45;
    -webkit-print-color-adjust: exact; print-color-adjust: exact }
  .feuille { max-width: 980px; margin: 0 auto; background: #fff; box-shadow: 0 10px 40px rgba(15,42,92,.10) }
  .barre-actions { max-width: 980px; margin: 0 auto; padding: 14px 0; display: flex; gap: 8px }
  .barre-actions button { border: none; border-radius: 10px; padding: 10px 18px; font-weight: 700; font-size: 13px; cursor: pointer; font-family: inherit }

  /* Couverture */
  .couv { background: linear-gradient(135deg, ${NAVY_D} 0%, ${NAVY} 60%, #1E3A8A 100%); color: #fff; padding: 34px 40px 30px; position: relative; overflow: hidden }
  .couv::after { content: ''; position: absolute; right: -60px; top: -60px; width: 260px; height: 260px; border-radius: 50%; border: 36px solid rgba(201,151,43,.18) }
  .couv-haut { display: flex; justify-content: space-between; align-items: flex-start; gap: 20px; position: relative; z-index: 1 }
  .marque { display: flex; align-items: center; gap: 12px }
  .logo { width: 46px; height: 46px; border-radius: 12px; background: ${OR}; color: ${NAVY_D}; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 20px }
  .marque-t { font-size: 15px; font-weight: 800; letter-spacing: .3px }
  .marque-s { font-size: 11px; opacity: .7 }
  .ref { text-align: right; font-size: 11px; opacity: .85; line-height: 1.6 }
  .ref b { color: ${OR}; font-family: 'JetBrains Mono', Consolas, monospace; letter-spacing: .5px }
  .couv h1 { font-size: 34px; font-weight: 900; letter-spacing: -.5px; margin-top: 26px; position: relative; z-index: 1 }
  .couv h1 span { color: ${OR} }
  .couv-sous { margin-top: 6px; font-size: 13.5px; opacity: .85; position: relative; z-index: 1 }
  .puces { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 20px; position: relative; z-index: 1 }
  .puce { background: rgba(255,255,255,.10); border: 1px solid rgba(255,255,255,.18); border-radius: 99px; padding: 6px 13px; font-size: 11.5px; font-weight: 600 }
  .puce b { color: ${OR} }
  .liseré { height: 5px; background: linear-gradient(90deg, ${OR}, #E3B23C 50%, ${OR}) }

  /* Sections */
  .section { padding: 26px 40px; border-bottom: 1px solid ${BORD} }
  .sec-titre { break-after: avoid }
  .sec-titre { display: flex; align-items: center; gap: 12px; margin-bottom: 18px }
  .sec-num { width: 30px; height: 30px; border-radius: 9px; background: ${NAVY}; color: ${OR}; font-weight: 900; font-size: 13px; display: flex; align-items: center; justify-content: center; flex-shrink: 0 }
  .sec-titre h2 { font-size: 17px; font-weight: 800; color: ${NAVY}; letter-spacing: -.2px }
  .sec-titre p { font-size: 11.5px; color: ${GRIS}; margin-top: 1px }

  /* KPI */
  .kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px }
  .kpi { border: 1px solid ${BORD}; border-radius: 14px; padding: 14px 15px 13px; position: relative; overflow: hidden; background: #fff; break-inside: avoid }
  .kpi::before { content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 4px; background: var(--c) }
  .kpi-tete { display: flex; align-items: center; gap: 7px }
  .kpi-ico { width: 26px; height: 26px; border-radius: 8px; background: color-mix(in srgb, var(--c) 12%, #fff); display: flex; align-items: center; justify-content: center; font-size: 13px }
  .kpi-lib { font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .6px; color: ${GRIS} }
  .kpi-val { font-size: 30px; font-weight: 900; color: var(--c); line-height: 1.05; margin-top: 10px; letter-spacing: -.5px }
  .kpi-sous { font-size: 11px; color: ${GRIS}; margin-top: 3px }

  .jauges { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-top: 12px }
  .jauge { display: flex; align-items: center; gap: 14px; border: 1px solid ${BORD}; border-radius: 14px; padding: 12px 16px; background: linear-gradient(180deg, #fff, #FAFBFD); break-inside: avoid }
  .jauge-t { font-size: 13px; font-weight: 800; color: ${ENCRE} }
  .jauge-s { font-size: 11px; color: ${GRIS}; margin-top: 2px }

  /* Alertes */
  .alertes { display: grid; grid-template-columns: 1fr 1fr; gap: 10px }
  .alerte { display: flex; gap: 11px; padding: 12px 14px; border-radius: 12px; background: #FFF7ED; border: 1px solid #FED7AA; break-inside: avoid }
  .alerte:first-child { background: #FEF2F2; border-color: #FECACA }
  .alerte-i { font-size: 18px; line-height: 1 }
  .alerte-t { font-weight: 800; font-size: 12.5px; color: ${ENCRE} }
  .alerte-s { font-size: 11px; color: #7C2D12; margin-top: 2px }
  .tout-va-bien { display: flex; gap: 12px; align-items: center; padding: 14px 16px; border-radius: 12px; background: #F0FDF4; border: 1px solid #BBF7D0; color: #166534; font-weight: 700 }

  /* Graphiques */
  .grille2 { display: grid; grid-template-columns: 1fr 1fr; gap: 14px }
  .carte { border: 1px solid ${BORD}; border-radius: 14px; padding: 16px; background: #fff; break-inside: avoid }
  .carte h3 { font-size: 12px; font-weight: 800; color: ${NAVY}; text-transform: uppercase; letter-spacing: .6px; margin-bottom: 12px; display: flex; align-items: center; gap: 7px }
  .carte h3::before { content: ''; width: 8px; height: 8px; border-radius: 2px; background: ${OR} }
  .donut-zone { display: flex; align-items: center; gap: 18px }
  .legende { display: flex; flex-direction: column; gap: 6px; flex: 1 }
  .legende.ligne { flex-direction: row; gap: 16px; margin-top: 4px }
  .leg { display: flex; align-items: center; gap: 7px; font-size: 11.5px }
  .leg-l { flex: 1 } .leg b { min-width: 22px; text-align: right } .leg-p { color: ${GRIS}; font-size: 10.5px; min-width: 32px; text-align: right }
  .pastille { width: 10px; height: 10px; border-radius: 3px; flex-shrink: 0 }
  .barres { display: flex; flex-direction: column; gap: 8px }
  .barre { display: grid; grid-template-columns: 120px 1fr 30px; align-items: center; gap: 10px; font-size: 11.5px }
  .barre-l { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #334155; font-weight: 600 }
  .barre-piste { height: 12px; background: #F1F5F9; border-radius: 99px; overflow: hidden }
  .barre-v { height: 100%; border-radius: 99px }
  .barre-n { font-weight: 800; text-align: right }
  .vide { color: #94A3B8; font-size: 12px; padding: 18px 0; text-align: center }

  /* Tableaux */
  table { width: 100%; border-collapse: separate; border-spacing: 0; font-size: 11.5px; border: 1px solid ${BORD}; border-radius: 12px; overflow: hidden }
  thead th { background: ${NAVY}; color: #fff; padding: 9px 10px; text-align: left; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .6px; white-space: nowrap }
  tbody td { padding: 8px 10px; border-top: 1px solid #EEF2F7; vertical-align: middle }
  tbody tr:nth-child(even) td { background: #FAFBFD }
  tr { break-inside: avoid }
  .num { color: #94A3B8; font-family: 'JetBrains Mono', Consolas, monospace; font-size: 10.5px }
  .titre-inc { font-weight: 700; color: ${ENCRE} }
  .lieu { color: ${GRIS}; font-size: 10.5px }
  .badge { display: inline-block; padding: 2px 9px; border-radius: 99px; font-size: 10px; font-weight: 700; border: 1px solid; white-space: nowrap }
  .mini { height: 6px; background: #F1F5F9; border-radius: 99px; overflow: hidden; min-width: 70px }
  .mini div { height: 100%; background: ${OR}; border-radius: 99px }
  .ok { color: #16A34A; font-weight: 800 } .ko { color: #DC2626; font-weight: 800 }
  .note { font-size: 11px; color: ${GRIS}; margin-top: 8px }

  /* Signatures & pied */
  .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 16px }
  .signature { border: 1px dashed #CBD5E1; border-radius: 12px; padding: 14px 16px; height: 110px; display: flex; flex-direction: column; justify-content: space-between; break-inside: avoid }
  .signature b { font-size: 11px; text-transform: uppercase; letter-spacing: .6px; color: ${NAVY} }
  .signature span { font-size: 10.5px; color: #94A3B8 }
  .pied { padding: 16px 40px; display: flex; justify-content: space-between; font-size: 10.5px; color: #94A3B8; background: #FAFBFD }
  .pied b { color: ${NAVY} }

  @media (max-width: 760px) {
    .kpis { grid-template-columns: repeat(2, 1fr) } .jauges, .grille2, .alertes, .signatures { grid-template-columns: 1fr }
    .section, .couv, .pied { padding-left: 18px; padding-right: 18px } .couv h1 { font-size: 26px }
    table { display: block; overflow-x: auto }
  }
  @media print {
    body { background: #fff } .feuille { box-shadow: none; max-width: none } .no-print { display: none !important }
    .section { padding: 18px 6px } .couv { border-radius: 14px } .pied { padding: 12px 6px }
    .saut { break-before: page }
  }
</style>
</head>
<body>

<div class="barre-actions no-print">
  <button onclick="window.print()" style="background:${NAVY};color:#fff">🖨️ Imprimer / PDF</button>
  <button onclick="window.close()" style="background:#E2E8F0;color:#334155">✕ Fermer</button>
</div>

<div class="feuille">

<header class="couv">
  <div class="couv-haut">
    <div class="marque"><div class="logo">R</div>
      <div><div class="marque-t">Roxgold SiteLife</div><div class="marque-s">Camp résidentiel · Sango, Côte d'Ivoire</div></div></div>
    <div class="ref">Référence <b>${ref}</b><br>Édité le ${genereLe}<br>à ${genereA}</div>
  </div>
  <h1>Rapport de <span>maintenance</span></h1>
  <div class="couv-sous">${esc(libPeriode)} · état des interventions, délais et performance des équipes</div>
  <div class="puces">
    <div class="puce"><b>${incidents.length}</b> incident(s)</div>
    <div class="puce"><b>${ouverts.length}</b> ouvert(s)</div>
    <div class="puce"><b>${resolus.length}</b> résolu(s)</div>
    <div class="puce"><b>${listeTechs.length}</b> intervenant(s)</div>
  </div>
</header>
<div class="liseré"></div>

<section class="section">
  ${titreSection(1, 'Synthèse de la période', 'Les indicateurs clés en un coup d\'œil')}
  <div class="kpis">
    ${kpi('📋', incidents.length, 'Incidents', `${actifs.length} hors annulés`, NAVY)}
    ${kpi('🔧', ouverts.length, 'En cours', `${critiquesOuverts.length} critique(s) · ${nonAssignes} non assigné(s)`, '#EA580C')}
    ${kpi('✅', resolus.length, 'Résolus', `${tauxResolution}% des incidents`, '#16A34A')}
    ${kpi('⏱️', duree(dureeMoy), 'Délai moyen', 'de la déclaration à la résolution', '#7C3AED')}
  </div>
  <div class="jauges">
    <div class="jauge">${anneau(tauxResolution, '#16A34A')}<div><div class="jauge-t">Taux de résolution</div><div class="jauge-s">${resolus.length} sur ${actifs.length} incident(s)</div></div></div>
    <div class="jauge">${anneau(tauxSla ?? 0, tauxSla == null ? '#CBD5E1' : tauxSla >= 80 ? '#16A34A' : tauxSla >= 60 ? OR : '#DC2626')}<div><div class="jauge-t">Respect du SLA</div><div class="jauge-s">${tauxSla == null ? 'aucun incident résolu' : `${resolusDansSla} résolu(s) dans les délais`}</div></div></div>
    <div class="jauge">${anneau(pct(slaDepasses.length, incidents.length), '#DC2626')}<div><div class="jauge-t">Hors délai</div><div class="jauge-s">${slaDepasses.length} incident(s) au SLA dépassé</div></div></div>
  </div>
</section>

<section class="section">
  ${titreSection(2, 'Points d\'attention', 'Ce qui demande une action rapide')}
  ${alertes.length
    ? `<div class="alertes">${alertes.map(([i, t, s]) => `<div class="alerte"><div class="alerte-i">${i}</div><div><div class="alerte-t">${esc(t)}</div><div class="alerte-s">${esc(s)}</div></div></div>`).join('')}</div>`
    : `<div class="tout-va-bien">✅ Aucun point bloquant : pas d'incident critique ouvert ni de dossier hors délai.</div>`}
</section>

<section class="section">
  ${titreSection(3, 'Analyse des incidents', 'Répartitions et tendance sur la période')}
  <div class="grille2">
    <div class="carte"><h3>Par statut</h3><div class="donut-zone">${donut(parStatut)}${legende(parStatut)}</div></div>
    <div class="carte"><h3>Par priorité</h3><div class="donut-zone">${donut(parPrio)}${legende(parPrio)}</div></div>
    <div class="carte"><h3>Par catégorie</h3>${barresH(parCat.slice(0, 8))}</div>
    <div class="carte"><h3>Lieux les plus touchés</h3>${barresH(parLieu)}</div>
  </div>
  <div class="carte" style="margin-top:14px"><h3>Évolution — déclarés et résolus</h3>${histogramme(series)}</div>
</section>

<section class="section saut">
  ${titreSection(4, 'Performance des intervenants', 'Charge, résolution et respect des délais par technicien')}
  ${listeTechs.length ? `<table>
    <thead><tr><th>Intervenant</th><th>Assignés</th><th>En cours</th><th>Résolus</th><th>Taux</th><th>Délai moyen</th><th>Dans le SLA</th></tr></thead>
    <tbody>${listeTechs.map(t => {
      const taux = pct(t.resolus, t.total)
      const moy = t.heures.length ? t.heures.reduce((a, b) => a + b, 0) / t.heures.length : null
      return `<tr><td class="titre-inc">👷 ${esc(t.nom)}</td><td><b>${t.total}</b></td><td>${t.encours}</td><td>${t.resolus}</td>
        <td><div style="display:flex;align-items:center;gap:8px"><div class="mini"><div style="width:${taux}%"></div></div><b>${taux}%</b></div></td>
        <td>${duree(moy)}</td><td class="${t.resolus && t.dansSla === t.resolus ? 'ok' : t.resolus ? 'ko' : ''}">${t.resolus ? `${pct(t.dansSla, t.resolus)}%` : '—'}</td></tr>`
    }).join('')}</tbody></table>
    ${nonAssignes ? `<div class="note">⚠️ ${nonAssignes} incident(s) ouvert(s) n'ont encore aucun intervenant.</div>` : ''}`
    : `<div class="vide">Aucun incident assigné sur la période.</div>`}
</section>

<section class="section">
  ${titreSection(5, `Incidents ouverts (${ouverts.length})`, 'Classés par priorité puis par ancienneté')}
  ${ouvertsTries.length ? `<table>
    <thead><tr><th>N°</th><th>Incident</th><th>Catégorie</th><th>Priorité</th><th>Statut</th><th>Assigné à</th><th>Déclaré</th><th>Âge</th><th>SLA</th></tr></thead>
    <tbody>${ouvertsTries.slice(0, 40).map(i => {
      const horsDelai = i.sla_depasse || (i.sla_echeance && new Date(i.sla_echeance) < maintenant)
      return `<tr><td class="num">#${i.id}</td>
        <td><div class="titre-inc">${esc(i.titre || '—')}</div><div class="lieu">📍 ${esc(i.residence || '—')}${i.bloc ? ' · ' + esc(i.bloc) : ''}</div></td>
        <td>${esc(LIB_CAT[i.categorie] || i.categorie || '—')}</td>
        <td>${badge(LIB_PRIO[i.priorite] || i.priorite || '—', COUL_PRIO[i.priorite] || GRIS)}</td>
        <td>${badge(LIB_STATUT[i.statut] || i.statut, COUL_STATUT[i.statut] || GRIS)}</td>
        <td>${i.assigne_nom ? esc(i.assigne_nom) : '<span class="ko">Non assigné</span>'}</td>
        <td style="white-space:nowrap">${jourCourt(i.date_creation)}</td>
        <td><b>${ageJ(i)} j</b></td>
        <td class="${horsDelai ? 'ko' : 'ok'}">${horsDelai ? '⚠️ Dépassé' : i.sla_echeance ? `✓ ${jourCourt(i.sla_echeance)}` : '✓'}</td></tr>`
    }).join('')}</tbody></table>
    ${ouvertsTries.length > 40 ? `<div class="note">… et ${ouvertsTries.length - 40} autre(s) incident(s) ouvert(s).</div>` : ''}`
    : `<div class="tout-va-bien">🎉 Aucun incident ouvert sur la période.</div>`}
</section>

${resolusRecents.length ? `<section class="section">
  ${titreSection(6, 'Dernières résolutions', 'Les interventions terminées le plus récemment')}
  <table>
    <thead><tr><th>N°</th><th>Incident</th><th>Intervenant</th><th>Résolu le</th><th>Durée</th><th>SLA</th></tr></thead>
    <tbody>${resolusRecents.map(i => `<tr><td class="num">#${i.id}</td>
      <td><div class="titre-inc">${esc(i.titre || '—')}</div><div class="lieu">📍 ${esc(i.residence || '—')}${i.bloc ? ' · ' + esc(i.bloc) : ''}${i.commentaire_resolution ? ' · ' + esc(String(i.commentaire_resolution).slice(0, 80)) : ''}</div></td>
      <td>${esc(i.assigne_nom || '—')}</td><td style="white-space:nowrap">${jour(i.date_resolution)}</td>
      <td>${i.date_creation ? duree(heures(i.date_creation, i.date_resolution)) : '—'}</td>
      <td class="${i.sla_depasse ? 'ko' : 'ok'}">${i.sla_depasse ? 'Dépassé' : 'Respecté'}</td></tr>`).join('')}</tbody>
  </table>
</section>` : ''}

<section class="section">
  ${titreSection(resolusRecents.length ? 7 : 6, 'Validation', 'Visa des responsables')}
  <div class="signatures">
    <div class="signature"><b>Responsable maintenance</b><span>Nom, date et signature</span></div>
    <div class="signature"><b>Camp Boss / Direction</b><span>Nom, date et signature</span></div>
  </div>
</section>

<footer class="pied"><span><b>Roxgold SiteLife</b> · Rapport de maintenance · ${ref}</span><span>Document généré automatiquement le ${maintenant.toLocaleDateString('fr-FR')} à ${genereA}</span></footer>

</div>
</body>
</html>`
}
