/**
 * ANALYTICS v2 — Tableau de bord intelligence métier
 * Statistiques avancées pour la direction du camp
 */
import React, { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { analyticsAPI } from '../api'
import {
  BarChart, Bar, AreaChart, Area, PieChart, Pie, Cell,
  ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, Legend
} from 'recharts'

const C = { blue:'var(--rzc-navy)', orange:'#f97316', green:'#16a34a', red:'#dc2626', purple:'#7c3aed', gold:'#f0a500', teal:'#0891b2' }

function StatBlock({ label, value, sub, color, icon }) {
  return (
    <div style={{ background:'var(--rzc-white)', border:'1px solid #e2e8f0', borderRadius:14, padding:'16px 18px', borderTop:`3px solid ${color}`, boxShadow:'0 1px 4px rgba(0,0,0,.06)' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
        <div style={{ fontFamily:'monospace', fontSize:34, fontWeight:900, color }}>{value ?? '—'}</div>
        <span style={{ fontSize:24, opacity:.5 }}>{icon}</span>
      </div>
      <div style={{ fontSize:10, color:'var(--rzc-text-4)', textTransform:'uppercase', letterSpacing:1.2, marginTop:5, fontWeight:700 }}>{label}</div>
      {sub && <div style={{ fontSize:11, color:'var(--rzc-text-3)', marginTop:3 }}>{sub}</div>}
    </div>
  )
}


// ── Widget Rapport HSE Sous-traitants ────────────────────────
function RapportHSESousTraitants() {
  const [data, setData] = React.useState([])
  const [loading, setLoading] = React.useState(true)
  const [lastUpdate, setLastUpdate] = React.useState(null)
  const BASE = import.meta?.env?.VITE_API_URL || window.location.origin

  React.useEffect(() => {
    const token = localStorage.getItem('access_token') || ''
    Promise.all([
      fetch(`${BASE}/api/personnel/?page_size=500&type_personnel=sous_traitant`, {headers:{'Authorization':`Bearer ${token}`}}).then(r=>r.json()),
      fetch(`${BASE}/api/maintenance/incidents/?page_size=500`, {headers:{'Authorization':`Bearer ${token}`}}).then(r=>r.json()),
      fetch(`${BASE}/api/personnel/?page_size=500`, {headers:{'Authorization':`Bearer ${token}`}}).then(r=>r.json()),
    ]).then(([stData, incData, allData]) => {
      const soustraitants = stData.results || stData || []
      const incidents = incData.results || incData || []
      const all = allData.results || allData || []

      // Grouper par société
      const bySociete = {}
      soustraitants.forEach(p => {
        const soc = p.societe || 'Sans société'
        if (!bySociete[soc]) bySociete[soc] = {personnel:[], induits:0, incidents:0, epi:0}
        bySociete[soc].personnel.push(p)
        if (p.inductionrecord?.statut === 'valide') bySociete[soc].induits++
      })

      // Compter incidents par société (via résidence)
      incidents.forEach(inc => {
        Object.values(bySociete).forEach(s => {
          if (s.personnel.some(p => inc.titre?.toLowerCase().includes(p.societe?.toLowerCase()||'')))
            s.incidents++
        })
      })

      // EPI réservés (depuis réservations localStorage)
      try {
        const reservations = JSON.parse(localStorage.getItem('rzi_reservations_v3')||'[]')
        const epiRes = reservations.filter(r => r.cat === 'materiels_hse' && r.statut !== 'annulé')
        epiRes.forEach(r => {
          const soc = r.demandeur?.split(' ')[0]
          if (bySociete[soc]) bySociete[soc].epi++
        })
      } catch(e) {}

      const result = Object.entries(bySociete).map(([soc, v]) => ({
        societe: soc,
        total: v.personnel.length,
        induits: v.induits,
        pct_induction: v.personnel.length > 0 ? Math.round(v.induits/v.personnel.length*100) : 0,
        incidents: v.incidents,
        epi: v.epi,
        score: Math.max(0, Math.min(100, Math.round(
          (v.personnel.length > 0 ? v.induits/v.personnel.length * 60 : 0) +
          (v.incidents === 0 ? 30 : Math.max(0, 30 - v.incidents * 10)) +
          (v.epi > 0 ? 10 : 0)
        )))
      })).sort((a,b) => b.score - a.score)

      setData(result)
      setLastUpdate(new Date().toLocaleDateString('fr-FR', {day:'numeric',month:'long'}))
      setLoading(false)
    }).catch(e => { setLoading(false) })
  }, [])

  const getScoreColor = s => s >= 80 ? '#16a34a' : s >= 50 ? '#d97706' : '#dc2626'
  const getScoreLabel = s => s >= 80 ? '✅ Conforme' : s >= 50 ? '⚠️ Partiel' : '❌ Non conforme'

  if (loading) return <div style={{textAlign:'center',padding:40,color:'var(--rzc-text-4)'}}>⏳ Chargement...</div>
  if (!data.length) return <div style={{textAlign:'center',padding:40,color:'var(--rzc-text-4)'}}>Aucun sous-traitant enregistré</div>

  return (
    <div>
      {lastUpdate && (
        <div style={{fontSize:11,color:'var(--rzc-text-4)',marginBottom:12}}>Mis à jour le {lastUpdate}</div>
      )}
      <div style={{overflowX:'auto'}}>
        <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
          <thead>
            <tr style={{background:'var(--rzc-charcoal)',borderBottom:'2px solid #e2e8f0'}}>
              {['Société','Effectif','Induction %','Incidents','EPI','Score Global'].map(h=>(
                <th key={h} style={{padding:'10px 12px',textAlign:'left',fontSize:11,fontWeight:700,color:'var(--rzc-text-3)'}}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row,i) => (
              <tr key={row.societe} style={{borderBottom:'1px solid #f1f5f9',background:i%2===0?'var(--rzc-white)':'#fafafa'}}>
                <td style={{padding:'10px 12px',fontWeight:700}}>{row.societe}</td>
                <td style={{padding:'10px 12px',color:'var(--rzc-text-3)'}}>{row.total}</td>
                <td style={{padding:'10px 12px'}}>
                  <div style={{display:'flex',alignItems:'center',gap:8}}>
                    <div style={{flex:1,background:'var(--rzc-charcoal)',borderRadius:99,height:6,minWidth:60}}>
                      <div style={{background:getScoreColor(row.pct_induction),width:`${row.pct_induction}%`,
                        height:'100%',borderRadius:99}}/>
                    </div>
                    <span style={{fontWeight:700,fontSize:12,color:getScoreColor(row.pct_induction),minWidth:35}}>
                      {row.pct_induction}%
                    </span>
                  </div>
                </td>
                <td style={{padding:'10px 12px'}}>
                  <span style={{color:row.incidents>0?'#dc2626':'#16a34a',fontWeight:700}}>
                    {row.incidents > 0 ? `⚠️ ${row.incidents}` : '✅ 0'}
                  </span>
                </td>
                <td style={{padding:'10px 12px',color:'var(--rzc-text-3)'}}>{row.epi > 0 ? `🦺 ${row.epi}` : '—'}</td>
                <td style={{padding:'10px 12px'}}>
                  <div style={{display:'flex',alignItems:'center',gap:8}}>
                    <div style={{fontWeight:900,fontSize:16,color:getScoreColor(row.score)}}>{row.score}</div>
                    <span style={{fontSize:11,background:getScoreColor(row.score)+'22',
                      color:getScoreColor(row.score),padding:'2px 8px',borderRadius:99,fontWeight:700}}>
                      {getScoreLabel(row.score)}
                    </span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{fontSize:11,color:'var(--rzc-text-4)',marginTop:12}}>
        Score = 60% induction + 30% absence d'incidents + 10% EPI réservés
      </div>
    </div>
  )
}

const STATUT_PARC = { 'Occupé':['Occupées', C.blue], 'Libre':['Libres', C.green], 'Réservé':['Réservées', C.orange], 'Maintenance':['En maintenance', C.red] }
const STATUT_INC = { declare:['Déclarés','#3b82f6'], assigne:['Assignés','#f97316'], en_cours:['En cours','#eab308'], resolu:['Résolus','#16a34a'], cloture:['Clôturés','#64748b'], annule:['Annulés','#cbd5e1'] }
const PRIO = { critique:['Critique','#dc2626'], haute:['Haute','#f97316'], moyenne:['Moyenne','#eab308'], basse:['Basse','#16a34a'] }
const TYPE_PERS = { roxgold:'Roxgold', sous_traitant:'Sous-traitants', visiteur:'Visiteurs' }
const jourCourt = iso => new Date(iso + 'T00:00:00').toLocaleDateString('fr-FR', { day:'numeric', month:'short' })

const Carte = ({ titre, children, span, aide }) => (
  <div style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:14, padding:'18px 20px', boxShadow:'0 1px 4px rgba(0,0,0,.05)', gridColumn: span ? `span ${span}` : undefined, minWidth:0 }}>
    <div style={{ fontWeight:800, fontSize:14, color:'var(--rzc-navy)' }}>{titre}</div>
    {aide && <div style={{ fontSize:11.5, color:'#94a3b8', margin:'2px 0 0' }}>{aide}</div>}
    <div style={{ marginTop:14 }}>{children}</div>
  </div>
)

const Barre = ({ libelle, n, max, couleur, suffixe }) => (
  <div style={{ marginBottom:10 }}>
    <div style={{ display:'flex', justifyContent:'space-between', fontSize:12.5, marginBottom:4, gap:8 }}>
      <span style={{ fontWeight:600, color:'#334155', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{libelle}</span>
      <span style={{ fontWeight:800, color:couleur }}>{n}{suffixe || ''}</span>
    </div>
    <div style={{ height:7, background:'#f1f5f9', borderRadius:20, overflow:'hidden' }}>
      <div style={{ width:`${max ? Math.min(100, n / max * 100) : 0}%`, height:'100%', background:couleur, borderRadius:20 }} />
    </div>
  </div>
)

export default function Analytics() {
  const navigate = useNavigate()
  const [d, setD] = useState(null)
  const [erreur, setErreur] = useState('')
  const [jours, setJours] = useState(30)
  const [tab, setTab] = useState('residence')

  useEffect(() => {
    setErreur('')
    analyticsAPI.get(jours).then(r => setD(r.data)).catch(() => setErreur('Données indisponibles — réessayez.'))
  }, [jours])

  const parcData = useMemo(() => d ? Object.entries(d.parc.par_statut).map(([k, v]) => ({ name:(STATUT_PARC[k] || [k, '#64748b'])[0], v, fill:(STATUT_PARC[k] || [k, '#64748b'])[1] })) : [], [d])
  const tendanceParc = useMemo(() => d ? d.parc.tendance.map(t => ({ ...t, j:jourCourt(t.date) })) : [], [d])
  const tendanceInc = useMemo(() => d ? d.incidents.tendance.map(t => ({ ...t, j:jourCourt(t.date) })) : [], [d])
  const progVoy = useMemo(() => d ? d.voyages.programme.map(t => ({ ...t, j:jourCourt(t.date) })) : [], [d])

  const TABS = [['residence','🏠 Hébergement'], ['personnel','👤 Personnel'], ['incidents','🔧 Maintenance'], ['voyages','✈️ Mobilité'], ['hse','🛡️ Conformité HSE']]
  const tip = { borderRadius:10, fontSize:12 }
  const grille = { display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(min(100%,420px),1fr))', gap:16 }

  return (
    <div className="rzc-page-scope" style={{ padding:'16px 20px', width:'100%', boxSizing:'border-box' }}>
      <div style={{ marginBottom:16, display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:10 }}>
        <div>
          <h2 style={{ fontSize:22, fontWeight:800, color:'var(--rzc-navy)', margin:0 }}>📈 Analytics</h2>
          <p style={{ fontSize:12.5, color:'var(--rzc-text-3)', margin:'4px 0 0' }}>Camp Roxgold Sango · chiffres réels, tendances sur {jours} jours</p>
        </div>
        <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
          {[14, 30, 60].map(n => (
            <button key={n} onClick={() => setJours(n)} style={{ padding:'7px 14px', borderRadius:99, border:'none', cursor:'pointer', fontWeight:700, fontSize:12.5, fontFamily:'inherit',
              background: jours === n ? 'var(--rzc-navy)' : '#e2e8f0', color: jours === n ? '#fff' : '#334155' }}>{n} j</button>))}
          <button onClick={() => navigate('/rapports')} style={{ background:'var(--rzc-navy)', color:'#fff', border:'none', padding:'8px 14px', borderRadius:9, fontSize:12.5, fontWeight:700, cursor:'pointer' }}>📄 Rapports</button>
        </div>
      </div>

      {erreur ? <div style={{ padding:24, background:'#fef2f2', color:'#b91c1c', borderRadius:12 }}>{erreur}</div>
        : !d ? <div style={{ padding:60, textAlign:'center', color:'#94a3b8' }}>⏳ Chargement…</div> : (<>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(170px,1fr))', gap:12, marginBottom:18 }}>
          <StatBlock label="Taux d'occupation" value={`${d.parc.taux}%`} icon="🏠" color={C.blue} sub={`${d.parc.par_statut['Occupé'] || 0} / ${d.parc.total - d.parc.hors_service} chambres exploitables`} />
          <StatBlock label="Chambres libres" value={d.parc.par_statut['Libre'] || 0} icon="✅" color={C.green} sub={d.parc.hors_service ? `${d.parc.hors_service} hors service` : 'Aucune hors service'} />
          <StatBlock label="Incidents ouverts" value={d.incidents.ouverts} icon="🚨" color={C.red} sub={`${d.incidents.critiques_ouverts} critique(s) · ${d.incidents.sla_depasse} SLA dépassé`} />
          <StatBlock label="Personnes enregistrées" value={d.personnel.total} icon="👤" color={C.purple} sub={`${d.personnel.par_type.sous_traitant || 0} sous-traitants`} />
          <StatBlock label="Voyages en cours" value={d.voyages.par_statut.en_voyage || 0} icon="✈️" color={C.orange} sub={`${d.voyages.par_statut.planifie || 0} planifié(s)`} />
        </div>

        <div style={{ display:'flex', gap:6, marginBottom:16, flexWrap:'wrap' }}>
          {TABS.map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)} style={{ padding:'8px 16px', borderRadius:10, border:'1px solid', cursor:'pointer', fontSize:13, fontWeight:700, fontFamily:'inherit',
              background: tab === k ? 'var(--rzc-navy)' : '#fff', color: tab === k ? '#fff' : '#334155', borderColor: tab === k ? 'var(--rzc-navy)' : '#e2e8f0' }}>{l}</button>))}
        </div>

        {tab === 'residence' && (
          <div style={grille}>
            <Carte titre="📊 Répartition du parc" aide={`${d.parc.total} chambres au total`}>
              <ResponsiveContainer width="100%" height={240}>
                <PieChart><Pie data={parcData} cx="50%" cy="50%" innerRadius={60} outerRadius={92} dataKey="v" paddingAngle={3}>{parcData.map((e, i) => <Cell key={i} fill={e.fill} />)}</Pie>
                  <Tooltip formatter={(v, n) => [v + ' chambres', n]} contentStyle={tip} /><Legend iconType="circle" iconSize={10} formatter={(v, e) => `${v} : ${e.payload.v}`} /></PieChart>
              </ResponsiveContainer>
            </Carte>
            <Carte titre="📈 Chambres occupées par nuit" aide="Reconstitué depuis l'historique des occupations">
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={tendanceParc}><defs><linearGradient id="gocc" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#1e3a8a" stopOpacity={.35} /><stop offset="100%" stopColor="#1e3a8a" stopOpacity={0} /></linearGradient></defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" /><XAxis dataKey="j" tick={{ fontSize:10 }} interval="preserveStartEnd" minTickGap={24} /><YAxis tick={{ fontSize:10 }} allowDecimals={false} />
                  <Tooltip contentStyle={tip} /><Area type="monotone" dataKey="occupees" name="Occupées" stroke="#1e3a8a" strokeWidth={2.5} fill="url(#gocc)" /></AreaChart>
              </ResponsiveContainer>
            </Carte>
            <Carte titre="🏗️ Occupation par bloc" span={2} aide="Occupées / total, du plus grand au plus petit bloc">
              <ResponsiveContainer width="100%" height={Math.max(220, Math.min(d.parc.par_bloc.length, 14) * 26)}>
                <BarChart data={d.parc.par_bloc.slice(0, 14)} layout="vertical" margin={{ left:10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} /><XAxis type="number" tick={{ fontSize:10 }} allowDecimals={false} /><YAxis type="category" dataKey="bloc" width={90} tick={{ fontSize:11 }} />
                  <Tooltip contentStyle={tip} /><Legend /><Bar dataKey="occupes" name="Occupées" stackId="a" fill={C.blue} /><Bar dataKey="total" name="Total" fill="#cbd5e1" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Carte>
          </div>)}

        {tab === 'personnel' && (
          <div style={grille}>
            <Carte titre="👥 Par type de personnel">
              {Object.entries(d.personnel.par_type).sort((a, b) => b[1] - a[1]).map(([k, n], i) => <Barre key={k} libelle={TYPE_PERS[k] || k} n={n} max={d.personnel.total} couleur={[C.blue, C.orange, C.purple, C.teal][i % 4]} suffixe={` · ${Math.round(n / d.personnel.total * 100)}%`} />)}
            </Carte>
            <Carte titre="🏢 Principales sociétés" aide="Top 8 par effectif enregistré">
              {d.personnel.par_societe.map(s => <Barre key={s.societe} libelle={s.societe} n={s.n} max={d.personnel.par_societe[0]?.n || 1} couleur={C.blue} />)}
            </Carte>
          </div>)}

        {tab === 'incidents' && (
          <div style={grille}>
            <Carte titre="📊 Créés vs résolus" aide={`Sur ${jours} jours · délai moyen de résolution : ${d.incidents.delai_moyen_h != null ? (d.incidents.delai_moyen_h >= 48 ? `${(d.incidents.delai_moyen_h / 24).toFixed(1)} j` : `${d.incidents.delai_moyen_h} h`) : '—'}`}>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={tendanceInc}><CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" /><XAxis dataKey="j" tick={{ fontSize:10 }} interval="preserveStartEnd" minTickGap={24} /><YAxis tick={{ fontSize:10 }} allowDecimals={false} />
                  <Tooltip contentStyle={tip} /><Legend /><Bar dataKey="crees" name="Créés" fill={C.red} radius={[3, 3, 0, 0]} /><Bar dataKey="resolus" name="Résolus" fill={C.green} radius={[3, 3, 0, 0]} /></BarChart>
              </ResponsiveContainer>
            </Carte>
            <Carte titre="🎯 Par priorité" aide={`${d.incidents.total} incident(s) au total`}>
              {Object.entries(PRIO).map(([k, [l, c]]) => <Barre key={k} libelle={l} n={d.incidents.par_priorite[k] || 0} max={d.incidents.total} couleur={c} />)}
            </Carte>
            <Carte titre="📋 Par statut">
              {Object.entries(STATUT_INC).map(([k, [l, c]]) => <Barre key={k} libelle={l} n={d.incidents.par_statut[k] || 0} max={d.incidents.total} couleur={c} />)}
            </Carte>
            <Carte titre="🔧 Catégories les plus fréquentes">
              {d.incidents.par_categorie.length ? d.incidents.par_categorie.map(c => <Barre key={c.categorie} libelle={c.categorie} n={c.n} max={d.incidents.par_categorie[0].n} couleur={C.blue} />) : <div style={{ color:'#94a3b8', fontSize:12.5 }}>Aucun incident enregistré</div>}
            </Carte>
          </div>)}

        {tab === 'voyages' && (
          <div style={grille}>
            <Carte titre="🗓️ Départs et retours — 14 prochains jours" span={2} aide="Voyages planifiés et retours attendus">
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={progVoy}><CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" /><XAxis dataKey="j" tick={{ fontSize:10 }} /><YAxis tick={{ fontSize:10 }} allowDecimals={false} />
                  <Tooltip contentStyle={tip} /><Legend /><Bar dataKey="departs" name="Départs" fill={C.orange} radius={[3, 3, 0, 0]} /><Bar dataKey="retours" name="Retours" fill={C.green} radius={[3, 3, 0, 0]} /></BarChart>
              </ResponsiveContainer>
            </Carte>
            <Carte titre="✈️ Par statut" aide={`${d.voyages.total} voyage(s) au total`}>
              {[['planifie', 'Planifiés', C.gold], ['en_voyage', 'En voyage', C.orange], ['retour', 'Retournés', C.green], ['annule', 'Annulés', C.red]].map(([k, l, c]) => <Barre key={k} libelle={l} n={d.voyages.par_statut[k] || 0} max={d.voyages.total} couleur={c} />)}
            </Carte>
          </div>)}

        {tab === 'hse' && (
          <Carte titre="🛡️ Conformité HSE par société sous-traitante" aide="Induction · incidents · EPI · score global">
            <RapportHSESousTraitants />
          </Carte>)}
      </>)}
    </div>
  )
}
