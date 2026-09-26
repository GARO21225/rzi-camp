import React, { useState, useEffect, useRef } from 'react'
import { evenements as evtAPI, alertes as alertesAPI, groupesDiffusion as groupesAPI, personnel as personnelAPI } from '../api'
import { useStore } from '../store'
import { toast, confirmDialog } from '../toast'

const TYPE_COLORS = {
  reunion:{ bg:'rgba(37,99,235,.12)', color:'var(--rzc-blue)', icon:'👥' },
  securite:{ bg:'rgba(220,38,38,.12)', color:'#dc2626', icon:'🚨' },
  formation:{ bg:'rgba(124,58,237,.12)', color:'#7c3aed', icon:'📚' },
  social:{ bg:'rgba(22,163,74,.12)', color:'#16a34a', icon:'🎉' },
  sport:{ bg:'rgba(234,88,12,.12)', color:'#ea580c', icon:'⚽' },
  alerte:{ bg:'rgba(220,38,38,.18)', color:'#dc2626', icon:'⚠️' },
  maintenance:{ bg:'rgba(100,116,139,.12)', color:'var(--rzc-text-3)', icon:'🔧' },
  autre:{ bg:'rgba(240,165,0,.12)', color:'#d08800', icon:'📌' },
}

// Scanner camera reel pour les QR d'evenement - meme motif que QRScanner
// dans Restauration.jsx (html5-qrcode), adapte a scannerQr(). Avant cet
// ajout, la modale Scanner ne proposait qu'un champ texte malgre son
// icone 📷 - source de confusion ("le scanner ne s'ouvre pas").
function EvtQRScanner({ evenementId, onResult }) {
  const [phase, setPhase] = useState('init')
  const [msg, setMsg] = useState('')
  const scannerRef = useRef(null)
  const cooldown = useRef(false)
  const alive = useRef(true)

  useEffect(() => {
    alive.current = true
    startCamera()
    return () => { alive.current = false; stopCamera() }
  }, [evenementId])

  async function stopCamera() {
    if (scannerRef.current) {
      try { await scannerRef.current.stop() } catch {}
      try { scannerRef.current.clear() } catch {}
      scannerRef.current = null
    }
  }

  async function startCamera() {
    await stopCamera()
    if (!alive.current) return
    setPhase('init'); setMsg('')
    try {
      const { Html5Qrcode } = await import('html5-qrcode')
      if (!alive.current) return
      const s = new Html5Qrcode('evt_qr_viewport')
      scannerRef.current = s
      await s.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 200, height: 200 } },
        async (decoded) => {
          if (cooldown.current || !alive.current) return
          cooldown.current = true
          setPhase('loading'); setMsg('')
          try {
            const r = await evtAPI.scannerQr(evenementId, decoded)
            if (!alive.current) return
            setPhase(r.data.valid ? 'ok' : 'already')
            setMsg(r.data.valid ? '' : (r.data.erreur||''))
            onResult({ ok:true, ...r.data })
          } catch (e) {
            if (!alive.current) return
            setPhase('error')
            setMsg(e.response?.data?.erreur || 'Code non reconnu')
            onResult({ ok:false, ...(e.response?.data||{}) })
          }
          setTimeout(() => {
            if (!alive.current) return
            cooldown.current = false
            setPhase('scan'); setMsg('')
          }, 3000)
        },
        () => {}
      )
      setPhase('scan')
    } catch {
      if (!alive.current) return
      setPhase('nocam')
      setMsg("Caméra indisponible — vérifiez l'autorisation d'accès, ou utilisez la saisie manuelle ci-dessous")
    }
  }

  const CFG = {
    init:    { bg:'#1e293b', icon:'📡', text:'Démarrage…' },
    scan:    { bg:'#1e293b', icon:'📷', text:'Scanner actif' },
    loading: { bg:'#78350f', icon:'⏳', text:'Validation…' },
    ok:      { bg:'#14532d', icon:'✅', text:'Accès validé' },
    already: { bg:'#7c2d12', icon:'⛔', text: msg||'Déjà scanné' },
    error:   { bg:'#450a0a', icon:'❌', text: msg||'QR non reconnu' },
    nocam:   { bg:'#1e1e2e', icon:'📵', text:'Caméra indisponible' },
  }
  const cfg = CFG[phase] || CFG.scan

  return (
    <div style={{ borderRadius:12, overflow:'hidden', border:`2px solid ${cfg.bg}`, marginBottom:14 }}>
      <div style={{ background:cfg.bg, padding:'8px 12px', display:'flex', alignItems:'center', gap:8 }}>
        <span style={{ fontSize:18 }}>{cfg.icon}</span>
        <span style={{ color:'#fff', fontWeight:700, fontSize:12 }}>{cfg.text}</span>
      </div>
      <div style={{ background:'#000', position:'relative', minHeight:180 }}>
        <div id="evt_qr_viewport" style={{ width:'100%', minHeight:180 }} />
      </div>
      {phase==='nocam' && <div style={{ padding:'8px 12px', fontSize:11, color:'#dc2626', background:'#fef2f2' }}>{msg}</div>}
    </div>
  )
}
const STATUT_COLORS = {
  planifie:{ bg:'rgba(37,99,235,.1)', color:'var(--rzc-blue)', label:'Planifié' },
  en_cours:{ bg:'rgba(22,163,74,.1)', color:'#16a34a', label:'En cours' },
  termine:{ bg:'rgba(100,116,139,.1)', color:'var(--rzc-text-3)', label:'Terminé' },
  annule:{ bg:'rgba(220,38,38,.1)', color:'#dc2626', label:'Annulé' },
}

const inp = { background:'var(--surface2)', border:'1px solid var(--border)', color:'var(--text)', padding:'8px 12px', borderRadius:8, fontSize:13, outline:'none', fontFamily:'inherit', width:'100%' }
const todayDT = new Date().toISOString().slice(0,16)

export default function Evenements() {
  const { user } = useStore()
  const role = (user?.is_staff || user?.is_superuser) ? 'admin' : (user?.profile?.role || 'agent')
  const isAdmin = user?.is_staff === true || user?.is_superuser === true || user?.profile?.role === 'admin'

  const [events, setEvents] = useState([])
  const [alertes, setAlertes] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('agenda')
  const [modal, setModal] = useState(false)
  const [alerteModal, setAlerteModal] = useState(false)
  const [notifResult, setNotifResult] = useState(null)
  const [qrModal, setQrModal] = useState(null)        // { evt } en cours de generation
  const [personnelPourQui, setPersonnelPourQui] = useState('')  // admin seulement: generer pour un tiers
  const [personnelListe, setPersonnelListe] = useState([])
  const [qrResult, setQrResult] = useState(null)       // reponse du serveur (image + token)
  const [boissonChoix, setBoissonChoix] = useState('')
  const [scanModal, setScanModal] = useState(null)     // evenement en cours de scan
  const [scanToken, setScanToken] = useState('')
  const [scanResult, setScanResult] = useState(null)
  const [form, setForm] = useState({
    titre:'', description:'', type_event:'reunion', lieu:'Salle polyvalente Camp RZI',
    date_debut:todayDT, date_fin:'', obligatoire:false, qr_requis:false, propose_boisson:false, groupe_diffusion:''
  })
  const [groupes, setGroupes] = useState([])
  const [alerteForm, setAlerteForm] = useState({ message:'', type_alerte:'info' })

  const load = () => {
    setLoading(true)
    evtAPI.list().then(r => setEvents(r.data.results||r.data)).finally(()=>setLoading(false))
    alertesAPI.list().then(r => setAlertes(r.data.results||r.data))
  }
  useEffect(()=>{ load() },[])
  useEffect(()=>{
    groupesAPI.list().then(r=>{
      const liste = r.data.results || r.data
      setGroupes(liste)
      const defaut = liste.find(g=>g.est_defaut)
      if (defaut) setForm(f=>({...f, groupe_diffusion: defaut.id}))
    }).catch(()=>{})
  },[])

  const createEvt = async () => {
    if (!form.titre||!form.date_debut) return toast.success('Titre et date obligatoires')
    const payload = { ...form, notifier_residents: true }
    try {
      const r = await evtAPI.create(payload)
      setModal(false)
      setNotifResult(r.data.residents_notifies)
      load()
    } catch(e) { toast.success(e.response?.data?JSON.stringify(e.response.data):e.message) }
  }

  const notifier = async (id, titre) => {
    const r = await evtAPI.notifier(id)
    toast.success(`✅ ${r.data.residents_notifies} résident(s) notifié(s) pour "${titre}"`)
  }

  const deleteEvt = async (id, titre) => {
    if (!await confirmDialog(`Supprimer "${titre}" ?`)) return
    try { await evtAPI.delete(id); load() } catch(e) { toast.success(e.response?.data?.error||e.message) }
  }
  const changerStatut = async (id, statut) => {
    await evtAPI.changerStatut(id, statut); load()
  }

  const createAlerte = async () => {
    if (!alerteForm.message) return toast.success('Message obligatoire')
    await alertesAPI.create(alerteForm)
    setAlerteModal(false); setAlerteForm({ message:'', type_alerte:'info' }); load()
  }

  const now = new Date()
  // Un evenement dont la date est passee (date_fin si renseignee, sinon
  // date_debut) mais dont le statut est reste sur 'planifie' ou 'en_cours'
  // (jamais cloture manuellement) est considere echu - partage entre le
  // badge/boutons de chaque carte ET le compteur KPI "En cours", pour que
  // les deux restent coherents (sinon le compteur continuait a inclure un
  // evenement deja marque "Échu" sur sa carte).
  const estEvenementEchu = (e) => {
    // 'planifie' : la date prevue de DEBUT est passee et l'evenement
    // n'a jamais ete demarre -> echu des que la date est depassee, sans
    // delai de grace (il devait commencer a cette date-la et ne l'a
    // jamais fait).
    // 'en_cours' : par definition, sa date de debut est TOUJOURS dans le
    // passe des qu'il a demarre - la seule question pertinente est s'il
    // dure depuis trop longtemps sans avoir ete cloture manuellement.
    // Bug reel trouve et corrige ici : sans delai de grace, un evenement
    // demarre il y a seulement 1h se faisait deja marquer "Echu", alors
    // qu'il est legitimement toujours en cours. Delai de grace de 24h
    // apres sa date de FIN (ou de debut si pas de fin renseignee).
    if (e.statut === 'planifie') return new Date(e.date_debut) < now
    if (e.statut === 'en_cours') {
      const dateReference = e.date_fin || e.date_debut
      const echeanceAvecGrace = new Date(dateReference).getTime() + 24*60*60*1000
      return echeanceAvecGrace < now.getTime()
    }
    return false
  }
  const upcoming = events.filter(e => new Date(e.date_debut) >= now && e.statut !== 'annule')
  const past = events.filter(e => new Date(e.date_debut) < now || e.statut === 'termine')
  const enCoursListe = events.filter(e => e.statut === 'en_cours')

  const ALERTE_COLORS = { info:'var(--rzc-blue)', warning:'#d08800', danger:'#dc2626', success:'#16a34a' }

  return (
    <div style={{ padding:'16px' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:16, flexWrap:'wrap', gap:10 }}>
        <div>
          <h2 style={{ fontSize:19, fontWeight:700, color:'var(--blue)' }}>📅 Événements du Campus</h2>
          <p style={{ fontSize:12, color:'var(--text-dim)', marginTop:3 }}>Notifications automatiques aux résidents · WebSocket temps réel</p>
        </div>
          <div style={{ display:'flex', gap:8 }}>
            <button onClick={()=>setAlerteModal(true)} style={{ background:'rgba(220,38,38,.1)', color:'#dc2626', border:'1px solid rgba(220,38,38,.3)', padding:'7px 14px', borderRadius:8, cursor:'pointer', fontSize:12, fontWeight:700 }}>
              ⚠️ Alerte campus
            </button>
            <button onClick={()=>setModal(true)} style={{ background:'var(--rzc-navy)', color:'var(--rzc-white)', border:'none', padding:'7px 16px', borderRadius:8, cursor:'pointer', fontSize:13, fontWeight:700 }}>
              + Créer événement
            </button>
          </div>

      </div>

      {/* Alertes actives */}
      {alertes.length > 0 && (
        <div style={{ marginBottom:16 }}>
          {alertes.map(a => (
            <div key={a.id} style={{ background:`${ALERTE_COLORS[a.type_alerte]}15`, border:`1px solid ${ALERTE_COLORS[a.type_alerte]}40`, borderRadius:10, padding:'10px 14px', marginBottom:8, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div>
                <span style={{ color:ALERTE_COLORS[a.type_alerte], fontWeight:700, fontSize:12, textTransform:'uppercase', marginRight:8 }}>{a.type_alerte}</span>
                <span style={{ fontSize:13 }}>{a.message}</span>
              </div>
              {isAdmin && <button onClick={()=>alertesAPI.desactiver(a.id).then(load)} style={{ background:'none', border:'none', color:'var(--text-dim)', cursor:'pointer', fontSize:12 }}>✕ Désactiver</button>}
            </div>
          ))}
        </div>
      )}

      {/* Notification success */}
      {notifResult !== null && (
        <div style={{ background:'rgba(22,163,74,.1)', border:'1px solid rgba(22,163,74,.3)', borderRadius:10, padding:'12px 16px', marginBottom:16, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <span style={{ color:'#16a34a', fontWeight:700 }}>✅ Événement créé — {notifResult} résident(s) notifié(s) automatiquement</span>
          <button onClick={()=>setNotifResult(null)} style={{ background:'none', border:'none', cursor:'pointer', color:'#16a34a', fontSize:16 }}>✕</button>
        </div>
      )}

      {/* KPIs */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))', gap:10, marginBottom:16 }}>
        {[
          [events.length,'Total','var(--blue)','📅'],
          [upcoming.length,'À venir','#16a34a','🗓️'],
          [events.filter(e=>e.statut==='en_cours' && !estEvenementEchu(e)).length,'En cours','#ea580c','▶️'],
          [alertes.length,'Alertes actives','#dc2626','⚠️'],
        ].map(([v,l,c,ic])=>(
          <div key={l} style={{ background:'var(--rzc-white)', border:'1px solid var(--border)', borderRadius:10, padding:'12px 14px', borderTop:`3px solid ${c}`, boxShadow:'var(--shadow)' }}>
            <div style={{ fontFamily:'monospace', fontSize:24, fontWeight:700, color:c }}>{v}</div>
            <div style={{ fontSize:11, color:'var(--text-dim)', marginTop:4, textTransform:'uppercase', letterSpacing:1 }}>{ic} {l}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', gap:2, marginBottom:16, background:'var(--surface2)', borderRadius:10, padding:4, border:'1px solid var(--border)' }}>
        {[['agenda','📅 À venir'],['encours','▶️ En cours'],['passes','⏮ Passés'],['tous','📋 Tout']].map(([k,l])=>(
          <button key={k} onClick={()=>setTab(k)}
            style={{ flex:1, padding:'8px 0', borderRadius:8, border:'none', cursor:'pointer', fontSize:12, fontWeight:600,
              background:tab===k?'var(--rzc-white)':'transparent', color:tab===k?'var(--blue)':'var(--text-dim)',
              boxShadow:tab===k?'var(--shadow)':'none', transition:'.2s' }}>
            {l}
          </button>
        ))}
      </div>

      {/* Events list */}
      {loading ? <div style={{ padding:32, textAlign:'center', color:'var(--text-dim)' }}>Chargement...</div> : (
        <div>
          {(tab==='agenda'?upcoming : tab==='passes'?past : tab==='encours'?enCoursListe : events).map(evt => {
            const tc = TYPE_COLORS[evt.type_event] || TYPE_COLORS.autre
            // Un evenement dont la date est passee mais dont le statut est
            // reste sur 'planifie' (jamais demarre/termine manuellement)
            // s'affichait auparavant EXACTEMENT comme un evenement a venir -
            // meme badge "Planifie", boutons Demarrer/Notifier toujours
            // actifs. Calcule ici un etat d'affichage distinct, sans forcer
            // de changement en base (l'historique du statut choisi reste
            // intact) - "Passes" utilise deja ce meme critere de date.
            // Un evenement "en_cours" (demarre mais jamais cloture
            // manuellement) etait exclu de cette detection - ne
            // couvrait que 'planifie'. Corrige : les DEUX statuts non
            // definitifs (planifie ET en_cours) sont concernes des que
            // la date de FIN (ou de debut si pas de fin renseignee) est
            // clairement passee. Reutilise estEvenementEchu (partagee
            // avec le compteur KPI "En cours" ci-dessus) plutot que de
            // recalculer la meme chose ici.
            const estEchu = estEvenementEchu(evt)
            // Un evenement deja marque Termine manuellement (via
            // Historiser ou Terminer) n'est PAS "echu" au sens de
            // estEvenementEchu (qui ne concerne que planifie/en_cours non
            // clos) - mais il est tout aussi termine, donc les boutons QR/
            // Scanner/Notifier n'ont pas plus de sens pour lui. Les deux
            // cas partagent donc cette meme exclusion.
            const estTermine = estEchu || evt.statut === 'termine'
            const sc = estEchu ? { bg:'rgba(100,116,139,.12)', color:'var(--rzc-text-3)', label:'⏱ Échu (non démarré)' } : (STATUT_COLORS[evt.statut] || STATUT_COLORS.planifie)
            return (
              <div key={evt.id} style={{ background:'var(--rzc-white)', border:'1px solid var(--border)', borderRadius:12, padding:16, marginBottom:10, boxShadow:'var(--shadow)', display:'flex', gap:14, opacity:estEchu?0.7:1 }}>
                {/* Type icon */}
                <div style={{ width:52, height:52, borderRadius:12, background:tc.bg, display:'flex', alignItems:'center', justifyContent:'center', fontSize:24, flexShrink:0 }}>
                  {tc.icon}
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap', marginBottom:4 }}>
                    <div style={{ fontWeight:700, fontSize:14, color:'var(--blue)' }}>{evt.titre}</div>
                    {evt.obligatoire && <span style={{ background:'rgba(220,38,38,.1)', color:'#dc2626', fontSize:10, padding:'2px 7px', borderRadius:20, fontWeight:700 }}>OBLIGATOIRE</span>}
                    <span style={{ background:sc.bg, color:sc.color, fontSize:10, padding:'2px 8px', borderRadius:20, fontWeight:700 }}>{sc.label}</span>
                    <span style={{ background:tc.bg, color:tc.color, fontSize:10, padding:'2px 8px', borderRadius:20 }}>{evt.type_label}</span>
                  </div>
                  <div style={{ fontSize:12, color:'var(--text-dim)', marginBottom:6, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{evt.description}</div>
                  <div style={{ display:'flex', gap:14, fontSize:11, color:'var(--text-dim)', flexWrap:'wrap' }}>
                    <span>📅 {new Date(evt.date_debut).toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long'})} à {new Date(evt.date_debut).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})}</span>
                    {evt.lieu && <span>📍 {evt.lieu}</span>}
                    <span>👤 {evt.cree_par_nom}</span>
                    {evt.nb_notifies>0 && <span style={{ color:'#16a34a', fontWeight:700 }}>🔔 {evt.nb_notifies} résidents notifiés</span>}
                    {evt.qr_requis && <span style={{ color:'#7c3aed', fontWeight:700 }}>🎫 {evt.nb_qr_scannes} / {evt.nb_qr_generes} scannés</span>}
                  </div>
                </div>
                {evt.qr_requis && !estTermine && (
                  <button onClick={()=>{
                      setQrModal({evt}); setQrResult(null); setBoissonChoix(''); setPersonnelPourQui('')
                      if (isAdmin && personnelListe.length===0) personnelAPI.list().then(r=>setPersonnelListe(r.data.results||r.data||[])).catch(()=>{})
                    }}
                    style={{ background:'rgba(240,165,0,.12)', color:'#d08800', border:'1px solid rgba(240,165,0,.25)',
                      padding:'6px 12px', borderRadius:7, cursor:'pointer', fontSize:11, fontWeight:700, flexShrink:0, alignSelf:'flex-start' }}>
                    🎫 Mon QR
                  </button>
                )}
                {isAdmin && (
                  <div style={{ display:'flex', flexDirection:'column', gap:6, flexShrink:0 }}>
                    {evt.qr_requis && !estTermine && (
                      <button onClick={()=>{setScanModal(evt); setScanToken(''); setScanResult(null)}}
                        style={{ background:'rgba(124,58,237,.1)', color:'#7c3aed', border:'1px solid rgba(124,58,237,.2)', padding:'5px 10px', borderRadius:7, cursor:'pointer', fontSize:11, fontWeight:700 }}>
                        📷 Scanner
                      </button>
                    )}
                    {!estTermine && (
                      <button onClick={()=>notifier(evt.id,evt.titre)} style={{ background:'rgba(37,99,235,.1)', color:'var(--rzc-blue)', border:'1px solid rgba(37,99,235,.2)', padding:'5px 10px', borderRadius:7, cursor:'pointer', fontSize:11, fontWeight:700 }}>
                        🔔 Notifier
                      </button>
                    )}
                    {evt.statut==='planifie' && !estEchu && <button onClick={()=>changerStatut(evt.id,'en_cours')} style={{ background:'rgba(22,163,74,.1)', color:'#16a34a', border:'1px solid rgba(22,163,74,.2)', padding:'5px 10px', borderRadius:7, cursor:'pointer', fontSize:11 }}>▶ Démarrer</button>}
                    {evt.statut==='en_cours' && !estEchu && <button onClick={()=>changerStatut(evt.id,'termine')} style={{ background:'rgba(100,116,139,.1)', color:'var(--rzc-text-3)', border:'1px solid rgba(100,116,139,.2)', padding:'5px 10px', borderRadius:7, cursor:'pointer', fontSize:11 }}>⏹ Terminer</button>}
                    {estEchu && <button onClick={()=>{changerStatut(evt.id,'termine'); setTab('passes')}} style={{ background:'rgba(100,116,139,.1)', color:'var(--rzc-text-3)', border:'1px solid rgba(100,116,139,.2)', padding:'5px 10px', borderRadius:7, cursor:'pointer', fontSize:11 }}>📥 Historiser</button>}
                    {isAdmin && <button onClick={()=>deleteEvt(evt.id,evt.titre)}
                    style={{background:'rgba(220,38,38,.08)',color:'#dc2626',border:'1px solid rgba(220,38,38,.15)',padding:'5px 10px',borderRadius:7,cursor:'pointer',fontSize:11}}>🗑 Suppr.</button>}
                  {['planifie','en_cours'].includes(evt.statut) && !estEchu && <button onClick={()=>changerStatut(evt.id,'annule')} style={{ background:'rgba(220,38,38,.1)', color:'#dc2626', border:'1px solid rgba(220,38,38,.2)', padding:'4px 8px', borderRadius:7, cursor:'pointer', fontSize:10 }}>✕ Annuler</button>}
                  </div>
                )}
              </div>
            )
          })}
          {(tab==='agenda'?upcoming:tab==='passes'?past:events).length===0 && (
            <div style={{ background:'var(--rzc-white)', border:'1px solid var(--border)', borderRadius:12, padding:40, textAlign:'center', color:'var(--text-dim)', boxShadow:'var(--shadow)' }}>
              <div style={{ fontSize:40, marginBottom:12 }}>📅</div>
              <div style={{ fontSize:14 }}>{tab==='agenda'?"Aucun événement à venir":"Aucun événement"}</div>
            </div>
          )}
        </div>
      )}

      {/* CREATE MODAL */}
      {modal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:2000, padding:16 }}>
          <div style={{ background:'var(--rzc-white)', borderRadius:16, width:'100%', maxWidth:520, maxHeight:'90vh', overflowY:'auto', boxShadow:'0 20px 60px rgba(0,0,0,.25)' }}>
            <div style={{ padding:'16px 20px', background:'var(--blue)', borderRadius:'16px 16px 0 0', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <h3 style={{ color:'var(--rzc-white)', fontSize:15 }}>📅 Créer un événement</h3>
              <button onClick={()=>setModal(false)} style={{ background:'rgba(255,255,255,.2)', border:'none', color:'var(--rzc-white)', borderRadius:6, cursor:'pointer', width:28, height:28, fontSize:16 }}>✕</button>
            </div>
            <div style={{ padding:'18px 20px', display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))', gap:12 }}>
              {[
                ['Titre *','titre','text','span 2'],
                ['Type','type_event','select-type',''],
                ['Lieu','lieu','text',''],
                ['Date début *','date_debut','datetime-local',''],
                ['Date fin','date_fin','datetime-local',''],
                ['Description','description','textarea','span 2'],
              ].map(([l,k,t,gc])=>(
                <div key={k} style={{ gridColumn:gc||'auto' }}>
                  <label style={{ display:'block', fontSize:11, color:'var(--text-dim)', marginBottom:4, fontFamily:'monospace', textTransform:'uppercase', letterSpacing:1 }}>{l}</label>
                  {t==='textarea'
                    ? <textarea value={form[k]} onChange={e=>setForm({...form,[k]:e.target.value})} rows={3} style={{ ...inp, resize:'vertical' }}/>
                    : t==='select-type'
                    ? <select value={form[k]} onChange={e=>setForm({...form,[k]:e.target.value})} style={inp}>
                        {Object.entries(TYPE_COLORS).map(([v,{icon}])=>(
                          <option key={v} value={v}>{icon} {v.charAt(0).toUpperCase()+v.slice(1)}</option>
                        ))}
                      </select>
                    : <input type={t} value={form[k]} onChange={e=>setForm({...form,[k]:e.target.value})} style={inp}/>
                  }
                </div>
              ))}
              <div style={{ gridColumn:'span 2' }}>
                <label style={{ display:'block', fontSize:11, color:'var(--text-dim)', marginBottom:4, fontFamily:'monospace', textTransform:'uppercase', letterSpacing:1 }}>
                  Qui reçoit la notification ?
                </label>
                <select value={form.groupe_diffusion} onChange={e=>setForm({...form,groupe_diffusion:e.target.value})} style={inp}>
                  <option value="">— Aucune notification automatique —</option>
                  {groupes.map(g=><option key={g.id} value={g.id}>{g.nom} ({g.nb_personnes})</option>)}
                </select>
                <div style={{ fontSize:10.5, color:'var(--text-dim)', marginTop:3 }}>
                  Groupes gérés depuis Paramétrage → Groupes de diffusion.
                </div>
              </div>
              <div style={{ gridColumn:'span 2', display:'flex', alignItems:'center', gap:10 }}>
                <input type="checkbox" id="oblig" checked={form.obligatoire} onChange={e=>setForm({...form,obligatoire:e.target.checked})} style={{ width:16, height:16 }}/>
                <label htmlFor="oblig" style={{ fontSize:13, cursor:'pointer' }}>Participation obligatoire</label>
              </div>
              <div style={{ gridColumn:'span 2', display:'flex', alignItems:'center', gap:10 }}>
                <input type="checkbox" id="qrreq" checked={form.qr_requis} onChange={e=>setForm({...form,qr_requis:e.target.checked, propose_boisson: e.target.checked ? form.propose_boisson : false})} style={{ width:16, height:16 }}/>
                <label htmlFor="qrreq" style={{ fontSize:13, cursor:'pointer' }}>🎫 QR individuel à l'entrée (usage unique — ex: barbecue)</label>
              </div>
              {form.qr_requis && (
                <div style={{ gridColumn:'span 2', display:'flex', alignItems:'center', gap:10, marginLeft:26 }}>
                  <input type="checkbox" id="boisson" checked={form.propose_boisson} onChange={e=>setForm({...form,propose_boisson:e.target.checked})} style={{ width:16, height:16 }}/>
                  <label htmlFor="boisson" style={{ fontSize:13, cursor:'pointer' }}>🍺🥤 Proposer un choix alcool / sucrerie à la génération du QR</label>
                </div>
              )}
            </div>
            <div style={{ padding:'10px 20px', background:'rgba(22,163,74,.06)', borderTop:'1px solid rgba(22,163,74,.15)', fontSize:12, color:'#16a34a', fontWeight:600 }}>
              🔔 Les résidents actifs seront automatiquement notifiés à la création
            </div>
            <div style={{ padding:'14px 20px', borderTop:'1px solid var(--border)', display:'flex', justifyContent:'flex-end', gap:10 }}>
              <button onClick={()=>setModal(false)} style={{ background:'var(--surface2)', border:'1px solid var(--border)', color:'var(--text)', padding:'8px 16px', borderRadius:8, cursor:'pointer', fontSize:13 }}>Annuler</button>
              <button onClick={createEvt} style={{ background:'var(--rzc-navy)', color:'var(--rzc-white)', border:'none', padding:'8px 18px', borderRadius:8, cursor:'pointer', fontSize:13, fontWeight:700 }}>🚀 Créer & Notifier</button>
            </div>
          </div>
        </div>
      )}

      {/* ALERTE MODAL */}
      {alerteModal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:2000, padding:16 }}>
          <div style={{ background:'var(--rzc-white)', borderRadius:14, width:'100%', maxWidth:420, boxShadow:'0 20px 60px rgba(0,0,0,.25)' }}>
            <div style={{ padding:'14px 18px', background:'#dc2626', borderRadius:'14px 14px 0 0', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <h3 style={{ color:'var(--rzc-white)', fontSize:15 }}>⚠️ Alerte Campus</h3>
              <button onClick={()=>setAlerteModal(false)} style={{ background:'rgba(255,255,255,.2)', border:'none', color:'var(--rzc-white)', borderRadius:6, cursor:'pointer', width:28, height:28, fontSize:16 }}>✕</button>
            </div>
            <div style={{ padding:'18px 20px' }}>
              <div style={{ marginBottom:12 }}>
                <label style={{ display:'block', fontSize:11, color:'var(--text-dim)', marginBottom:4, fontFamily:'monospace', textTransform:'uppercase', letterSpacing:1 }}>Type</label>
                <div style={{ display:'flex', gap:8 }}>
                  {[['info','ℹ️ Info','var(--rzc-blue)'],['warning','⚠️ Attention','#d08800'],['danger','🚨 Urgent','#dc2626'],['success','✅ OK','#16a34a']].map(([v,l,c])=>(
                    <button key={v} onClick={()=>setAlerteForm({...alerteForm,type_alerte:v})}
                      style={{ flex:1, padding:'7px 4px', borderRadius:8, border:`2px solid ${alerteForm.type_alerte===v?c:'var(--border)'}`, background:alerteForm.type_alerte===v?`${c}15`:'var(--surface2)', color:alerteForm.type_alerte===v?c:'var(--text-dim)', cursor:'pointer', fontSize:11, fontWeight:700 }}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label style={{ display:'block', fontSize:11, color:'var(--text-dim)', marginBottom:4, fontFamily:'monospace', textTransform:'uppercase', letterSpacing:1 }}>Message *</label>
                <textarea value={alerteForm.message} onChange={e=>setAlerteForm({...alerteForm,message:e.target.value})} rows={3}
                  style={{ ...inp, resize:'vertical' }} placeholder="Message visible en temps réel par tous les utilisateurs connectés..."/>
              </div>
            </div>
            <div style={{ padding:'12px 18px', borderTop:'1px solid var(--border)', display:'flex', justifyContent:'flex-end', gap:8 }}>
              <button onClick={()=>setAlerteModal(false)} style={{ background:'var(--surface2)', border:'1px solid var(--border)', color:'var(--text)', padding:'8px 14px', borderRadius:7, cursor:'pointer', fontSize:13 }}>Annuler</button>
              <button onClick={createAlerte} style={{ background:'#dc2626', color:'var(--rzc-white)', border:'none', padding:'8px 16px', borderRadius:7, cursor:'pointer', fontSize:13, fontWeight:700 }}>⚠️ Diffuser l'alerte</button>
            </div>
          </div>
        </div>
      )}

      {/* ══ MODAL GENERATION QR (n'importe quel utilisateur, pour SOI-MEME) ══ */}
      {qrModal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.6)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, padding:16 }}
          onClick={e=>e.target===e.currentTarget && setQrModal(null)}>
          <div style={{ background:'var(--rzc-white)', borderRadius:14, maxWidth:360, width:'100%', overflow:'hidden', textAlign:'center' }}>
            <div style={{ padding:'14px 18px', background:'#d08800', color:'#fff', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div style={{ fontWeight:700, fontSize:14 }}>🎫 {qrModal.evt.titre}</div>
              <button onClick={()=>setQrModal(null)} style={{ background:'rgba(255,255,255,.2)', border:'none', color:'#fff', borderRadius:6, cursor:'pointer', width:28, height:28, fontSize:16 }}>✕</button>
            </div>
            <div style={{ padding:20 }}>
              {!qrResult ? (
                <>
                  {isAdmin && (
                    <div style={{ marginBottom:16, textAlign:'left' }}>
                      <label style={{ display:'block', fontSize:11, color:'var(--text-dim)', marginBottom:6, fontWeight:700 }}>Générer pour :</label>
                      <select value={personnelPourQui} onChange={e=>setPersonnelPourQui(e.target.value)}
                        style={{ width:'100%', border:'1px solid var(--border)', borderRadius:8, padding:'8px 10px', fontSize:13 }}>
                        <option value="">Moi-même</option>
                        {personnelListe.map(p=><option key={p.id} value={p.id}>{p.nom} {p.prenom} — {p.societe||'—'}</option>)}
                      </select>
                    </div>
                  )}
                  {qrModal.evt.propose_boisson && (
                    <div style={{ marginBottom:16, textAlign:'left' }}>
                      <label style={{ display:'block', fontSize:11, color:'var(--text-dim)', marginBottom:6, fontWeight:700 }}>Votre préférence :</label>
                      <div style={{ display:'flex', gap:8 }}>
                        {[['alcool','🍺 Alcool'],['sucrerie','🥤 Sucrerie']].map(([v,l])=>(
                          <button key={v} onClick={()=>setBoissonChoix(v)}
                            style={{ flex:1, padding:'10px 4px', borderRadius:8, border:`2px solid ${boissonChoix===v?'#d08800':'var(--border)'}`,
                              background:boissonChoix===v?'#d0880015':'var(--surface2)', color:boissonChoix===v?'#d08800':'var(--text-dim)', cursor:'pointer', fontSize:12, fontWeight:700 }}>
                            {l}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  <button onClick={async ()=>{
                      if (qrModal.evt.propose_boisson && !boissonChoix) return toast.error('Choisissez une préférence.')
                      try {
                        const r = await evtAPI.genererQr(qrModal.evt.id, boissonChoix, personnelPourQui || undefined)
                        setQrResult(r.data)
                      } catch(e) { toast.error(e.response?.data?.error || 'Erreur') }
                    }}
                    style={{ width:'100%', background:'#d08800', color:'#fff', border:'none', padding:12, borderRadius:9, cursor:'pointer', fontSize:14, fontWeight:700 }}>
                    Générer mon QR
                  </button>
                </>
              ) : (
                <>
                  <img src={'data:image/png;base64,'+qrResult.qr_image_base64} alt="QR" style={{ width:200, height:200, margin:'0 auto 12px', display:'block' }}/>
                  {qrResult.utilise ? (
                    <div style={{ color:'#dc2626', fontWeight:700, fontSize:13 }}>⚠️ Déjà scanné le {qrResult.utilise_le ? new Date(qrResult.utilise_le).toLocaleString('fr-FR') : ''}</div>
                  ) : (
                    <div style={{ color:'#16a34a', fontWeight:700, fontSize:13 }}>Présentez ce code à l'entrée — usage unique</div>
                  )}
                  {qrResult.preference_boisson_label && <div style={{ fontSize:12, color:'var(--text-dim)', marginTop:6 }}>{qrResult.preference_boisson_label}</div>}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══ MODAL SCAN (admin uniquement) ══ */}
      {scanModal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.6)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, padding:16 }}
          onClick={e=>e.target===e.currentTarget && setScanModal(null)}>
          <div style={{ background:'var(--rzc-white)', borderRadius:14, maxWidth:380, width:'100%', overflow:'hidden' }}>
            <div style={{ padding:'14px 18px', background:'#7c3aed', color:'#fff', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div style={{ fontWeight:700, fontSize:14 }}>📷 Scanner — {scanModal.titre}</div>
              <button onClick={()=>setScanModal(null)} style={{ background:'rgba(255,255,255,.2)', border:'none', color:'#fff', borderRadius:6, cursor:'pointer', width:28, height:28, fontSize:16 }}>✕</button>
            </div>
            <div style={{ padding:20 }}>
              <EvtQRScanner evenementId={scanModal.id} onResult={r=>setScanResult(r)} />
              <label style={{ display:'block', fontSize:11, color:'var(--text-dim)', marginBottom:6, fontWeight:700 }}>Ou saisir le code manuellement</label>
              <input value={scanToken} onChange={e=>setScanToken(e.target.value)}
                onKeyDown={async e=>{
                  if (e.key !== 'Enter' || !scanToken.trim()) return
                  try {
                    const r = await evtAPI.scannerQr(scanModal.id, scanToken.trim())
                    setScanResult({ok:true, ...r.data})
                  } catch(e2) { setScanResult({ok:false, ...(e2.response?.data||{erreur:'Erreur réseau'})}) }
                  setScanToken('')
                }}
                placeholder="Coller le token ici et Entrée" style={{ ...inp, marginBottom:14 }}/>
              {scanResult && (
                <div style={{ padding:14, borderRadius:9, background: scanResult.valid ? '#16a34a15' : '#dc262615',
                  border:`1px solid ${scanResult.valid ? '#16a34a40' : '#dc262640'}` }}>
                  {scanResult.valid ? (
                    <>
                      <div style={{ color:'#16a34a', fontWeight:700, fontSize:14 }}>✅ Accès validé</div>
                      <div style={{ fontSize:13, marginTop:4 }}>{scanResult.personnel_nom} · {scanResult.personnel_societe}</div>
                      {scanResult.preference_boisson && <div style={{ fontSize:12, color:'var(--text-dim)', marginTop:2 }}>{scanResult.preference_boisson}</div>}
                    </>
                  ) : (
                    <>
                      <div style={{ color:'#dc2626', fontWeight:700, fontSize:14 }}>❌ {scanResult.erreur}</div>
                      {scanResult.personnel_nom && <div style={{ fontSize:13, marginTop:4 }}>{scanResult.personnel_nom}</div>}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
