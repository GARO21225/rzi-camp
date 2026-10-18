// Fiche d'intervention d'un incident (bouton « Rapport » de la fiche Maintenance).
// Document A4 autonome : identité du dossier, délais/SLA, chronologie,
// photos avant/après, résolution et visas.

const NAVY = '#0F2A5C', NAVY_D = '#081B3D', OR = '#C9972B', ENCRE = '#0F172A', GRIS = '#64748B', BORD = '#E2E8F0'
const STATUT = { declare: ['Déclaré', '#3B82F6'], assigne: ['Assigné', '#F97316'], en_cours: ['En cours', '#EAB308'], resolu: ['Résolu', '#16A34A'], cloture: ['Clôturé', '#64748B'], annule: ['Annulé', '#94A3B8'] }
const PRIO = { critique: ['Critique', '#DC2626'], haute: ['Haute', '#F97316'], moyenne: ['Moyenne', '#CA8A04'], basse: ['Basse', '#16A34A'] }
const ETAPE = {
  info: ['💬', 'Message', '#2563EB'], assignation: ['👷', 'Assignation', '#F97316'], debut: ['⚙️', 'Début d\'intervention', '#EAB308'],
  photo_avant: ['📷', 'Photo avant', '#7C3AED'], photo_apres: ['📷', 'Photo après', '#16A34A'], resolution: ['✅', 'Résolution', '#16A34A'],
  cloture: ['🔒', 'Clôture', '#64748B'], escalade: ['⚠️', 'Escalade', '#DC2626'], relance: ['⏰', 'Relance SLA', '#DC2626'],
}

const esc = (v) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const dt = (d) => d ? new Date(d).toLocaleString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'
const duree = (a, b) => {
  if (!a || !b) return '—'
  const h = (new Date(b) - new Date(a)) / 3600000
  return h < 1 ? `${Math.max(1, Math.round(h * 60))} min` : h < 48 ? `${h.toFixed(1).replace('.', ',')} h` : `${(h / 24).toFixed(1).replace('.', ',')} j`
}
const img = (b64, mime = 'image/jpeg') => {
  if (!b64 || String(b64).length < 20) return ''
  const s = String(b64)
  return s.startsWith('data:') ? s : `data:${mime};base64,${s}`
}
const badge = ([l, c]) => `<span class="badge" style="background:${c}1A;color:${c};border-color:${c}55">${esc(l)}</span>`

export function ficheIntervention(inc) {
  const maintenant = new Date()
  const cmts = inc.commentaires || []
  const debut = cmts.find(c => c.type_comment === 'debut')?.date_creation
  const avant = cmts.filter(c => c.type_comment === 'photo_avant' && img(c.photo_base64))
  const apres = cmts.filter(c => c.type_comment === 'photo_apres' && img(c.photo_base64))
  const ouvert = ['declare', 'assigne', 'en_cours'].includes(inc.statut)
  const fin = inc.date_resolution || inc.date_cloture
  const horsDelai = inc.sla_depasse || (inc.sla_echeance && new Date(ouvert ? maintenant : (fin || maintenant)) > new Date(inc.sla_echeance))
  const statut = STATUT[inc.statut] || [inc.statut, GRIS]
  const prio = PRIO[inc.priorite] || [inc.priorite, GRIS]
  const photoDecl = img(inc.photo_base64, inc.photo_mime)

  const champ = (l, v) => `<div class="champ"><div class="champ-l">${l}</div><div class="champ-v">${v}</div></div>`
  const galerie = (titre, liste, couleur) => `<div class="galerie"><div class="gal-t" style="color:${couleur}">${titre}</div>
    ${liste.length ? liste.map(c => `<figure><img src="${img(c.photo_base64)}" alt=""/><figcaption>${dt(c.date_creation)} · ${esc(c.auteur_nom || '')}</figcaption></figure>`).join('')
      : '<div class="vide">Aucune photo</div>'}</div>`

  const chronologie = [
    { t: 'creation', ic: '📝', l: 'Déclaration', c: NAVY, d: inc.date_creation, a: inc.auteur_nom, txt: inc.description },
    ...cmts.filter(c => !['photo_avant', 'photo_apres'].includes(c.type_comment)).map(c => {
      const [ic, l, col] = ETAPE[c.type_comment] || ['•', c.type_comment, GRIS]
      return { ic, l, c: col, d: c.date_creation, a: c.auteur_nom, txt: c.contenu, photo: img(c.photo_base64) }
    }),
  ]

  return `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8">
<title>Fiche d'intervention #${inc.id} — ${esc(inc.titre)}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0 }
  body { font-family: 'Segoe UI', Arial, sans-serif; color: ${ENCRE}; font-size: 12.5px; line-height: 1.45; background: #fff;
    -webkit-print-color-adjust: exact; print-color-adjust: exact }
  .page { max-width: 820px; margin: 0 auto }
  .tete { background: linear-gradient(135deg, ${NAVY_D}, ${NAVY} 65%, #1E3A8A); color: #fff; border-radius: 14px 14px 0 0; padding: 22px 26px 20px; position: relative; overflow: hidden }
  .tete::after { content: ''; position: absolute; right: -50px; top: -50px; width: 190px; height: 190px; border-radius: 50%; border: 28px solid rgba(201,151,43,.2) }
  .tete-l { display: flex; justify-content: space-between; gap: 16px; position: relative; z-index: 1 }
  .logo { display: flex; align-items: center; gap: 10px }
  .logo b { width: 38px; height: 38px; border-radius: 10px; background: ${OR}; color: ${NAVY_D}; display: flex; align-items: center; justify-content: center; font-size: 17px; font-weight: 900 }
  .logo span { font-size: 13px; font-weight: 800 } .logo small { display: block; font-size: 10.5px; opacity: .7; font-weight: 400 }
  .num { text-align: right; font-size: 11px; opacity: .9 } .num b { display: block; font-size: 22px; color: ${OR}; font-family: Consolas, monospace }
  h1 { font-size: 24px; font-weight: 900; margin-top: 16px; position: relative; z-index: 1 }
  .sous { font-size: 12.5px; opacity: .85; margin-top: 3px; position: relative; z-index: 1 }
  .badges { margin-top: 12px; display: flex; gap: 6px; flex-wrap: wrap; position: relative; z-index: 1 }
  .tete .badge { background: rgba(255,255,255,.95) !important }
  .lisere { height: 4px; background: ${OR} }
  .corps { border: 1px solid ${BORD}; border-top: none; border-radius: 0 0 14px 14px; padding: 6px 24px 22px }
  h2 { font-size: 13px; font-weight: 800; color: ${NAVY}; text-transform: uppercase; letter-spacing: .7px; margin: 20px 0 10px; display: flex; align-items: center; gap: 8px }
  h2::before { content: ''; width: 9px; height: 9px; border-radius: 2px; background: ${OR} }
  .grille { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px }
  .champ { border: 1px solid ${BORD}; border-radius: 10px; padding: 8px 11px; background: #FAFBFD }
  .champ-l { font-size: 9.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .6px; color: ${GRIS} }
  .champ-v { font-size: 12.5px; font-weight: 700; margin-top: 2px }
  .delais { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px }
  .delai { border-radius: 12px; padding: 10px 12px; border: 1px solid ${BORD}; border-top: 4px solid var(--c) }
  .delai b { display: block; font-size: 18px; font-weight: 900; color: var(--c) } .delai span { font-size: 10.5px; color: ${GRIS} }
  .desc { border-left: 4px solid ${NAVY}; background: #F8FAFC; border-radius: 0 10px 10px 0; padding: 10px 14px; white-space: pre-wrap }
  .photos { display: grid; grid-template-columns: 1fr 1fr; gap: 12px }
  .galerie { border: 1px solid ${BORD}; border-radius: 12px; padding: 10px; break-inside: avoid }
  .gal-t { font-weight: 800; font-size: 11px; text-transform: uppercase; letter-spacing: .6px; margin-bottom: 8px }
  figure { margin-bottom: 8px } figure img { width: 100%; max-height: 220px; object-fit: cover; border-radius: 8px; border: 1px solid ${BORD} }
  figcaption { font-size: 10px; color: ${GRIS}; margin-top: 3px }
  .vide { color: #94A3B8; font-size: 11.5px; padding: 18px 0; text-align: center }
  .chrono { position: relative; padding-left: 22px }
  .chrono::before { content: ''; position: absolute; left: 8px; top: 4px; bottom: 4px; width: 2px; background: ${BORD} }
  .etape { position: relative; margin-bottom: 12px; break-inside: avoid }
  .etape::before { content: ''; position: absolute; left: -19px; top: 4px; width: 12px; height: 12px; border-radius: 50%; background: var(--c); box-shadow: 0 0 0 3px #fff }
  .etape-t { font-weight: 800; font-size: 12px } .etape-t small { color: ${GRIS}; font-weight: 500; margin-left: 6px }
  .etape-x { font-size: 12px; color: #334155; margin-top: 2px; white-space: pre-wrap }
  .etape img { max-width: 220px; max-height: 150px; border-radius: 8px; margin-top: 6px; border: 1px solid ${BORD} }
  .resol { border: 1px solid #BBF7D0; background: #F0FDF4; border-radius: 12px; padding: 12px 14px; white-space: pre-wrap }
  .visas { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px }
  .visa { border: 1px dashed #CBD5E1; border-radius: 12px; height: 92px; padding: 10px 12px; display: flex; flex-direction: column; justify-content: space-between }
  .visa b { font-size: 10.5px; text-transform: uppercase; letter-spacing: .6px; color: ${NAVY} } .visa span { font-size: 10px; color: #94A3B8 }
  .badge { display: inline-block; padding: 3px 10px; border-radius: 99px; font-size: 10.5px; font-weight: 800; border: 1px solid }
  .pied { margin-top: 18px; padding-top: 10px; border-top: 1px solid ${BORD}; font-size: 10px; color: #94A3B8; display: flex; justify-content: space-between }
  @media (max-width: 640px) { .grille, .delais, .photos, .visas { grid-template-columns: 1fr 1fr } }
</style></head><body><div class="page">
<div class="tete">
  <div class="tete-l">
    <div class="logo"><b>R</b><span>Roxgold SiteLife<small>Service maintenance · Camp de Sango</small></span></div>
    <div class="num">Fiche d'intervention<b>#${inc.id}</b>Éditée le ${dt(maintenant)}</div>
  </div>
  <h1>${esc(inc.titre || 'Incident')}</h1>
  <div class="sous">📍 ${esc(inc.residence || '—')}${inc.bloc ? ' · ' + esc(inc.bloc) : ''} · ${esc(inc.categorie || '')}</div>
  <div class="badges">${badge(statut)}${badge(prio)}${badge(horsDelai ? ['⚠️ Hors délai SLA', '#DC2626'] : ['✓ Dans le délai SLA', '#16A34A'])}</div>
</div>
<div class="lisere"></div>
<div class="corps">
  <h2>Identification</h2>
  <div class="grille">
    ${champ('Déclaré par', esc(inc.auteur_nom || '—'))}
    ${champ('Intervenant', esc(inc.assigne_nom || 'Non assigné'))}
    ${champ('Catégorie', esc(inc.categorie || '—'))}
    ${champ('Déclaré le', dt(inc.date_creation))}
    ${champ('Échéance SLA', dt(inc.sla_echeance))}
    ${champ(inc.date_cloture ? 'Clôturé le' : 'Résolu le', dt(inc.date_cloture || inc.date_resolution))}
  </div>

  <h2>Délais</h2>
  <div class="delais">
    <div class="delai" style="--c:${NAVY}"><b>${duree(inc.date_creation, debut)}</b><span>Prise en charge</span></div>
    <div class="delai" style="--c:#EAB308"><b>${duree(debut, inc.date_resolution)}</b><span>Durée d'intervention</span></div>
    <div class="delai" style="--c:#7C3AED"><b>${duree(inc.date_creation, inc.date_resolution || (ouvert ? maintenant : null))}</b><span>${inc.date_resolution ? 'Délai total de résolution' : 'Ouvert depuis'}</span></div>
    <div class="delai" style="--c:${horsDelai ? '#DC2626' : '#16A34A'}"><b>${horsDelai ? 'Dépassé' : 'Respecté'}</b><span>SLA</span></div>
  </div>

  <h2>Description du problème</h2>
  <div class="desc">${esc(inc.description || '—')}</div>
  ${photoDecl ? `<div style="margin-top:10px"><img src="${photoDecl}" alt="" style="max-width:320px;max-height:220px;border-radius:10px;border:1px solid ${BORD}"/></div>` : ''}

  <h2>Photos de l'intervention</h2>
  <div class="photos">${galerie('📷 Avant', avant, '#7C3AED')}${galerie('📷 Après', apres, '#16A34A')}</div>

  ${inc.commentaire_resolution ? `<h2>Travaux réalisés</h2><div class="resol">${esc(inc.commentaire_resolution)}</div>` : ''}
  ${inc.commentaire_cloture ? `<h2>Clôture</h2><div class="resol" style="background:#F8FAFC;border-color:${BORD}">${esc(inc.commentaire_cloture)}</div>` : ''}

  <h2>Chronologie (${chronologie.length})</h2>
  <div class="chrono">${chronologie.map(e => `<div class="etape" style="--c:${e.c}">
    <div class="etape-t">${e.ic} ${esc(e.l)}<small>${dt(e.d)}${e.a ? ' · ' + esc(e.a) : ''}</small></div>
    ${e.txt ? `<div class="etape-x">${esc(e.txt)}</div>` : ''}${e.photo ? `<img src="${e.photo}" alt=""/>` : ''}</div>`).join('')}</div>

  <h2>Visas</h2>
  <div class="visas">
    <div class="visa"><b>Intervenant</b><span>${esc(inc.assigne_nom || 'Nom, date, signature')}</span></div>
    <div class="visa"><b>Résident / déclarant</b><span>${esc(inc.auteur_nom || 'Nom, date, signature')}</span></div>
    <div class="visa"><b>Responsable maintenance</b><span>Nom, date, signature</span></div>
  </div>
  <div class="pied"><span><b style="color:${NAVY}">Roxgold SiteLife</b> · Fiche d'intervention #${inc.id}</span><span>Document généré automatiquement</span></div>
</div></div></body></html>`
}
