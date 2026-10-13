import { useState, useEffect, useMemo, useCallback } from 'react'
import { ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell, BarChart } from 'recharts'
import { restaurants as api } from '../api'
import { toast } from '../toast'

const NAVY = '#0f2a5c', OR = '#c9972b'
const COUL_REPAS = { petit_dejeuner: '#f97316', dejeuner: '#2563eb', diner: '#7c3aed' }
const LIB_REPAS = { petit_dejeuner: 'Petit-déjeuner', dejeuner: 'Déjeuner', diner: 'Dîner' }
const PALETTE = [NAVY, OR, '#7c3aed', '#2563eb', '#16a34a', '#dc2626', '#0891b2', '#64748b']
const JOURS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

const iso = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
const ajoute = (d, n) => new Date(d.getTime() + n * 86400000)
const fmtJ = (s) => `${s.slice(8, 10)}/${s.slice(5, 7)}`
const fmtLong = (s) => new Date(s + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
const heure = (s) => s ? new Date(s).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '—'

const PERIODES = [
  ['auj', "Aujourd'hui"], ['hier', 'Hier'], ['7j', '7 jours'], ['30j', '30 jours'], ['mois', 'Ce mois'], ['mois_prec', 'Mois précédent'], ['perso', 'Personnalisé'],
]
function bornes(p, perso) {
  const t = new Date()
  if (p === 'auj') return [iso(t), iso(t)]
  if (p === 'hier') return [iso(ajoute(t, -1)), iso(ajoute(t, -1))]
  if (p === '7j') return [iso(ajoute(t, -6)), iso(t)]
  if (p === '30j') return [iso(ajoute(t, -29)), iso(t)]
  if (p === 'mois') return [iso(new Date(t.getFullYear(), t.getMonth(), 1)), iso(t)]
  if (p === 'mois_prec') return [iso(new Date(t.getFullYear(), t.getMonth() - 1, 1)), iso(new Date(t.getFullYear(), t.getMonth(), 0))]
  return perso
}

const carte = { background: '#fff', borderRadius: 14, padding: 16, boxShadow: '0 1px 4px rgba(15,23,42,.08)', border: '1px solid #eef2f7' }
const titreCarte = { fontWeight: 800, fontSize: 13.5, color: '#0f172a', margin: '0 0 10px', display: 'flex', alignItems: 'center', gap: 8 }
const inp = { border: '1px solid #cbd5e1', borderRadius: 8, padding: '7px 10px', fontSize: 13, fontFamily: 'inherit', background: '#fff', color: '#0f172a' }
const btn = (bg, fg = '#fff') => ({ background: bg, color: fg, border: 'none', borderRadius: 8, padding: '8px 14px', fontWeight: 700, fontSize: 12.5, cursor: 'pointer' })

function Delta({ actuel, precedent }) {
  if (!precedent) return <span style={{ fontSize: 11, color: '#94a3b8' }}>pas de comparaison</span>
  const d = Math.round((actuel - precedent) / precedent * 100)
  const c = d > 0 ? '#16a34a' : d < 0 ? '#dc2626' : '#64748b'
  return <span style={{ fontSize: 11.5, fontWeight: 700, color: c }}>{d > 0 ? '▲' : d < 0 ? '▼' : '＝'} {Math.abs(d)} % <span style={{ fontWeight: 500, color: '#94a3b8' }}>vs période préc. ({precedent})</span></span>
}

function Kpi({ label, valeur, sous, couleur }) {
  return (
    <div style={{ ...carte, padding: '14px 16px', borderTop: `4px solid ${couleur}` }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: .6 }}>{label}</div>
      <div style={{ fontSize: 32, fontWeight: 900, color: '#0f172a', lineHeight: 1.1, margin: '4px 0' }}>{valeur}</div>
      <div style={{ minHeight: 16 }}>{sous}</div>
    </div>
  )
}

function ListeBarres({ data, couleur = NAVY, max = 10, vide = 'Aucune donnée' }) {
  const rows = (data || []).slice(0, max)
  if (!rows.length) return <div style={{ fontSize: 12, color: '#94a3b8' }}>{vide}</div>
  const mx = Math.max(...rows.map(r => r[1])) || 1
  const tot = (data || []).reduce((a, r) => a + r[1], 0) || 1
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {rows.map(([nom, n], i) => (
        <div key={nom + i} style={{ display: 'grid', gridTemplateColumns: 'minmax(90px,38%) 1fr 74px', alignItems: 'center', gap: 8, fontSize: 12 }}>
          <span style={{ color: '#334155', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={nom}>{nom}</span>
          <div style={{ background: '#f1f5f9', borderRadius: 4, height: 12 }}><div style={{ width: `${Math.max(3, n / mx * 100)}%`, background: couleur, height: 12, borderRadius: 4 }} /></div>
          <span style={{ fontWeight: 700, textAlign: 'right' }}>{n} <span style={{ color: '#94a3b8', fontWeight: 500 }}>{Math.round(n / tot * 100)}%</span></span>
        </div>))}
    </div>
  )
}

function Heatmap({ serie }) {
  // moyenne de repas par jour de la semaine x repas
  const cases = useMemo(() => {
    const acc = Array.from({ length: 7 }, () => ({ n: 0, petit_dejeuner: 0, dejeuner: 0, diner: 0 }))
    serie.forEach(x => { const w = (new Date(x.date + 'T12:00:00').getDay() + 6) % 7; acc[w].n++; ['petit_dejeuner', 'dejeuner', 'diner'].forEach(k => { acc[w][k] += x[k] }) })
    return acc.map(a => ({ petit_dejeuner: a.n ? a.petit_dejeuner / a.n : 0, dejeuner: a.n ? a.dejeuner / a.n : 0, diner: a.n ? a.diner / a.n : 0, n: a.n }))
  }, [serie])
  const mx = Math.max(1, ...cases.flatMap(c => [c.petit_dejeuner, c.dejeuner, c.diner]))
  return (
    <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 3, fontSize: 12 }}>
      <thead><tr><th />{Object.values(LIB_REPAS).map(l => <th key={l} style={{ fontSize: 11, color: '#64748b', fontWeight: 700 }}>{l}</th>)}</tr></thead>
      <tbody>{cases.map((c, i) => (
        <tr key={i}>
          <td style={{ fontWeight: 700, color: '#475569', paddingRight: 6 }}>{JOURS[i]}</td>
          {['petit_dejeuner', 'dejeuner', 'diner'].map(k => {
            const v = c[k]; const o = v / mx
            return <td key={k} style={{ textAlign: 'center', borderRadius: 6, padding: '8px 4px', fontWeight: 700,
              background: v ? `rgba(15,42,92,${.08 + o * .85})` : '#f8fafc', color: o > .5 ? '#fff' : '#0f172a' }}>{v ? v.toFixed(v < 10 ? 1 : 0) : '·'}</td>
          })}
        </tr>))}</tbody>
    </table>
  )
}

function ModalEmail({ debut, fin, onClose }) {
  const [emails, setEmails] = useState('')
  const [envoi, setEnvoi] = useState(false)
  const envoyer = async () => {
    const liste = emails.split(/[,;\s]+/).filter(Boolean)
    if (!liste.length) return toast.error('Saisissez au moins une adresse')
    setEnvoi(true)
    try { const r = await api.envoyerRapport({ debut, fin, emails: liste }); toast.success(`Rapport envoyé à ${r.data.envoyes} destinataire(s)`); onClose() }
    catch (e) { toast.error(e.response?.data?.error || 'Envoi impossible') }
    finally { setEnvoi(false) }
  }
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.6)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={onClose}>
      <div style={{ background: '#fff', borderRadius: 16, padding: 22, width: 460, maxWidth: '100%' }} onClick={e => e.stopPropagation()}>
        <h3 style={{ margin: '0 0 6px', color: NAVY }}>📧 Envoyer ce rapport par email</h3>
        <p style={{ fontSize: 12.5, color: '#64748b', margin: '0 0 12px' }}>Période {fmtJ(debut)} → {fmtJ(fin)}. Pour un envoi automatique et récurrent : Paramétrage → Rapports par email → type « Restauration ».</p>
        <textarea value={emails} onChange={e => setEmails(e.target.value)} rows={3} placeholder="adresses séparées par une virgule" style={{ ...inp, width: '100%', boxSizing: 'border-box', marginBottom: 12 }} />
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={btn('#e2e8f0', '#334155')}>Annuler</button>
          <button onClick={envoyer} disabled={envoi} style={btn(NAVY)}>{envoi ? '⏳…' : 'Envoyer'}</button>
        </div>
      </div>
    </div>
  )
}

function Rapport({ restos }) {
  const [periode, setPeriode] = useState('7j')
  const [perso, setPerso] = useState([iso(ajoute(new Date(), -6)), iso(new Date())])
  const [resto, setResto] = useState('')
  const [repasF, setRepasF] = useState('')
  const [d, setD] = useState(null)
  const [chargement, setChargement] = useState(false)
  const [mail, setMail] = useState(false)
  const [detail, setDetail] = useState(false)
  const [debut, fin] = bornes(periode, perso)

  const charger = useCallback(async () => {
    setChargement(true)
    try {
      const r = await api.rapport({ debut, fin, ...(resto ? { restaurant: resto } : {}), ...(repasF ? { repas: repasF } : {}) })
      setD(r.data)
    } catch (e) { toast.error(e.response?.data?.error || 'Rapport indisponible'); setD(null) }
    finally { setChargement(false) }
  }, [debut, fin, resto, repasF])
  useEffect(() => { charger() }, [charger])

  const csv = () => {
    if (!d) return
    const L = [['RAPPORT RESTAURATION', `${debut} → ${fin}`], [],
      ['Date', 'Petit-déjeuner', 'Déjeuner', 'Dîner', 'Total', 'Personnes', 'Chambres occupées', 'Couverture %'],
      ...d.serie.map(x => [x.date, x.petit_dejeuner, x.dejeuner, x.diner, x.total, x.personnes, x.occupation ?? '', x.couverture ?? '']), [],
      ['Restaurant', 'Total', 'Petit-déj.', 'Déjeuner', 'Dîner', 'Superviseurs'], ...d.restaurants.map(r => [r.nom, r.total, r.petit_dejeuner, r.dejeuner, r.diner, r.superviseurs.join(' / ')]), [],
      ['Superviseur', 'Scans', 'Restaurants', '1er scan', 'Dernier scan'], ...d.superviseurs.map(x => [x.nom, x.scans, x.restaurants.join(' / '), heure(x.premier), heure(x.dernier)]), [],
      ['Entité', 'Repas'], ...(d.par_entite.types || []), [], ['Département Roxgold', 'Repas'], ...(d.par_entite.departements || []), [],
      ['Sous-traitant', 'Repas'], ...(d.par_entite.soustraitants || []), [], ['Visiteurs', 'Repas'], ...(d.par_entite.visiteurs || []), [], ['Société', 'Repas'], ...d.par_societe]
    const blob = new Blob(['﻿' + L.map(l => l.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(';')).join('\n')], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `restauration_${debut}_${fin}.csv`; a.click()
  }

  const sat = d?.satisfaction
  const donut = (d?.par_entite?.types || []).map(([name, value]) => ({ name, value }))
  const serie = (d?.serie || []).map(x => ({ ...x, jour: fmtJ(x.date) }))
  const avecCouv = serie.some(x => x.couverture != null)

  return (
    <div>
      <style>{`@media print { .no-print { display:none !important } body { background:#fff } }`}</style>
      {/* ── Filtres ── */}
      <div className="no-print" style={{ ...carte, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14, position: 'sticky', top: 0, zIndex: 20 }}>
        {PERIODES.map(([k, l]) => (
          <button key={k} onClick={() => setPeriode(k)} style={{ ...btn(periode === k ? NAVY : '#eef2f7', periode === k ? '#fff' : '#334155'), padding: '7px 12px' }}>{l}</button>))}
        {periode === 'perso' && <>
          <input type="date" value={perso[0]} onChange={e => setPerso([e.target.value, perso[1]])} style={inp} />
          <span>→</span>
          <input type="date" value={perso[1]} onChange={e => setPerso([perso[0], e.target.value])} style={inp} /></>}
        <span style={{ width: 1, height: 24, background: '#e2e8f0' }} />
        <select value={resto} onChange={e => setResto(e.target.value)} style={inp}>
          <option value="">Tous les restaurants</option>{restos.map(r => <option key={r.id} value={r.id}>{r.nom}</option>)}</select>
        <select value={repasF} onChange={e => setRepasF(e.target.value)} style={inp}>
          <option value="">Tous les repas</option>{Object.entries(LIB_REPAS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
        <span style={{ flex: 1 }} />
        <button onClick={charger} style={btn('#eef2f7', '#334155')}>🔄</button>
        <button onClick={csv} disabled={!d} style={btn('#16a34a')}>📥 CSV</button>
        <button onClick={() => window.print()} style={btn('#475569')}>🖨️ PDF / Imprimer</button>
        <button onClick={() => setMail(true)} style={btn(OR)}>📧 Envoyer par email</button>
      </div>
      {mail && <ModalEmail debut={debut} fin={fin} onClose={() => setMail(false)} />}
      {chargement && !d && <div style={{ textAlign: 'center', padding: 40, fontSize: 28 }}>⏳</div>}

      {d && (<div style={{ opacity: chargement ? .55 : 1, transition: 'opacity .15s' }}>
        <div style={{ fontSize: 12.5, color: '#64748b', margin: '0 0 10px' }}>
          Période <b>{fmtJ(d.debut)} → {fmtJ(d.fin)}</b> ({d.nb_jours} jour{d.nb_jours > 1 ? 's' : ''}, {d.jours_actifs} avec des scans)
        </div>

        {/* ── Alertes ── */}
        {d.alertes.length > 0 && (
          <div style={{ ...carte, marginBottom: 14, borderLeft: `5px solid ${d.alertes.some(a => a.niveau === 'rouge') ? '#dc2626' : '#f59e0b'}`, background: '#fffbeb' }}>
            <div style={titreCarte}>⚠️ À surveiller ({d.alertes.length})</div>
            {d.alertes.map((a, i) => <div key={i} style={{ fontSize: 12.5, color: a.niveau === 'rouge' ? '#b91c1c' : '#92400e', margin: '3px 0' }}>• {a.texte}</div>)}
          </div>)}

        {/* ── KPI ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))', gap: 12, marginBottom: 14 }}>
          <Kpi label="Repas servis" valeur={d.total} couleur={NAVY} sous={<Delta actuel={d.total} precedent={d.precedent.total} />} />
          <Kpi label="Moyenne / jour" valeur={d.moyenne_par_jour} couleur="#2563eb" sous={<span style={{ fontSize: 11.5, color: '#64748b' }}>{d.moyenne_jour_actif} par jour actif</span>} />
          <Kpi label="Personnes distinctes" valeur={d.personnes_uniques} couleur="#16a34a" sous={<Delta actuel={d.personnes_uniques} precedent={d.precedent.personnes_uniques} />} />
          <Kpi label="Couverture" valeur={d.couverture != null ? `${d.couverture} %` : '—'} couleur={OR}
            sous={<span style={{ fontSize: 11.5, color: '#64748b' }} title="repas servis ÷ (chambres occupées × 3 repas)">repas ÷ (chambres occupées × 3)</span>} />
          <Kpi label="Satisfaction" valeur={sat.moyenne ? `${sat.moyenne}/5` : '—'} couleur="#f59e0b" sous={<span style={{ fontSize: 11.5, color: '#64748b' }}>{sat.nb} avis</span>} />
          <Kpi label="Pic" valeur={d.pic_jour ? d.pic_jour.total : '—'} couleur="#7c3aed"
            sous={<span style={{ fontSize: 11.5, color: '#64748b' }}>{d.pic_jour ? fmtLong(d.pic_jour.date) : ''}{d.pic_heure ? ` · pointe ${d.pic_heure[0]}` : ''}</span>} />
        </div>

        {/* ── Courbe quotidienne ── */}
        <div style={{ ...carte, marginBottom: 14 }}>
          <div style={titreCarte}>📈 Repas par jour {avecCouv && <span style={{ fontWeight: 500, fontSize: 11.5, color: '#64748b' }}>— et taux de couverture (axe de droite)</span>}</div>
          {d.total === 0 ? <div style={{ padding: 30, textAlign: 'center', color: '#94a3b8' }}>Aucun repas scanné sur cette période.</div> : (
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={serie}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
                <XAxis dataKey="jour" fontSize={11} interval="preserveStartEnd" />
                <YAxis yAxisId="n" allowDecimals={false} fontSize={11} />
                {avecCouv && <YAxis yAxisId="p" orientation="right" unit="%" fontSize={11} domain={[0, 'auto']} />}
                <Tooltip />
                <Legend />
                <Bar yAxisId="n" dataKey="petit_dejeuner" name="Petit-déjeuner" stackId="r" fill={COUL_REPAS.petit_dejeuner} />
                <Bar yAxisId="n" dataKey="dejeuner" name="Déjeuner" stackId="r" fill={COUL_REPAS.dejeuner} />
                <Bar yAxisId="n" dataKey="diner" name="Dîner" stackId="r" fill={COUL_REPAS.diner} radius={[4, 4, 0, 0]} />
                {avecCouv && <Line yAxisId="p" type="monotone" dataKey="couverture" name="Couverture %" stroke="#dc2626" strokeWidth={2} dot={false} connectNulls />}
              </ComposedChart>
            </ResponsiveContainer>)}
        </div>

        {/* ── Restaurants ── */}
        <div style={{ ...titreCarte, margin: '18px 0 8px', fontSize: 15 }}>🍽️ Par restaurant</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 12, marginBottom: 14 }}>
          {d.restaurants.map((r, i) => (
            <div key={r.nom} style={{ ...carte, borderTop: `4px solid ${PALETTE[i % PALETTE.length]}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <b style={{ fontSize: 14, color: '#0f172a' }}>{r.nom}</b>
                <span style={{ fontSize: 26, fontWeight: 900, color: NAVY }}>{r.total}</span>
              </div>
              <div style={{ background: '#f1f5f9', borderRadius: 4, height: 8, margin: '8px 0' }}><div style={{ width: `${r.part}%`, background: PALETTE[i % PALETTE.length], height: 8, borderRadius: 4 }} /></div>
              <div style={{ display: 'flex', gap: 10, fontSize: 12, color: '#475569', flexWrap: 'wrap' }}>
                {['petit_dejeuner', 'dejeuner', 'diner'].map(k => <span key={k} style={{ color: COUL_REPAS[k], fontWeight: 700 }}>{LIB_REPAS[k]} {r[k]}</span>)}
              </div>
              <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 8 }}>{r.part} % du total · {r.moyenne_par_jour}/jour{r.dernier_scan ? ` · dernier scan ${heure(r.dernier_scan)}` : ''}</div>
              <div style={{ fontSize: 11.5, marginTop: 4, color: r.superviseurs.length || r.id === null ? '#334155' : '#dc2626' }}>
                👨‍🍳 {r.id === null ? '—' : r.superviseurs.length ? r.superviseurs.join(', ') : 'Aucun superviseur affecté'}</div>
            </div>))}
        </div>

        {/* ── Affluence ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(380px,1fr))', gap: 12, marginBottom: 14 }}>
          <div style={carte}>
            <div style={titreCarte}>🔥 Jour de la semaine × repas <span style={{ fontWeight: 500, fontSize: 11.5, color: '#64748b' }}>(moyenne de repas / jour)</span></div>
            <Heatmap serie={d.serie} />
          </div>
          <div style={carte}>
            <div style={titreCarte}>🕒 Affluence par heure</div>
            {d.par_heure.length ? (
              <ResponsiveContainer width="100%" height={230}>
                <BarChart data={d.par_heure.map(([h, n]) => ({ h, n }))}><CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" /><XAxis dataKey="h" fontSize={11} /><YAxis allowDecimals={false} fontSize={11} /><Tooltip />
                  <Bar dataKey="n" name="Repas" fill="#16a34a" radius={[4, 4, 0, 0]} /></BarChart>
              </ResponsiveContainer>) : <div style={{ color: '#94a3b8', fontSize: 12 }}>Aucune donnée</div>}
          </div>
        </div>

        {/* ── Entités ── */}
        <div style={{ ...titreCarte, margin: '18px 0 8px', fontSize: 15 }}>🏢 Par entité</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))', gap: 12, marginBottom: 14 }}>
          <div style={carte}>
            <div style={titreCarte}>Répartition</div>
            {donut.length ? (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart><Pie data={donut} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={2} label={({ name, percent }) => `${name} ${Math.round(percent * 100)}%`} labelLine={false} fontSize={11}>
                  {donut.map((_, i) => <Cell key={i} fill={['#2563eb', OR, '#7c3aed'][i % 3]} />)}</Pie><Tooltip /></PieChart>
              </ResponsiveContainer>) : <div style={{ color: '#94a3b8', fontSize: 12 }}>Aucune donnée</div>}
          </div>
          <div style={carte}><div style={titreCarte}>Employés Roxgold — par département</div><ListeBarres data={d.par_entite.departements} couleur="#2563eb" /></div>
          <div style={carte}><div style={titreCarte}>Sous-traitants — par entreprise</div><ListeBarres data={d.par_entite.soustraitants} couleur={OR} max={12} /></div>
          <div style={carte}><div style={titreCarte}>Visiteurs — par département</div><ListeBarres data={d.par_entite.visiteurs} couleur="#7c3aed" /></div>
        </div>

        {/* ── Superviseurs + sociétés ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(420px,1fr))', gap: 12, marginBottom: 14 }}>
          <div style={carte}>
            <div style={titreCarte}>👨‍🍳 Superviseurs</div>
            {d.superviseurs.length ? (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                <thead><tr style={{ color: '#64748b', textAlign: 'left', fontSize: 11 }}><th style={{ padding: 5 }}>Nom</th><th>Restaurant</th><th style={{ textAlign: 'right' }}>Scans</th><th style={{ textAlign: 'right' }}>1er → dernier</th></tr></thead>
                <tbody>{d.superviseurs.map(x => (
                  <tr key={x.nom} style={{ borderTop: '1px solid #eef2f7' }}>
                    <td style={{ padding: 6, fontWeight: 600 }}>{x.nom}</td><td>{x.restaurants.join(', ') || '—'}</td>
                    <td style={{ textAlign: 'right', fontWeight: 800 }}>{x.scans}</td><td style={{ textAlign: 'right', color: '#64748b' }}>{heure(x.premier)} → {heure(x.dernier)}</td></tr>))}</tbody>
              </table>) : <div style={{ color: '#94a3b8', fontSize: 12 }}>Aucun scan</div>}
          </div>
          <div style={carte}><div style={titreCarte}>🏭 Par société (top 10)</div><ListeBarres data={d.par_societe} couleur={NAVY} /></div>
        </div>

        {/* ── Satisfaction ── */}
        <div style={{ ...carte, marginBottom: 14 }}>
          <div style={titreCarte}>⭐ Satisfaction des repas</div>
          {sat.nb ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 16 }}>
              <div>
                {sat.par_repas.map(([l, m, n]) => (
                  <div key={l} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '4px 0', borderBottom: '1px solid #eef2f7' }}>
                    <span>{l}</span><b style={{ color: m >= 4 ? '#16a34a' : m >= 3 ? '#d97706' : '#dc2626' }}>{m}/5 <span style={{ color: '#94a3b8', fontWeight: 500 }}>({n})</span></b></div>))}
              </div>
              <ListeBarres data={sat.distribution.map(([k, n]) => [`${k} ★`, n])} couleur="#f59e0b" />
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#b91c1c', marginBottom: 4 }}>Avis à traiter (note ≤ 2)</div>
                {sat.a_traiter.length ? sat.a_traiter.map((a, i) => (
                  <div key={i} style={{ fontSize: 12, color: '#334155', padding: '3px 0' }}>{fmtJ(a.date)} · {a.repas} · {a.note}★ {a.commentaire && `— « ${a.commentaire} »`}</div>)) : <div style={{ fontSize: 12, color: '#94a3b8' }}>Aucun</div>}
              </div>
            </div>) : <div style={{ color: '#94a3b8', fontSize: 12.5 }}>Aucun avis sur la période.</div>}
        </div>

        {/* ── Détail quotidien ── */}
        <div style={carte}>
          <div style={{ ...titreCarte, cursor: 'pointer' }} onClick={() => setDetail(v => !v)}>📋 Détail quotidien {detail ? '▾' : '▸'}</div>
          {detail && (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                <thead><tr style={{ background: NAVY, color: '#fff' }}>{['Date', 'Petit-déj.', 'Déjeuner', 'Dîner', 'Total', 'Personnes', 'Chambres occ.', 'Couverture'].map(h => <th key={h} style={{ padding: 7, textAlign: h === 'Date' ? 'left' : 'right' }}>{h}</th>)}</tr></thead>
                <tbody>{d.serie.map((x, i) => (
                  <tr key={x.date} style={{ background: i % 2 ? '#f8fafc' : '#fff', borderBottom: '1px solid #eef2f7' }}>
                    <td style={{ padding: 6, textTransform: 'capitalize' }}>{fmtLong(x.date)}</td>
                    {[x.petit_dejeuner, x.dejeuner, x.diner].map((v, j) => <td key={j} style={{ textAlign: 'right' }}>{v}</td>)}
                    <td style={{ textAlign: 'right', fontWeight: 800 }}>{x.total}</td><td style={{ textAlign: 'right' }}>{x.personnes}</td>
                    <td style={{ textAlign: 'right' }}>{x.occupation ?? '—'}</td><td style={{ textAlign: 'right' }}>{x.couverture != null ? `${x.couverture} %` : '—'}</td></tr>))}</tbody>
              </table>
            </div>)}
        </div>
      </div>)}
    </div>
  )
}


// Tableau de bord restauration : vit dans la page Restauration (onglet « Tableau de bord »).
export default function RestoTableauDeBord() {
  const [restos, setRestos] = useState([])
  useEffect(() => { api.list().then(r => setRestos((r.data || []).filter(x => x.actif))).catch(() => {}) }, [])
  return <Rapport restos={restos} />
}
