import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store'
import * as api from '../api'

const BASE = import.meta?.env?.VITE_API_URL || 'https://rzi-camp-backend.onrender.com'
const h = () => ({ Authorization: `Bearer ${localStorage.getItem('access_token')||''}`  })

// ── Helpers ──────────────────────────────────────────────────
function kpiColor(v, thresholds) {
  if (!thresholds) return '#1e3a8a'
  if (v >= thresholds[1]) return '#16a34a'
  if (v >= thresholds[0]) return '#ea580c'
  return '#dc2626'
}

function KpiCard({ icon, label, value, sub, accent = '#1e3a8a', trend, trendUp }) {
  return (
    <div style={{
      background: '#fff',
      borderRadius: 12,
      border: '1px solid #e2e8f0',
      padding: '18px 20px',
      boxShadow: '0 1px 3px rgba(0,0,0,.06)',
    }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
        <div>
          <p style={{ fontSize:11, fontWeight:600, textTransform:'uppercase', letterSpacing:'.5px', color:'#64748b', marginBottom:8 }}>{label}</p>
          <p style={{ fontSize:26, fontWeight:800, color:'#0f172a', lineHeight:1 }}>{value ?? '—'}</p>
          {sub && <p style={{ fontSize:11, color:'#94a3b8', marginTop:5 }}>{sub}</p>}
          {trend && (
            <p style={{ fontSize:11, marginTop:6, fontWeight:600,
              color: trendUp ? '#16a34a' : trendUp === false ? '#dc2626' : '#64748b',
              display:'flex', alignItems:'center', gap:3 }}>
              {trendUp === true ? '▲' : trendUp === false ? '▼' : '●'} {trend}
            </p>
          )}
        </div>
        <div style={{
          width:40, height:40, borderRadius:10,
          background: accent + '18',
          display:'flex', alignItems:'center', justifyContent:'center',
          fontSize:20,
        }}>
          {icon}
        </div>
      </div>
    </div>
  )
}

function Badge({ children, color = '#16a34a', bg = '#dcfce7' }) {
  return (
    <span style={{ background:bg, color, padding:'3px 10px', borderRadius:99,
      fontSize:11, fontWeight:700, display:'inline-block' }}>
      {children}
    </span>
  )
}

function SectionCard({ title, subtitle, action, children }) {
  return (
    <div style={{ background:'#fff', borderRadius:12, border:'1px solid #e2e8f0',
      boxShadow:'0 1px 3px rgba(0,0,0,.06)' }}>
      <div style={{ padding:'16px 20px', borderBottom:'1px solid #f1f5f9',
        display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div>
          <p style={{ fontSize:14, fontWeight:700, color:'#0f172a' }}>{title}</p>
          {subtitle && <p style={{ fontSize:12, color:'#94a3b8', marginTop:2 }}>{subtitle}</p>}
        </div>
        {action && <div>{action}</div>}
      </div>
      <div style={{ padding:'16px 20px' }}>{children}</div>
    </div>
  )
}

function ProgressBar({ value, color = '#1e3a8a', height = 6 }) {
  const pct = Math.min(100, Math.max(0, value || 0))
  return (
    <div style={{ height, background:'#f1f5f9', borderRadius:99, overflow:'hidden' }}>
      <div style={{ width:`${pct}%`, height:'100%', background:color,
        borderRadius:99, transition:'width .6s ease' }} />
    </div>
  )
}

function AlerteItem({ icon, title, desc, color, bg }) {
  return (
    <div style={{ display:'flex', gap:10, padding:'10px 12px', borderRadius:9,
      background:bg, marginBottom:8, alignItems:'flex-start' }}>
      <span style={{ fontSize:18, flexShrink:0 }}>{icon}</span>
      <div>
        <p style={{ fontSize:12, fontWeight:700, color }}>{title}</p>
        <p style={{ fontSize:11, color:'#64748b', marginTop:2 }}>{desc}</p>
      </div>
    </div>
  )
}

// ── Composant principal ───────────────────────────────────────
export default function Dashboard() {
  const { user } = useStore()
  const navigate = useNavigate()
  const [stats,    setStats]    = useState(null)
  const [incStats, setIncStats] = useState(null)
  const [voyStats, setVoyStats] = useState(null)
  const [personnel,setPersonnel]= useState([])
  const [notifs,   setNotifs]   = useState([])
  const [loading,  setLoading]  = useState(true)
  const [lastSync, setLastSync] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [s, inc, voy, pers, n] = await Promise.allSettled([
        fetch(`${BASE}/api/batiments/stats/`,           { headers:h() }).then(r=>r.json()),
        fetch(`${BASE}/api/incidents/stats-sql/`,       { headers:h() }).then(r=>r.json()),
        fetch(`${BASE}/api/voyages/stats/`,             { headers:h() }).then(r=>r.json()),
        fetch(`${BASE}/api/personnel/?page_size=200`,   { headers:h() }).then(r=>r.json()),
        fetch(`${BASE}/api/notifications/compteur/`,   { headers:h() }).then(r=>r.json()),
      ])
      if (s.status   === 'fulfilled') setStats(s.value)
      if (inc.status === 'fulfilled') setIncStats(inc.value)
      if (voy.status === 'fulfilled') setVoyStats(voy.value)
      if (pers.status === 'fulfilled') {
        const list = pers.value?.results || pers.value || []
        setPersonnel(list)
      }
      if (n.status === 'fulfilled') setNotifs(n.value?.notifications || [])
      setLastSync(new Date())
    } catch(e) {}
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])
  useEffect(() => { const iv = setInterval(load, 60000); return () => clearInterval(iv) }, [load])

  // Calculs induction
  const totalPerso = personnel.length
  const induits    = personnel.filter(p=>p.inductionrecord?.statut==='valide').length
  const enCours    = personnel.filter(p=>p.inductionrecord?.statut==='en_cours').length
  const tauxInd    = totalPerso ? Math.round(induits/totalPerso*100) : 0

  // Conformité par société
  const parSociete = {}
  personnel.forEach(p => {
    const s = p.societe || 'Autre'
    if (!parSociete[s]) parSociete[s] = {total:0,induits:0}
    parSociete[s].total++
    if (p.inductionrecord?.statut==='valide') parSociete[s].induits++
  })
  const conformite = Object.entries(parSociete)
    .map(([s,v])=>({s,pct:Math.round(v.induits/v.total*100),total:v.total,induits:v.induits}))
    .sort((a,b)=>b.pct-a.pct).slice(0,6)

  const taux = stats?.taux_occupation ?? null
  const unreadNotifs = notifs.filter(n=>!n.lu)

  return (
    <div style={{ padding:'24px', background:'#f8fafc', minHeight:'100vh' }}>

      {/* ── Header ── */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24 }}>
        <div>
          <h1 style={{ fontSize:22, fontWeight:800, color:'#0f172a', margin:0 }}>
            Tableau de bord
          </h1>
          <p style={{ fontSize:12, color:'#94a3b8', marginTop:4 }}>
            Résidence Roxgold Sango · {lastSync
              ? `Sync ${lastSync.toLocaleTimeString('fr-FR')}`
              : 'Chargement...'}
          </p>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ display:'flex', alignItems:'center', gap:6, background:'#f0fdf4',
            border:'1px solid #bbf7d0', borderRadius:99, padding:'5px 12px',
            fontSize:11, fontWeight:700, color:'#16a34a' }}>
            <span style={{ width:6, height:6, borderRadius:'50%', background:'#16a34a',
              animation:'pulse 2s infinite' }}/>
            En direct
          </div>
          <button onClick={load} disabled={loading}
            style={{ background:'#0f172a', color:'#fff', border:'none', borderRadius:9,
              padding:'8px 16px', fontSize:12, fontWeight:700, cursor:'pointer',
              opacity:loading?0.6:1 }}>
            {loading ? '⏳' : '🔄'} Actualiser
          </button>
        </div>
      </div>

      {/* ── KPIs ── */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:14, marginBottom:20 }}>
        <KpiCard icon="🏠" label="Taux d'occupation" accent="#1e3a8a"
          value={taux !== null ? `${taux}%` : '—'}
          sub={stats ? `${stats.occupes||0} / ${(stats.occupes||0)+(stats.libres||0)} résidences` : null}
          trend={taux > 80 ? 'Élevé' : 'Normal'}
          trendUp={taux > 80 ? null : true}
        />
        <KpiCard icon="👥" label="Personnel actif" accent="#7c3aed"
          value={totalPerso || '—'}
          sub={`${voyStats?.en_voyage||0} en déplacement`}
        />
        <KpiCard icon="🚨" label="Incidents ouverts" accent="#dc2626"
          value={(incStats?.declares||0)+(incStats?.en_cours||0) || 0}
          sub={incStats?.critiques ? `${incStats.critiques} critique(s)` : 'Aucun critique'}
          trend={incStats?.critiques > 0 ? 'Attention' : 'Normal'}
          trendUp={incStats?.critiques > 0 ? false : true}
        />
        <KpiCard icon="🎓" label="Induction QHSE" accent="#059669"
          value={`${tauxInd}%`}
          sub={`${induits} induits · ${enCours} en cours`}
          trend={tauxInd >= 80 ? 'Conforme' : 'À améliorer'}
          trendUp={tauxInd >= 80}
        />
        {unreadNotifs.length > 0 && (
          <KpiCard icon="🔔" label="Alertes" accent="#ea580c"
            value={unreadNotifs.length}
            sub="notifications non lues"
            trendUp={false}
          />
        )}
      </div>

      {/* ── Ligne 2: Alertes + Conformité ── */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 320px', gap:16, marginBottom:20 }}>

        {/* Alertes opérationnelles */}
        <SectionCard title="Alertes opérationnelles"
          subtitle="Incidents et signaux nécessitant attention">
          {incStats?.critiques > 0 && (
            <AlerteItem icon="🚨" title={`${incStats.critiques} incident(s) critique(s)`}
              desc="Intervention immédiate requise" color="#7f1d1d" bg="#fee2e2" />
          )}
          {incStats?.sla_depasse > 0 && (
            <AlerteItem icon="⏰" title={`${incStats.sla_depasse} SLA dépassé(s)`}
              desc="Délai de résolution expiré" color="#78350f" bg="#fff7ed" />
          )}
          {voyStats?.en_voyage > 0 && (
            <AlerteItem icon="✈️" title={`${voyStats.en_voyage} personne(s) en déplacement`}
              desc="Rotations actives en cours" color="#1e3a8a" bg="#eff6ff" />
          )}
          {stats?.departs_s1 > 0 && (
            <AlerteItem icon="🏠" title={`${stats.departs_s1} départ(s) cette semaine`}
              desc="Libérations de résidences à planifier" color="#4c1d95" bg="#ede9fe" />
          )}
          {tauxInd < 60 && (
            <AlerteItem icon="⚠️" title={`Taux induction faible: ${tauxInd}%`}
              desc="Plusieurs sociétés en dessous du seuil" color="#92400e" bg="#fef3c7" />
          )}
          {!incStats?.critiques && !incStats?.sla_depasse && !stats?.departs_s1 && tauxInd >= 60 && (
            <div style={{ textAlign:'center', padding:'24px 0', color:'#16a34a' }}>
              <div style={{ fontSize:36, marginBottom:8 }}>✅</div>
              <p style={{ fontWeight:700, fontSize:14 }}>Tout est normal</p>
              <p style={{ fontSize:12, color:'#94a3b8', marginTop:4 }}>Aucune alerte active</p>
            </div>
          )}
        </SectionCard>

        {/* Conformité HSE */}
        <SectionCard title="Conformité HSE" subtitle="Induction par société">
          {conformite.length === 0 ? (
            <p style={{ color:'#94a3b8', fontSize:13, textAlign:'center', padding:20 }}>Chargement...</p>
          ) : conformite.map(({ s, pct, total, induits:ind }) => (
            <div key={s} style={{ marginBottom:12 }}>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:5 }}>
                <span style={{ fontSize:12, fontWeight:600, color:'#0f172a', overflow:'hidden',
                  textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:160 }}>
                  {s}
                </span>
                <span style={{ fontSize:12, fontWeight:800,
                  color: pct>=80?'#16a34a':pct>=60?'#ea580c':'#dc2626' }}>
                  {pct}%
                </span>
              </div>
              <ProgressBar value={pct}
                color={pct>=80?'#16a34a':pct>=60?'#f59e0b':'#dc2626'} />
              <p style={{ fontSize:10, color:'#94a3b8', marginTop:3 }}>{ind}/{total} membres</p>
            </div>
          ))}
        </SectionCard>
      </div>

      {/* ── Ligne 3: Notifications + Accès rapides ── */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>

        {/* Activité récente */}
        <SectionCard title="Activité récente"
          subtitle={`${unreadNotifs.length} nouvelle(s) notification(s)`}
          action={<Badge color="#1e40af" bg="#dbeafe">{notifs.length}</Badge>}>
          {notifs.length === 0 ? (
            <p style={{ color:'#94a3b8', fontSize:13, textAlign:'center', padding:20 }}>
              Aucune notification
            </p>
          ) : notifs.slice(0,6).map((n, i) => (
            <div key={n.id||i} style={{ display:'flex', gap:10, padding:'9px 0',
              borderBottom: i < 5 ? '1px solid #f1f5f9' : 'none',
              alignItems:'flex-start' }}>
              <div style={{ width:8, height:8, borderRadius:'50%', flexShrink:0, marginTop:4,
                background: !n.lu ? '#2563eb' : n.source==='induction_expiry' ? '#ea580c' : '#cbd5e1' }} />
              <div style={{ flex:1, minWidth:0 }}>
                <p style={{ fontSize:12, fontWeight:600, color:'#0f172a',
                  overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                  {n.evenement_titre || n.message || 'Notification'}
                </p>
                <p style={{ fontSize:11, color:'#94a3b8', marginTop:2 }}>
                  {n.date_envoi ? new Date(n.date_envoi).toLocaleString('fr-FR',{
                    day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}) : '—'}
                </p>
              </div>
              {!n.lu && <Badge color="#1e40af" bg="#dbeafe">Nouveau</Badge>}
            </div>
          ))}
        </SectionCard>

        {/* Accès rapides */}
        <SectionCard title="Modules" subtitle="Navigation rapide">
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
            {[
              { icon:'🤖', label:'Assistant IA', desc:'Données temps réel', path:'/assistant', color:'#7c3aed', bg:'#f5f3ff' },
              { icon:'🖥️', label:'Centre Opérationnel', desc:'Vue 360°', path:'/operations', color:'#1e3a8a', bg:'#eff6ff' },
              { icon:'📊', label:'Analytics', desc:'Rapports avancés', path:'/analytics', color:'#059669', bg:'#f0fdf4' },
              { icon:'📄', label:'Rapports', desc:'PDF · Export', path:'/rapports', color:'#ea580c', bg:'#fff7ed' },
              { icon:'📅', label:'Réservations', desc:'Salles · Véhicules', path:'/reservations', color:'#0891b2', bg:'#ecfeff' },
              { icon:'🔄', label:'Rotations', desc:'Planning mobilité', path:'/rotations', color:'#ca8a04', bg:'#fefce8' },
            ].map(({ icon, label, desc, path, color, bg }) => (
              <div key={path} onClick={() => navigate(path)}
                style={{ background:bg, borderRadius:10, padding:'12px 14px', cursor:'pointer',
                  border:`1px solid ${color}22`, transition:'all .15s' }}
                onMouseEnter={e => { e.currentTarget.style.transform='translateY(-2px)'; e.currentTarget.style.boxShadow=`0 4px 12px ${color}22` }}
                onMouseLeave={e => { e.currentTarget.style.transform=''; e.currentTarget.style.boxShadow='' }}>
                <div style={{ fontSize:22, marginBottom:6 }}>{icon}</div>
                <p style={{ fontSize:12, fontWeight:700, color }}>{label}</p>
                <p style={{ fontSize:11, color:'#94a3b8', marginTop:2 }}>{desc}</p>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }
      `}</style>
    </div>
  )
}
