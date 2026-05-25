/**
 * MAINTENANCE v3 — Workflow complet
 * Déclaration → Assignation → Intervention → Résolution → Clôture
 * SLA, historique, notifications, filtres avancés
 */
import React, { useState, useEffect, useCallback } from 'react'
import { incidents as incAPI } from '../api'
import { useStore } from '../store'

// ── Constantes ─────────────────────────────────────────────────
const STATUT_CFG = {
  declare:   { label:'Déclaré',    color:'#64748b', bg:'#f1f5f9', icon:'📋', step:1 },
  assigne:   { label:'Assigné',    color:'#2563eb', bg:'#dbeafe', icon:'👷', step:2 },
  en_cours:  { label:'En cours',   color:'#f97316', bg:'#fff7ed', icon:'🔧', step:3 },
  resolu:    { label:'Résolu',     color:'#16a34a', bg:'#f0fdf4', icon:'✅', step:4 },
  cloture:   { label:'Clôturé',    color:'#0f2447', bg:'#f8fafc', icon:'🔒', step:5 },
  annule:    { label:'Annulé',     color:'#dc2626', bg:'#fef2f2', icon:'❌', step:0 },
}
const PRIO_CFG = {
  critique: { color:'#dc2626', bg:'rgba(220,38,38,.1)',  label:'🔴 Critique', sla:'2h'  },
  haute:    { color:'#f97316', bg:'rgba(249,115,22,.1)', label:'🟠 Haute',    sla:'8h'  },
  moyenne:  { color:'#eab308', bg:'rgba(234,179,8,.1)',  label:'🟡 Moyenne',  sla:'24h' },
  basse:    { color:'#16a34a', bg:'rgba(22,163,74,.1)',  label:'🟢 Basse',    sla:'72h' },
}
const CATS = ['Plomberie','Electricite','Climatisation','Serrurerie','Toiture','Informatique','Generateur','Vehicule','Autre']

// ── Composants utilitaires ─────────────────────────────────────
const S_BTN = (bg, color, border='transparent') => ({
  background:bg, color, border:`1.5px solid ${border}`,
  padding:'7px 14px', borderRadius:8, cursor:'pointer',
  fontSize:12, fontWeight:700, fontFamily:'inherit', whiteSpace:'nowrap', transition:'.15s'
})

function SLABadge({ heures }) {
  if (heures === null || heures === undefined) return null
  const abs = Math.abs(heures)
  const h   = Math.floor(abs)
  const m   = Math.round((abs - h) * 60)
  const txt = h > 0 ? `${h}h${m > 0 ? m+'m' : ''}` : `${m}m`
  const depasse = heures < 0
  return (
    <span style={{
      display:'inline-flex', alignItems:'center', gap:4,
      padding:'2px 8px', borderRadius:20, fontSize:10, fontWeight:700,
      background: depasse ? '#fef2f2' : heures < 2 ? '#fffbeb' : '#f0fdf4',
      color:      depasse ? '#dc2626' : heures < 2 ? '#92400e'  : '#16a34a',
    }}>
      ⏱️ {depasse ? `Dépassé ${txt}` : `Reste ${txt}`}
    </span>
  )
}

function WorkflowSteps({ statut }) {
  const steps = [
    { key:'declare', label:'Déclaré',   icon:'📋' },
    { key:'assigne', label:'Assigné',   icon:'👷' },
    { key:'en_cours',label:'En cours',  icon:'🔧' },
    { key:'resolu',  label:'Résolu',    icon:'✅' },
    { key:'cloture', label:'Clôturé',   icon:'🔒' },
  ]
  const curStep = STATUT_CFG[statut]?.step || 0
  return (
    <div style={{ display:'flex', alignItems:'center', gap:0, overflowX:'auto', padding:'4px 0' }}>
      {steps.map((s, i) => {
        const cfg   = STATUT_CFG[s.key]
        const done  = cfg.step < curStep
        const active= cfg.step === curStep
        return (
          <React.Fragment key={s.key}>
            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:3, minWidth:60 }}>
              <div style={{
                width:32, height:32, borderRadius:'50%', display:'flex', alignItems:'center',
                justifyContent:'center', fontSize:14, fontWeight:700,
                background: done || active ? cfg.color : '#e2e8f0',
                color: done || active ? '#fff' : '#94a3b8',
                boxShadow: active ? `0 0 0 3px ${cfg.color}40` : 'none',
                transition:'.2s'
              }}>
                {done ? '✓' : s.icon}
              </div>
              <span style={{ fontSize:9, color: active ? cfg.color : done ? '#64748b' : '#94a3b8', fontWeight:700, textAlign:'center' }}>
                {s.label}
              </span>
            </div>
            {i < steps.length-1 && (
              <div style={{ flex:1, height:2, background: done ? '#16a34a' : '#e2e8f0', minWidth:12, transition:'.3s' }} />
            )}
          </React.Fragment>
        )
      })}
    </div>
  )
}

// ── Modal générique ─────────────────────────────────────────────
function Modal({ title, onClose, children, maxW=520 }) {
  return (
    <div style={{ position:'fixed',inset:0,background:'rgba(15,36,71,.65)',backdropFilter:'blur(4px)',display:'flex',alignItems:'flex-end',justifyContent:'center',zIndex:1000 }}
      onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{ background:'#fff',width:'100%',maxWidth:maxW,maxHeight:'92dvh',overflow:'auto',borderRadius:'18px 18px 0 0',boxShadow:'0 -8px 40px rgba(0,0,0,.2)' }}>
        <div style={{ position:'sticky',top:0,background:'linear-gradient(135deg,#0f2447,#1e3a8a)',color:'#fff',padding:'14px 20px',display:'flex',justifyContent:'space-between',alignItems:'center',borderRadius:'18px 18px 0 0',zIndex:10 }}>
          <span style={{ fontWeight:700,fontSize:15 }}>{title}</span>
          <button onClick={onClose} style={{ background:'rgba(255,255,255,.2)',border:'none',color:'#fff',width:30,height:30,borderRadius:8,cursor:'pointer',fontSize:18 }}>✕</button>
        </div>
        <div style={{ padding:20 }}>{children}</div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════
export default function Maintenance() {
  const { user } = useStore()
  const role    = user?.profile?.role || (user?.is_staff ? 'admin' : 'agent')
  const isAdmin = user?.is_staff === true || user?.is_superuser === true || role === 'admin'
  const isGest  = isAdmin || role === 'gestionnaire'
  const isTech  = isAdmin || role === 'technicien' || isGest

  // Data
  const [data,       setData]       = useState([])
  const [stats,      setStats]      = useState({})
  const [techniciens,setTechniciens]= useState([])
  const [loading,    setLoading]    = useState(true)
  const [selected,   setSelected]   = useState(null) // incident affiché en détail

  // Filtres
  const [fStatut,   setFStatut]    = useState('')
  const [fPrio,     setFPrio]      = useState('')
  const [fCat,      setFCat]       = useState('')
  const [fSLA,      setFSLA]       = useState(false)
  const [search,    setSearch]     = useState('')

  // Modals
  const [modal,     setModal]      = useState(null)  // 'create'|'assigner'|'resoudre'|'commenter'|'cloturer'

  // Forms
  const [form,      setForm]       = useState({ titre:'', description:'', categorie:'Plomberie', priorite:'moyenne', residence:'', bloc:'' })
  const [assignForm,setAssignForm] = useState({ technicien_id:'' })
  const [resolForm, setResolForm]  = useState({ commentaire:'' })
  const [comForm,   setComForm]    = useState({ contenu:'' })
  const [clotForm,  setClotForm]   = useState({ commentaire:'Résolution validée' })
  const [submitting,setSubmitting] = useState(false)
  const [err,       setErr]        = useState('')

  const load = useCallback(() => {
    setLoading(true)
    const p = {}
    if (fStatut)  p.statut   = fStatut
    if (fPrio)    p.priorite = fPrio
    if (fCat)     p.categorie= fCat
    if (fSLA)     p.sla_depasse = true
    if (search)   p.search   = search
    Promise.all([
      incAPI.list(p),
      incAPI.stats(),
      incAPI.techniciens ? incAPI.techniciens() : Promise.resolve({data:[]}),
    ]).then(([ri, rs, rt]) => {
      setData(ri.data.results || ri.data || [])
      setStats(rs.data || {})
      setTechniciens(rt.data || [])
    }).catch(()=>{}).finally(()=>setLoading(false))
  }, [fStatut, fPrio, fCat, fSLA, search])

  useEffect(()=>{ load() }, [load])

  // Actions workflow
  const doAction = async (action, payload={}) => {
    if (!selected) return
    setSubmitting(true); setErr('')
    try {
      const r = await incAPI[action](selected.id, payload)
      setSelected(r.data)
      load()
      setModal(null)
    } catch(e) { setErr(e.response?.data?.error || e.response?.data?.detail || 'Erreur') }
    finally { setSubmitting(false) }
  }

  const createIncident = async () => {
    if (!form.titre || !form.description || !form.residence) return setErr('Titre, description et résidence requis')
    setSubmitting(true); setErr('')
    try {
      const payload = {...form}
      // Extraire juste le base64 sans le préfixe data:...
      if (payload.photo_base64 && payload.photo_base64.startsWith('data:')) {
        const parts = payload.photo_base64.split(',')
        payload.photo_base64 = parts[1] || ''
        payload.photo_mime = payload.photo_base64 ? (payload.photo_base64.split(';')[0]?.replace('data:','') || 'image/jpeg') : 'image/jpeg'
      }
      const r = await incAPI.create(payload)
      setModal(null)
      setForm({ titre:'', description:'', categorie:'Plomberie', priorite:'moyenne', residence:'', bloc:'', photo_base64:'' })
      load()
      setSelected(r.data)
    } catch(e) { setErr(e.response?.data?.detail || JSON.stringify(e.response?.data) || 'Erreur') }
    finally { setSubmitting(false) }
  }

  const inp = { width:'100%', border:'2px solid #e2e8f0', borderRadius:9, padding:'10px 12px', fontSize:14, outline:'none', fontFamily:'inherit', boxSizing:'border-box' }

  return (
    <div style={{ padding:20, display:'grid', gridTemplateColumns:selected?'1fr 400px':'1fr', gap:16, height:'calc(100dvh - 58px)', overflow:'hidden' }}>

      {/* ═══ PANNEAU GAUCHE : liste ═══ */}
      <div style={{ display:'flex', flexDirection:'column', gap:14, overflow:'hidden' }}>

        {/* Header */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexWrap:'wrap', gap:10 }}>
          <div>
            <h2 style={{ fontSize:21, fontWeight:800, color:'#1e3a8a', margin:0 }}>🔧 Maintenance</h2>
            <p style={{ fontSize:12, color:'#64748b', margin:'3px 0 0' }}>Workflow · SLA · Assignation · Historique</p>
          </div>
          <button onClick={() => { setModal('create'); setErr('') }}
            style={{ ...S_BTN('#1e3a8a','#fff'), fontSize:14, padding:'10px 20px' }}>
            + Déclarer un incident
          </button>
        </div>

        {/* KPIs */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(110px,1fr))', gap:8 }}>
          {[
            ['Déclarés',  stats.declare||0,  '#64748b'],
            ['Assignés',  stats.assigne||0,  '#2563eb'],
            ['En cours',  stats.en_cours||0, '#f97316'],
            ['Résolus',   stats.resolu||0,   '#16a34a'],
            ['SLA ⚠️',    stats.sla_depasse||0, '#dc2626'],
            ['🔴 Critiq.', stats.critique||0, '#7c3aed'],
          ].map(([l,v,c]) => (
            <div key={l} style={{ background:'#fff', border:`1px solid ${c}30`, borderTop:`2.5px solid ${c}`, borderRadius:10, padding:'10px 12px' }}>
              <div style={{ fontFamily:'monospace', fontSize:22, fontWeight:900, color:c }}>{v}</div>
              <div style={{ fontSize:9.5, color:'#94a3b8', textTransform:'uppercase', letterSpacing:.8, marginTop:3 }}>{l}</div>
            </div>
          ))}
        </div>

        {/* Filtres */}
        <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'center' }}>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 Rechercher..."
            style={{ ...inp, maxWidth:200, padding:'7px 12px', fontSize:13 }} />
          <select value={fStatut} onChange={e=>setFStatut(e.target.value)} style={{ ...inp, width:'auto', padding:'7px 10px', fontSize:12 }}>
            <option value="">Tous statuts</option>
            {Object.entries(STATUT_CFG).filter(([k])=>k!=='annule').map(([k,v])=>(
              <option key={k} value={k}>{v.icon} {v.label}</option>
            ))}
          </select>
          <select value={fPrio} onChange={e=>setFPrio(e.target.value)} style={{ ...inp, width:'auto', padding:'7px 10px', fontSize:12 }}>
            <option value="">Toutes priorités</option>
            {Object.entries(PRIO_CFG).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
          </select>
          <select value={fCat} onChange={e=>setFCat(e.target.value)} style={{ ...inp, width:'auto', padding:'7px 10px', fontSize:12 }}>
            <option value="">Toutes catégories</option>
            {CATS.map(c=><option key={c} value={c}>{c}</option>)}
          </select>
          <label style={{ display:'flex', alignItems:'center', gap:6, fontSize:12, color:'#dc2626', fontWeight:700, cursor:'pointer' }}>
            <input type="checkbox" checked={fSLA} onChange={e=>setFSLA(e.target.checked)} style={{ accentColor:'#dc2626' }} />
            ⏰ SLA dépassé
          </label>
          {(fStatut||fPrio||fCat||fSLA||search) && (
            <button onClick={()=>{setFStatut('');setFPrio('');setFCat('');setFSLA(false);setSearch('')}}
              style={{ ...S_BTN('rgba(220,38,38,.1)','#dc2626','rgba(220,38,38,.2)'), fontSize:11 }}>
              ✕ Reset
            </button>
          )}
        </div>

        {/* Liste incidents */}
        <div style={{ flex:1, overflowY:'auto', display:'flex', flexDirection:'column', gap:8 }}>
          {loading ? (
            <div style={{ textAlign:'center', padding:40, fontSize:28 }}>⏳</div>
          ) : data.length===0 ? (
            <div style={{ textAlign:'center', padding:48, color:'#94a3b8' }}>
              <div style={{ fontSize:48, marginBottom:12 }}>🔧</div>
              <div style={{ fontWeight:700, fontSize:15, color:'#64748b' }}>Aucun incident</div>
              <div style={{ fontSize:12, marginTop:4 }}>Cliquez sur "+ Déclarer un incident"</div>
            </div>
          ) : data.map(inc => {
            const sc    = STATUT_CFG[inc.statut] || STATUT_CFG.declare
            const pc    = PRIO_CFG[inc.priorite] || PRIO_CFG.moyenne
            const isSelected = selected?.id === inc.id
            return (
              <div key={inc.id} onClick={() => setSelected(inc)}
                style={{ background:'#fff', border:`1.5px solid ${isSelected?'#2563eb':'#e2e8f0'}`, borderRadius:12,
                  padding:14, cursor:'pointer', transition:'.15s',
                  boxShadow: isSelected?'0 0 0 3px rgba(37,99,235,.15)':'var(--s-xs)' }}
                onMouseEnter={e=>!isSelected&&(e.currentTarget.style.borderColor='#bfdbfe')}
                onMouseLeave={e=>!isSelected&&(e.currentTarget.style.borderColor='#e2e8f0')}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:8, marginBottom:8 }}>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:5 }}>
                      <span style={{ background:sc.bg, color:sc.color, padding:'2px 9px', borderRadius:20, fontSize:11, fontWeight:700 }}>
                        {sc.icon} {sc.label}
                      </span>
                      <span style={{ background:pc.bg, color:pc.color, padding:'2px 9px', borderRadius:20, fontSize:11, fontWeight:700 }}>
                        {pc.label} · SLA {pc.sla}
                      </span>
                      {inc.sla_depasse && (
                        <span style={{ background:'#fef2f2', color:'#dc2626', padding:'2px 9px', borderRadius:20, fontSize:11, fontWeight:700 }}>
                          ⏰ SLA DÉPASSÉ
                        </span>
                      )}
                    </div>
                    <div style={{ fontWeight:700, fontSize:14, color:'#1e293b', marginBottom:3, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                      #{inc.id} · {inc.titre}
                    </div>
                    <div style={{ fontSize:11, color:'#64748b' }}>
                      📍 {inc.residence} {inc.bloc} · {inc.categorie} · {inc.auteur_nom}
                    </div>
                  </div>
                  <div style={{ textAlign:'right', flexShrink:0 }}>
                    <SLABadge heures={inc.sla_restant_h} />
                    <div style={{ fontSize:10, color:'#94a3b8', marginTop:4 }}>
                      {new Date(inc.date_creation).toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}
                    </div>
                    {inc.assigne_nom && (
                      <div style={{ fontSize:10, color:'#2563eb', fontWeight:600, marginTop:2 }}>👷 {inc.assigne_nom}</div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ═══ PANNEAU DROIT : détail incident ═══ */}
      {selected && (
        <div style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:16, display:'flex', flexDirection:'column', overflow:'hidden', boxShadow:'var(--s-md)' }}>
          {/* Header détail */}
          <div style={{ background:'linear-gradient(135deg,#0f2447,#1e3a8a)', padding:'14px 18px', color:'#fff', flexShrink:0 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:10 }}>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:11, color:'rgba(255,255,255,.6)', marginBottom:3 }}>Incident #{selected.id}</div>
                <div style={{ fontWeight:700, fontSize:15, lineHeight:1.3 }}>{selected.titre}</div>
              </div>
              <button onClick={() => setSelected(null)} style={{ background:'rgba(255,255,255,.2)',border:'none',color:'#fff',width:28,height:28,borderRadius:8,cursor:'pointer',fontSize:16,flexShrink:0 }}>✕</button>
            </div>
            <div style={{ marginTop:10 }}>
              <WorkflowSteps statut={selected.statut} />
            </div>
          </div>

          {/* Corps défiable */}
          <div style={{ flex:1, overflowY:'auto', padding:16, display:'flex', flexDirection:'column', gap:14 }}>

            {/* Infos */}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
              {[
                ['Statut',    `${STATUT_CFG[selected.statut]?.icon} ${STATUT_CFG[selected.statut]?.label}`],
                ['Priorité',  PRIO_CFG[selected.priorite]?.label],
                ['Catégorie', selected.categorie],
                ['Résidence', `${selected.residence} ${selected.bloc||''}`],
                ['Déclarant', selected.auteur_nom],
                ['Technicien',selected.assigne_nom||'Non assigné'],
              ].map(([k,v]) => (
                <div key={k} style={{ background:'#f8fafc', borderRadius:8, padding:'8px 10px' }}>
                  <div style={{ fontSize:9.5, color:'#94a3b8', textTransform:'uppercase', letterSpacing:.8, marginBottom:2 }}>{k}</div>
                  <div style={{ fontSize:12.5, fontWeight:600, color:'#1e293b' }}>{v}</div>
                </div>
              ))}
            </div>

            {/* SLA */}
            <div style={{ background: selected.sla_depasse?'#fef2f2':'#f0fdf4', border:`1px solid ${selected.sla_depasse?'#fecaca':'#bbf7d0'}`, borderRadius:10, padding:'10px 14px' }}>
              <div style={{ fontSize:11, fontWeight:700, color:selected.sla_depasse?'#991b1b':'#166534', marginBottom:4 }}>
                ⏱️ SLA — {PRIO_CFG[selected.priorite]?.sla} maximum
              </div>
              <SLABadge heures={selected.sla_restant_h} />
              {selected.sla_echeance && (
                <div style={{ fontSize:10, color:'#64748b', marginTop:4 }}>
                  Échéance : {new Date(selected.sla_echeance).toLocaleString('fr-FR')}
                </div>
              )}
            </div>

            {/* Description */}
            <div>
              <div style={{ fontSize:10, fontWeight:700, color:'#64748b', textTransform:'uppercase', letterSpacing:.8, marginBottom:6 }}>Description</div>
              <div style={{ fontSize:13, color:'#334155', lineHeight:1.6, background:'#f8fafc', borderRadius:8, padding:'10px 12px' }}>
                {selected.description}
              </div>
            </div>

              {/* Photo de l'incident */}
              {selected.photo_base64 && (
                <div style={{ marginTop:12 }}>
                  <div style={{ fontSize:11, fontWeight:700, color:'#64748b', marginBottom:6, textTransform:'uppercase' }}>
                    📷 Photo
                  </div>
                  <img
                    src={selected.photo_base64.startsWith('data:') ? selected.photo_base64 : `data:${selected.photo_mime||'image/jpeg'};base64,${selected.photo_base64}`}
                    alt="Photo incident"
                    style={{ width:'100%', maxHeight:280, objectFit:'cover', borderRadius:12,
                      border:'2px solid #e2e8f0', cursor:'pointer' }}
                    onClick={() => window.open(selected.photo_base64.startsWith('data:') ? selected.photo_base64 : `data:${selected.photo_mime||'image/jpeg'};base64,${selected.photo_base64}`, '_blank')}
                  />
                  <div style={{ fontSize:10, color:'#94a3b8', marginTop:4 }}>Cliquer pour agrandir</div>
                </div>
              )}
            {/* Actions workflow */}
            {selected.statut !== 'cloture' && selected.statut !== 'annule' && (
              <div>
                <div style={{ fontSize:10, fontWeight:700, color:'#64748b', textTransform:'uppercase', letterSpacing:.8, marginBottom:8 }}>Actions</div>
                <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                  {isGest && selected.statut === 'declare' && (
                    <button onClick={()=>{setModal('assigner');setErr('')}}
                      style={S_BTN('#eff6ff','#2563eb','#bfdbfe')}>
                      👷 Assigner
                    </button>
                  )}
                  {isTech && selected.statut === 'assigne' && selected.assigne_a === user?.id && (
                    <button onClick={() => doAction('commencer', { commentaire:'Intervention démarrée' })}
                      style={S_BTN('#fff7ed','#f97316','#fed7aa')}>
                      🔧 Commencer
                    </button>
                  )}
                  {isTech && ['assigne','en_cours'].includes(selected.statut) && (
                    <button onClick={()=>{setModal('resoudre');setErr('')}}
                      style={S_BTN('#f0fdf4','#16a34a','#bbf7d0')}>
                      ✅ Résoudre
                    </button>
                  )}
                  {isGest && selected.statut === 'resolu' && (
                    <button onClick={()=>{setModal('cloturer');setErr('')}}
                      style={S_BTN('#0f2447','#fff','#0f2447')}>
                      🔒 Clôturer
                    </button>
                  )}
                  {isGest && selected.statut !== 'resolu' && selected.statut !== 'cloture' && (
                    <button onClick={()=>doAction('escalader',{raison:'Escalade manuelle'})}
                      style={S_BTN('rgba(220,38,38,.1)','#dc2626','rgba(220,38,38,.2)')}>
                      ⚡ Escalader
                    </button>
                  )}
                  <button onClick={()=>{setModal('commenter');setErr('')}}
                    style={S_BTN('#f8fafc','#64748b','#e2e8f0')}>
                    💬 Commenter
                  </button>
                  {isGest && (
                    <button onClick={()=>doAction('annuler',{raison:'Annulation gestionnaire'})}
                      style={S_BTN('rgba(100,116,139,.08)','#94a3b8','#e2e8f0')}>
                      ✕ Annuler
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Historique commentaires */}
            <div>
              <div style={{ fontSize:10, fontWeight:700, color:'#64748b', textTransform:'uppercase', letterSpacing:.8, marginBottom:8 }}>
                📋 Historique des interventions ({selected.commentaires?.length||0})
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {(selected.commentaires||[]).map(c => {
                  const typeColors = {
                    info:'#64748b', assignation:'#2563eb', debut:'#f97316',
                    resolution:'#16a34a', cloture:'#0f2447', escalade:'#dc2626', relance:'#f59e0b'
                  }
                  const tc = typeColors[c.type_comment]||'#64748b'
                  return (
                    <div key={c.id} style={{ display:'flex', gap:10 }}>
                      <div style={{ width:3, borderRadius:99, background:tc, flexShrink:0 }} />
                      <div style={{ flex:1, background:'#f8fafc', borderRadius:8, padding:'8px 12px' }}>
                        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:3 }}>
                          <span style={{ fontSize:10, fontWeight:700, color:tc, textTransform:'uppercase' }}>
                            {c.type_label || c.type_comment}
                          </span>
                          <span style={{ fontSize:10, color:'#94a3b8' }}>
                            {new Date(c.date_creation).toLocaleString('fr-FR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}
                          </span>
                        </div>
                        <div style={{ fontSize:12, color:'#334155' }}>{c.contenu}</div>
                        <div style={{ fontSize:10, color:'#94a3b8', marginTop:2 }}>— {c.auteur_nom}</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ MODAL CRÉER ═══ */}
      {modal==='create' && (
        <Modal title="🔧 Déclarer un incident" onClose={()=>setModal(null)}>
          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
            {err && <div style={{ background:'#fef2f2', border:'1px solid #fecaca', borderRadius:8, padding:'10px 14px', fontSize:13, color:'#991b1b', fontWeight:600 }}>❌ {err}</div>}
            <div>
              <label style={{ display:'block', fontSize:11, fontWeight:700, color:'#64748b', marginBottom:5, textTransform:'uppercase' }}>Titre *</label>
              <input value={form.titre} onChange={e=>setForm({...form,titre:e.target.value})} placeholder="Ex: Climatisation en panne" style={inp}/>
            </div>
            <div>
              <label style={{ display:'block', fontSize:11, fontWeight:700, color:'#64748b', marginBottom:5, textTransform:'uppercase' }}>Description *</label>
              <textarea value={form.description} onChange={e=>setForm({...form,description:e.target.value})}
                placeholder="Décrivez l'incident en détail..." rows={3} style={{...inp,resize:'vertical'}}/>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              <div>
                <label style={{ display:'block', fontSize:11, fontWeight:700, color:'#64748b', marginBottom:5, textTransform:'uppercase' }}>Catégorie</label>
                <select value={form.categorie} onChange={e=>setForm({...form,categorie:e.target.value})} style={inp}>
                  {CATS.map(c=><option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display:'block', fontSize:11, fontWeight:700, color:'#64748b', marginBottom:5, textTransform:'uppercase' }}>Priorité</label>
                <select value={form.priorite} onChange={e=>setForm({...form,priorite:e.target.value})} style={inp}>
                  {Object.entries(PRIO_CFG).map(([k,v])=><option key={k} value={k}>{v.label} ({v.sla})</option>)}
                </select>
              </div>
              <div>
                <label style={{ display:'block', fontSize:11, fontWeight:700, color:'#64748b', marginBottom:5, textTransform:'uppercase' }}>Résidence *</label>
                <input value={form.residence} onChange={e=>setForm({...form,residence:e.target.value})} placeholder="Ex: B1, VIP..." style={inp}/>
              </div>
              <div>
                <label style={{ display:'block', fontSize:11, fontWeight:700, color:'#64748b', marginBottom:5, textTransform:'uppercase' }}>Bloc / Chambre</label>
                <input value={form.bloc} onChange={e=>setForm({...form,bloc:e.target.value})} placeholder="Ex: Bloc 3, Ch. 12" style={inp}/>
              </div>
            </div>
            <div style={{ background:'#fffbeb', border:'1px solid #fde68a', borderRadius:10, padding:'10px 14px', fontSize:12, color:'#92400e' }}>
              ⏱️ SLA assigné : <b>{PRIO_CFG[form.priorite]?.sla}</b> — L'écheance démarre à la déclaration.
            </div>
            <div style={{ display:'flex', gap:10 }}>
              <button onClick={()=>setModal(null)} style={{ flex:1, ...S_BTN('#f8fafc','#64748b','#e2e8f0'), padding:'12px 0' }}>Annuler</button>
              <button onClick={createIncident} disabled={submitting}
                style={{ flex:2, ...S_BTN(submitting?'#94a3b8':'#1e3a8a','#fff'), padding:'12px 0', fontSize:14 }}>
                {submitting?'⏳ Envoi...':'📤 Déclarer l\'incident'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ═══ MODAL ASSIGNER ═══ */}
      {modal==='assigner' && selected && (
        <Modal title="👷 Assigner le technicien" onClose={()=>setModal(null)}>
          {err && <div style={{ background:'#fef2f2', border:'1px solid #fecaca', borderRadius:8, padding:'10px 14px', fontSize:13, color:'#991b1b', fontWeight:600, marginBottom:14 }}>❌ {err}</div>}
          <div style={{ marginBottom:14 }}>
            <label style={{ display:'block', fontSize:11, fontWeight:700, color:'#64748b', marginBottom:6, textTransform:'uppercase' }}>Technicien *</label>
            <select value={assignForm.technicien_id} onChange={e=>setAssignForm({technicien_id:e.target.value})} style={inp}>
              <option value="">Sélectionner un technicien…</option>
              {techniciens.map(t=>(
                <option key={t.id} value={t.id}>{t.nom} ({t.role}) — {t.incidents_actifs} incident(s) en cours</option>
              ))}
            </select>
          </div>
          <div style={{ display:'flex', gap:10 }}>
            <button onClick={()=>setModal(null)} style={{ flex:1, ...S_BTN('#f8fafc','#64748b','#e2e8f0'), padding:'12px 0' }}>Annuler</button>
            <button onClick={()=>doAction('assigner', assignForm)} disabled={submitting||!assignForm.technicien_id}
              style={{ flex:2, ...S_BTN(submitting||!assignForm.technicien_id?'#94a3b8':'#2563eb','#fff'), padding:'12px 0', fontSize:14 }}>
              {submitting?'⏳...':'👷 Assigner'}
            </button>
          </div>
        </Modal>
      )}

      {/* ═══ MODAL RÉSOUDRE ═══ */}
      {modal==='resoudre' && (
        <Modal title="✅ Résolution de l'incident" onClose={()=>setModal(null)}>
          {err && <div style={{ background:'#fef2f2',border:'1px solid #fecaca',borderRadius:8,padding:'10px 14px',fontSize:13,color:'#991b1b',fontWeight:600,marginBottom:14 }}>❌ {err}</div>}
          <div style={{ marginBottom:14 }}>
            <label style={{ display:'block', fontSize:11, fontWeight:700, color:'#64748b', marginBottom:6, textTransform:'uppercase' }}>Rapport de résolution *</label>
            <textarea value={resolForm.commentaire} onChange={e=>setResolForm({commentaire:e.target.value})}
              placeholder="Décrivez les actions effectuées et la solution apportée..." rows={4}
              style={{...inp, resize:'vertical'}}/>
          </div>
          <div style={{ display:'flex', gap:10 }}>
            <button onClick={()=>setModal(null)} style={{ flex:1,...S_BTN('#f8fafc','#64748b','#e2e8f0'),padding:'12px 0' }}>Annuler</button>
            <button onClick={()=>doAction('resoudre', resolForm)} disabled={submitting||!resolForm.commentaire}
              style={{ flex:2,...S_BTN(submitting||!resolForm.commentaire?'#94a3b8':'#16a34a','#fff'),padding:'12px 0',fontSize:14 }}>
              {submitting?'⏳...':'✅ Marquer comme résolu'}
            </button>
          </div>
        </Modal>
      )}

      {/* ═══ MODAL COMMENTER ═══ */}
      {modal==='commenter' && (
        <Modal title="💬 Ajouter un commentaire" onClose={()=>setModal(null)}>
          {err && <div style={{ background:'#fef2f2',border:'1px solid #fecaca',borderRadius:8,padding:'10px 14px',fontSize:13,color:'#991b1b',fontWeight:600,marginBottom:14 }}>❌ {err}</div>}
          <div style={{ marginBottom:14 }}>
            <textarea value={comForm.contenu} onChange={e=>setComForm({contenu:e.target.value})}
              placeholder="Votre commentaire..." rows={3} style={{...inp, resize:'vertical'}}/>
          </div>
          <div style={{ display:'flex', gap:10 }}>
            <button onClick={()=>setModal(null)} style={{ flex:1,...S_BTN('#f8fafc','#64748b','#e2e8f0'),padding:'12px 0' }}>Annuler</button>
            <button onClick={()=>doAction('commenter',comForm)} disabled={submitting||!comForm.contenu}
              style={{ flex:2,...S_BTN(submitting||!comForm.contenu?'#94a3b8':'#1e3a8a','#fff'),padding:'12px 0',fontSize:14 }}>
              {submitting?'⏳...':'💬 Envoyer'}
            </button>
          </div>
        </Modal>
      )}

      {/* ═══ MODAL CLÔTURER ═══ */}
      {modal==='cloturer' && (
        <Modal title="🔒 Clôture de l'incident" onClose={()=>setModal(null)}>
          {err && <div style={{ background:'#fef2f2',border:'1px solid #fecaca',borderRadius:8,padding:'10px 14px',fontSize:13,color:'#991b1b',fontWeight:600,marginBottom:14 }}>❌ {err}</div>}
          <div style={{ background:'#f0fdf4',border:'1px solid #bbf7d0',borderRadius:10,padding:'12px 14px',marginBottom:14,fontSize:13,color:'#166534' }}>
            ✅ Vous êtes sur le point de clôturer définitivement cet incident. Cette action confirme que la résolution est satisfaisante.
          </div>
          <div style={{ marginBottom:14 }}>
            <textarea value={clotForm.commentaire} onChange={e=>setClotForm({commentaire:e.target.value})}
              rows={2} style={{...inp,resize:'vertical'}}/>
          </div>
          <div style={{ display:'flex', gap:10 }}>
            <button onClick={()=>setModal(null)} style={{ flex:1,...S_BTN('#f8fafc','#64748b','#e2e8f0'),padding:'12px 0' }}>Annuler</button>
            <button onClick={()=>doAction('cloturer',clotForm)} disabled={submitting}
              style={{ flex:2,...S_BTN(submitting?'#94a3b8':'#0f2447','#fff'),padding:'12px 0',fontSize:14 }}>
              {submitting?'⏳...':'🔒 Clôturer définitivement'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}
