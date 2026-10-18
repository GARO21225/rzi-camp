// Fiche d'intervention d'une plainte : même mise en page que celle des incidents
// (ficheIntervention.js — feuille de style partagée), construite depuis la plainte + sa frise.
import { CSS_FICHE } from './ficheIntervention'

const NAVY = '#0F2A5C', OR = '#C9972B', GRIS = '#64748B'
const STATUT = {
  nouvelle: ['Nouvelle', '#3B82F6'], a_qualifier: ['À qualifier', '#F59E0B'], affectee: ['Affectée', '#8B5CF6'], prise_en_charge: ['Prise en charge', '#06B6D4'],
  en_cours: ['En cours', '#EAB308'], en_attente: ['En attente', '#94A3B8'], resolue: ['Résolue', '#16A34A'], confirmee: ['Confirmée', '#16A34A'],
  cloturee: ['Clôturée', '#64748B'], reouverte: ['Réouverte', '#DC2626'], rejetee: ['Rejetée', '#EF4444'],
}
const PRIO = { critique: ['Critique', '#DC2626'], haute: ['Haute', '#F97316'], moyenne: ['Moyenne', '#CA8A04'], basse: ['Basse', '#16A34A'] }
const COUL_ETAPE = { depose: '#3B82F6', retiree: '#EF4444', reaffectee: '#8B5CF6', affectee: '#8B5CF6', prise_en_charge: '#06B6D4', en_cours: '#F97316', en_attente: '#94A3B8', resolue: '#22C55E', confirmee: '#16A34A', cloturee: '#64748B', rejetee: '#EF4444', reouverte: '#DC2626', a_qualifier: '#F59E0B' }

const esc = (v) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const dt = (d) => d ? new Date(d).toLocaleString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'
const duree = (a, b) => {
  if (!a || !b) return '—'
  const h = (new Date(b) - new Date(a)) / 3600000
  return h < 1 ? `${Math.max(1, Math.round(h * 60))} min` : h < 48 ? `${h.toFixed(1).replace('.', ',')} h` : `${(h / 24).toFixed(1).replace('.', ',')} j`
}
const img = (b64) => !b64 || String(b64).length < 20 ? '' : (String(b64).startsWith('data:') ? b64 : `data:image/jpeg;base64,${b64}`)
const badge = ([l, c]) => `<span class="badge" style="background:${c}1A;color:${c};border-color:${c}55">${esc(l)}</span>`

export function fichePlainte(p, etapes = []) {
  const maintenant = new Date()
  const statut = STATUT[p.statut] || [p.statut, GRIS]
  const prio = PRIO[p.priorite] || [p.priorite || 'Non qualifiée', GRIS]
  const fini = ['resolue', 'confirmee', 'cloturee', 'rejetee'].includes(p.statut)
  const horsDelai = !!p.sla_depasse
  const priseEnCharge = etapes.find(e => e.cle === 'prise_en_charge')?.date || p.date_prise_en_charge
  const debutTrav = etapes.find(e => e.cle === 'en_cours')?.date
  const champ = (l, v) => `<div class="champ"><div class="champ-l">${l}</div><div class="champ-v">${v}</div></div>`
  const photoD = img(p.photo_base64), photoR = img(p.photo_resolution_base64)
  const galerie = (titre, src, couleur) => `<div class="galerie"><div class="gal-t" style="color:${couleur}">${titre}</div>
    ${src ? `<figure><img src="${src}" alt=""/></figure>` : '<div class="vide">Aucune photo</div>'}</div>`
  const cat = (p.categorie_label || p.categorie || '') + (p.sous_categorie ? ' — ' + p.sous_categorie : '')

  return `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8">
<title>Fiche d'intervention plainte #${p.id}</title>
<style>${CSS_FICHE}</style></head><body><div class="page">
<div class="tete">
  <div class="tete-l">
    <div class="logo"><b>R</b><span>Roxgold SiteLife<small>Service plaintes · Camp de Sango</small></span></div>
    <div class="num">Fiche d'intervention — plainte<b>#${p.id}</b>Éditée le ${dt(maintenant)}</div>
  </div>
  <h1>${esc(cat)}</h1>
  <div class="sous">📍 ${esc(p.batiment_residence || '—')} · ${esc(p.occupant_nom || '')}</div>
  <div class="badges">${badge(statut)}${badge(prio)}${p.sla_echeance ? badge(horsDelai ? ['⚠️ Hors délai SLA', '#DC2626'] : ['✓ Dans le délai SLA', '#16A34A']) : ''}</div>
</div>
<div class="lisere"></div>
<div class="corps">
  <h2>Identification</h2>
  <div class="grille">
    ${champ('Déposée par', esc(p.occupant_nom || '—'))}
    ${champ('Responsable', esc(p.affecte_a_nom || 'Non affectée'))}
    ${champ('Service', esc(p.service || '—'))}
    ${champ('Déposée le', dt(p.date_creation))}
    ${champ('Échéance SLA', dt(p.sla_echeance))}
    ${champ(p.date_cloture ? 'Clôturée le' : 'Résolue le', dt(p.date_cloture || p.date_resolution))}
  </div>

  <h2>Délais</h2>
  <div class="delais">
    <div class="delai" style="--c:${NAVY}"><b>${duree(p.date_creation, priseEnCharge)}</b><span>Prise en charge</span></div>
    <div class="delai" style="--c:#EAB308"><b>${duree(debutTrav || priseEnCharge, p.date_resolution)}</b><span>Durée d'intervention</span></div>
    <div class="delai" style="--c:#7C3AED"><b>${duree(p.date_creation, p.date_resolution || (fini ? null : maintenant))}</b><span>${p.date_resolution ? 'Délai total de résolution' : 'Ouverte depuis'}</span></div>
    <div class="delai" style="--c:${horsDelai ? '#DC2626' : '#16A34A'}"><b>${horsDelai ? 'Dépassé' : 'Respecté'}</b><span>SLA</span></div>
  </div>

  <h2>Description du problème</h2>
  <div class="desc">${esc(p.description || '—')}${p.commentaire ? '\n\n' + esc(p.commentaire) : ''}</div>

  <h2>Photos</h2>
  <div class="photos">${galerie('📷 Avant (dépôt)', photoD, '#7C3AED')}${galerie('📷 Après (intervention)', photoR, '#16A34A')}</div>

  ${(p.action_resolution || p.resultat_resolution || p.commentaire_resolution) ? `<h2>Travaux réalisés</h2><div class="resol">${esc(p.action_resolution || p.resultat_resolution || p.commentaire_resolution)}</div>` : ''}
  ${p.motif_rejet ? `<h2>Motif du rejet</h2><div class="resol" style="background:#FEF2F2;border-color:#FECACA">${esc(p.motif_rejet)}</div>` : ''}

  <h2>Chronologie (${etapes.length})</h2>
  <div class="chrono">${etapes.map(e => `<div class="etape" style="--c:${COUL_ETAPE[e.cle] || GRIS}">
    <div class="etape-t">${esc(e.titre)}<small>${dt(e.date)}${e.par ? ' · ' + esc(e.par) : ''}</small></div>
    ${e.detail ? `<div class="etape-x">${esc(e.detail)}</div>` : ''}</div>`).join('') || '<div class="vide">Aucune étape enregistrée</div>'}</div>

  <h2>Visas</h2>
  <div class="visas">
    <div class="visa"><b>Intervenant</b><span>${esc(p.resolu_par_nom || p.affecte_a_nom || 'Nom, date, signature')}</span></div>
    <div class="visa"><b>Occupant / déclarant</b><span>${esc(p.occupant_nom || 'Nom, date, signature')}</span></div>
    <div class="visa"><b>Responsable</b><span>Nom, date, signature</span></div>
  </div>
  <div class="pied"><span><b style="color:${NAVY}">Roxgold SiteLife</b> · Plainte #${p.id}</span><span style="color:${OR}">Document généré automatiquement</span></div>
</div></div></body></html>`
}
