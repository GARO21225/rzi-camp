// Tableau de bord des plaintes : KPI cliquables + répartitions cliquables, filtres période/catégorie/
// résidence/responsable/priorité. Un clic sur un indicateur filtre aussi la liste située dessous.
const NAVY = '#0F2A5C', OR = '#D4A017'
const PRIO = { critique: ['Critique', '#DC2626'], haute: ['Haute', '#F97316'], moyenne: ['Moyenne', '#CA8A04'], basse: ['Basse', '#16A34A'] }

const fmtH = (h) => h == null ? '—' : h < 48 ? `${String(h).replace('.', ',')} h` : `${(h / 24).toFixed(1).replace('.', ',')} j`

function Kpi({ label, valeur, couleur, actif, onClick, sous }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={!!actif}
      style={{ textAlign: 'left', cursor: onClick ? 'pointer' : 'default', background: actif ? `${couleur}12` : '#fff', border: `1px solid ${actif ? couleur : '#D8DEE9'}`,
        borderTop: `3px solid ${couleur}`, borderRadius: 10, padding: '10px 12px', minWidth: 104, flexShrink: 0, transition: 'transform .15s, box-shadow .15s',
        boxShadow: actif ? `0 4px 14px ${couleur}33` : 'none', fontFamily: 'inherit' }}>
      <div style={{ fontSize: 22, fontWeight: 800, color: couleur, fontFamily: "'Barlow Condensed', sans-serif", lineHeight: 1.1 }}>{valeur}</div>
      <div style={{ fontSize: 10, color: '#5B6B86', textTransform: 'uppercase', fontWeight: 700 }}>{label}</div>
      {sous && <div style={{ fontSize: 10, color: '#94a3b8' }}>{sous}</div>}
    </button>
  )
}

function Barres({ titre, lignes, couleur, actif, onClick }) {
  const max = Math.max(1, ...lignes.map(l => l.n))
  return (
    <div style={{ background: '#fff', border: '1px solid #D8DEE9', borderRadius: 12, padding: 12, minWidth: 0 }}>
      <div style={{ fontSize: 12, fontWeight: 800, color: NAVY, marginBottom: 8 }}>{titre}</div>
      {lignes.length === 0 ? <div style={{ fontSize: 12, color: '#94a3b8' }}>Aucune donnée</div> : lignes.map(l => (
        <button key={l.cle} type="button" onClick={onClick ? () => onClick(l.cle) : undefined}
          style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', background: actif === l.cle ? '#FFF8E1' : 'none', border: 'none', borderRadius: 6, padding: '3px 4px', cursor: onClick ? 'pointer' : 'default', fontFamily: 'inherit' }}>
          <span style={{ flex: '0 0 38%', textAlign: 'left', fontSize: 11.5, color: '#334155', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.label}</span>
          <span style={{ flex: 1, background: '#F3F5F9', borderRadius: 4, height: 12, overflow: 'hidden' }}>
            <span style={{ display: 'block', height: 12, width: `${Math.max(4, (l.n / max) * 100)}%`, background: l.couleur || couleur, borderRadius: 4, transition: 'width .3s' }} />
          </span>
          <span style={{ flex: '0 0 26px', textAlign: 'right', fontSize: 11.5, fontWeight: 800, color: NAVY }}>{l.n}</span>
        </button>
      ))}
    </div>
  )
}

export default function PlaintesDashboard({ data, filtres, setFiltres, categories, agents, statutLabels, statutColors, isMobile }) {
  if (!data) return null
  const f = filtres
  const maj = (k, v) => setFiltres(x => ({ ...x, [k]: x[k] === v ? '' : v }))   // 2e clic = désactive
  const champ = { padding: '6px 8px', borderRadius: 8, border: '1px solid #D8DEE9', fontSize: 12, background: '#fff', fontFamily: 'inherit', minWidth: 0 }
  const actifs = Object.entries(f).filter(([, v]) => v).length
  const jours = data.par_jour || []
  const maxJ = Math.max(1, ...jours.map(j => j.n))

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12, background: '#F3F5F9', border: '1px solid #D8DEE9', borderRadius: 12, padding: 10 }}>
        <label style={{ fontSize: 11, color: '#5B6B86', fontWeight: 700 }}>Du <input type="date" value={f.du} onChange={e => setFiltres(x => ({ ...x, du: e.target.value }))} style={champ} /></label>
        <label style={{ fontSize: 11, color: '#5B6B86', fontWeight: 700 }}>Au <input type="date" value={f.au} onChange={e => setFiltres(x => ({ ...x, au: e.target.value }))} style={champ} /></label>
        <select value={f.categorie} onChange={e => setFiltres(x => ({ ...x, categorie: e.target.value }))} style={champ}>
          <option value="">Toutes catégories</option>
          {Object.keys(categories).map(c => <option key={c} value={c}>{c.replace('_', ' ')}</option>)}
        </select>
        <select value={f.priorite} onChange={e => setFiltres(x => ({ ...x, priorite: e.target.value }))} style={champ}>
          <option value="">Toutes priorités</option>
          {Object.entries(PRIO).map(([k, [l]]) => <option key={k} value={k}>{l}</option>)}
        </select>
        <select value={f.responsable} onChange={e => setFiltres(x => ({ ...x, responsable: e.target.value }))} style={champ}>
          <option value="">Tous responsables</option>
          {agents.map(a => <option key={a.id} value={a.id}>{a.nom}</option>)}
        </select>
        <input placeholder="Résidence…" value={f.residence} onChange={e => setFiltres(x => ({ ...x, residence: e.target.value }))} style={{ ...champ, width: 110 }} />
        {actifs > 0 && (
          <button type="button" onClick={() => setFiltres({ du: '', au: '', categorie: '', priorite: '', responsable: '', residence: '', statut: '', retard: false })}
            style={{ marginLeft: 'auto', background: NAVY, color: '#fff', border: 'none', borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
            ✕ Réinitialiser ({actifs})
          </button>
        )}
      </div>

      <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 6, marginBottom: 12 }}>
        <Kpi label="Plaintes" valeur={data.total} couleur={NAVY} />
        <Kpi label="Ouvertes" valeur={data.ouvertes} couleur="#2563EB" />
        <Kpi label="En retard SLA" valeur={data.en_retard} couleur="#DC2626" actif={f.retard} onClick={() => setFiltres(x => ({ ...x, retard: !x.retard }))} />
        <Kpi label="SLA respecté" valeur={data.taux_sla == null ? '—' : `${data.taux_sla}%`} couleur="#16A34A" sous={`${data.sla_depasse_total} dépassé(s)`} />
        <Kpi label="Délai moyen" valeur={fmtH(data.delai_moyen_h)} couleur={OR} />
        <Kpi label="Non affectées" valeur={data.non_affectees} couleur="#F97316" />
        <Kpi label="Réouvertes" valeur={`${data.taux_reouverture}%`} couleur="#7C3AED" />
        {Object.entries(data.par_statut || {}).map(([s, n]) => (
          <Kpi key={s} label={statutLabels[s] || s} valeur={n} couleur={statutColors[s] || '#64748b'} actif={f.statut === s} onClick={() => maj('statut', s)} />
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit,minmax(260px,1fr))', gap: 10 }}>
        <Barres titre="Par catégorie" couleur={NAVY} actif={f.categorie} onClick={k => maj('categorie', k)}
          lignes={(data.par_categorie || []).map(c => ({ cle: c.categorie, label: (c.categorie || '').replace('_', ' '), n: c.n }))} />
        <Barres titre="Par priorité" couleur={NAVY} actif={f.priorite} onClick={k => maj('priorite', k)}
          lignes={Object.entries(data.par_priorite || {}).map(([k, n]) => ({ cle: k, label: PRIO[k]?.[0] || k, n, couleur: PRIO[k]?.[1] }))} />
        <Barres titre="Résidences les plus touchées" couleur={OR} actif={f.residence} onClick={k => setFiltres(x => ({ ...x, residence: x.residence === k ? '' : k }))}
          lignes={(data.residences_les_plus_touchees || []).map(r => ({ cle: r.batiment__residence, label: r.batiment__residence, n: r.n }))} />
        <Barres titre="Charge des responsables (ouvertes)" couleur="#7C3AED"
          lignes={(data.charge_responsables || []).map(r => ({ cle: r.nom, label: r.nom, n: r.n }))} />
      </div>

      <div style={{ background: '#fff', border: '1px solid #D8DEE9', borderRadius: 12, padding: 12, marginTop: 10 }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: NAVY, marginBottom: 8 }}>Dépôts sur 30 jours</div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 70 }}>
          {jours.map(j => (
            <div key={j.date} title={`${new Date(j.date).toLocaleDateString('fr-FR')} : ${j.n}`}
              style={{ flex: 1, height: `${Math.max(3, (j.n / maxJ) * 100)}%`, background: j.n ? NAVY : '#E2E8F0', borderRadius: '3px 3px 0 0' }} />
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#94a3b8', marginTop: 3 }}>
          <span>{jours[0] && new Date(jours[0].date).toLocaleDateString('fr-FR')}</span>
          <span>SLA : {Object.entries(data.sla_heures || {}).map(([k, h]) => `${PRIO[k]?.[0] || k} ${h} h`).join(' · ')}</span>
          <span>{jours.length && new Date(jours[jours.length - 1].date).toLocaleDateString('fr-FR')}</span>
        </div>
      </div>
    </div>
  )
}
