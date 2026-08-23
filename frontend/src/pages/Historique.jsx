import React, { useState, useEffect } from 'react'
import { occupationHistory, personnel as personnelAPI, batiments, voyages as voyagesAPI, qr, incidents as incAPI, inductionAPI } from '../api'

const todayStr = new Date().toISOString().slice(0,10)
const yearAgoStr = new Date(Date.now()-365*86400000).toISOString().slice(0,10)

const inp = {background:'var(--surface2)',border:'1px solid var(--border)',color:'var(--text)',padding:'8px 12px',borderRadius:8,fontSize:13,outline:'none',fontFamily:'inherit',width:'100%'}

const STATUT_V = {
  planifie:{bg:'rgba(37,99,235,.12)',color:'#2563eb',label:'Planifié'},
  en_voyage:{bg:'rgba(234,88,12,.12)',color:'#ea580c',label:'En voyage'},
  retour:{bg:'rgba(22,163,74,.12)',color:'#16a34a',label:'Retour'},
  annule:{bg:'rgba(100,116,139,.12)',color:'#64748b',label:'Annulé'},
}

function Chip({ jours }) {
  const c = jours < 7 ? '#16a34a' : jours < 30 ? '#2563eb' : '#7c3aed'
  return <span style={{background:`${c}15`,color:c,padding:'2px 9px',borderRadius:20,fontSize:11,fontWeight:700,fontFamily:'monospace'}}>{jours}j</span>
}
function Fld({ label, children }) {
  return <div><label style={{display:'block',fontSize:11,color:'var(--text-dim)',marginBottom:4,fontFamily:'monospace',textTransform:'uppercase',letterSpacing:1}}>{label}</label>{children}</div>
}
function SearchCard({ title, color, children }) {
  return (
    <div style={{background:'#fff',border:`1px solid ${color}25`,borderRadius:12,marginBottom:14,overflow:'hidden',boxShadow:'var(--shadow)'}}>
      <div style={{padding:'12px 16px',background:color,color:'#fff',fontWeight:600,fontSize:13}}>{title}</div>
      <div style={{padding:14}}>{children}</div>
    </div>
  )
}

export default function Historique() {
  const [tab, setTab] = useState('chambre')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [pers, setPers] = useState([])
  const [bats, setBats] = useState([])
  const [voyData, setVoyData] = useState(null)
  const [voyEnsemble, setVoyEnsemble] = useState(null)
  const [voyLoading, setVoyLoading] = useState(false)
  const [repasData, setRepasData] = useState([])
  const [repasLoading, setRepasLoading] = useState(false)
  const [repasFilter, setRepasFilter]   = useState('all')
  const [repasDateDebut, setRepasDateDebut] = useState('')
  const [repasDateFin, setRepasDateFin]     = useState('')
  const [repasSearch, setRepasSearch]       = useState('')

  // ── Maintenance clôturés ──
  const [maintData, setMaintData] = useState([])
  const [maintLoading, setMaintLoading] = useState(false)
  const [maintSearch, setMaintSearch] = useState('')
  const [maintDateDebut, setMaintDateDebut] = useState('')
  const [maintDateFin, setMaintDateFin] = useState('')
  const [maintSelected, setMaintSelected] = useState(null)
  const [maintSelLoading, setMaintSelLoading] = useState(false)

  const ouvrirDossierMaintenance = async (inc) => {
    setMaintSelected(inc)
    setMaintSelLoading(true)
    try {
      const r = await incAPI.detail(inc.id)
      setMaintSelected(r.data)
    } catch(e) { console.error(e) }
    finally { setMaintSelLoading(false) }
  }

  const imprimerRapport = (inc) => {
    if (!inc) return
    const fmt = (d) => d ? new Date(d).toLocaleString('fr-FR') : '—'
    // SECURITE : tout champ texte injecté dans ce HTML doit être échappé —
    // un titre/commentaire d'incident est saisi par n'importe quel employé,
    // pas seulement des admins. Sans ça, un "<script>" dans un champ
    // s'exécuterait dans la fenêtre d'impression.
    const esc = (v) => (v ?? '').toString().replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    const w = window.open('', '_blank', 'width=800,height=900')
    if (!w) return
    w.document.write(`
      <!DOCTYPE html><html lang="fr"><head><meta charset="utf-8">
      <title>Rapport intervention — ${esc(inc.titre)}</title>
      <style>
        body{font-family:Arial,sans-serif;color:#1e293b;padding:32px;max-width:700px;margin:0 auto}
        h1{font-size:20px;margin-bottom:4px}
        .meta{color:#64748b;font-size:13px;margin-bottom:20px}
        .bloc{border:1px solid #e2e8f0;border-radius:8px;padding:14px;margin-bottom:14px}
        .bloc h3{font-size:12px;text-transform:uppercase;letter-spacing:.5px;color:#64748b;margin:0 0 8px}
        .bloc.reso{background:#f0fdf4;border-color:#bbf7d0}
        .bloc.cloture{background:#f8fafc}
        .grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:13px;margin-top:14px}
        .grid div span{color:#64748b}
        .photos{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px}
        .photos img{width:100%;border-radius:8px;border:1px solid #e2e8f0}
        .photos div span{display:block;font-size:11px;font-weight:700;color:#64748b;margin-bottom:4px}
        .commentaire{background:#f8fafc;border-radius:8px;padding:10px;margin-bottom:8px;font-size:12px;page-break-inside:avoid}
        .com-head{font-size:11px;color:#64748b;margin-bottom:4px}
        .com-photo{width:100%;max-width:220px;border-radius:6px;border:1px solid #e2e8f0;display:block;margin-top:6px}
        .footer{margin-top:30px;font-size:11px;color:#94a3b8;text-align:center}
        @media print{body{padding:0}}
      </style></head>
      <body>
        <h1>${esc(inc.titre) || 'Dossier de maintenance'}</h1>
        <div class="meta">${esc(inc.residence)} · ${esc(inc.categorie)} · Priorité : ${esc(inc.priorite) || '—'} · Statut : Clôturé</div>

        ${(inc.photo_base64 || inc.photo_resolution_base64) ? `
        <div class="photos">
          ${inc.photo_base64 ? `<div><span>📷 Photo avant</span><img src="data:${esc(inc.photo_mime)||'image/jpeg'};base64,${inc.photo_base64}"/></div>` : ''}
          ${inc.photo_resolution_base64 ? `<div><span>📷 Photo après</span><img src="data:image/jpeg;base64,${inc.photo_resolution_base64}"/></div>` : ''}
        </div>` : ''}

        <div class="bloc">
          <h3>Description de l'incident</h3>
          <div>${esc(inc.description) || '—'}</div>
        </div>

        ${inc.commentaire_resolution ? `
        <div class="bloc reso">
          <h3>✅ Rapport d'intervention / Résolution</h3>
          <div>${esc(inc.commentaire_resolution)}</div>
          <div class="meta" style="margin-top:8px;margin-bottom:0">Résolu le ${fmt(inc.date_resolution)}</div>
        </div>` : ''}

        ${inc.commentaire_cloture ? `
        <div class="bloc cloture">
          <h3>🔒 Commentaire de clôture</h3>
          <div>${esc(inc.commentaire_cloture)}</div>
          <div class="meta" style="margin-top:8px;margin-bottom:0">Clôturé le ${fmt(inc.date_cloture)}</div>
        </div>` : ''}

        <div class="grid">
          <div><span>Créé le :</span> <b>${fmt(inc.date_creation)}</b></div>
          <div><span>Déclaré par :</span> <b>${esc(inc.auteur_nom) || '—'}</b></div>
          <div><span>Assigné à :</span> <b>${esc(inc.assigne_nom) || '—'}</b></div>
        </div>

        ${(inc.commentaires && inc.commentaires.length > 0) ? `
        <div class="bloc" style="margin-top:14px">
          <h3>💬 Historique des commentaires</h3>
          ${inc.commentaires.map(c => `
            <div class="commentaire">
              <div class="com-head"><b>${esc(c.auteur_nom||c.auteur) || '—'}</b>${(c.date_creation||c.date) ? ` — ${fmt(c.date_creation||c.date)}` : ''}</div>
              <div>${esc(c.contenu||c.texte||c.commentaire)}</div>
              ${c.photo_base64 ? `<img class="com-photo" src="data:image/jpeg;base64,${c.photo_base64}"/>` : ''}
            </div>
          `).join('')}
        </div>` : ''}

        <div class="footer">RZI Camp — Roxgold Sango — Imprimé le ${fmt(new Date())}</div>
      </body></html>
    `)
    w.document.close()
    w.onload = () => { w.focus(); w.print() }
  }

  const maintFiltered = React.useMemo(() => {
    let f = maintData
    if (maintSearch) {
      const s = maintSearch.toLowerCase()
      f = f.filter(i => [i.titre, i.residence, i.categorie].some(v => (v||'').toLowerCase().includes(s)))
    }
    if (maintDateDebut) f = f.filter(i => i.date_cloture && i.date_cloture.slice(0,10) >= maintDateDebut)
    if (maintDateFin) f = f.filter(i => i.date_cloture && i.date_cloture.slice(0,10) <= maintDateFin)
    return f
  }, [maintData, maintSearch, maintDateDebut, maintDateFin])

  const loadMaintenance = () => {
    setMaintLoading(true)
    incAPI.list({ statut: 'cloture', page_size: 2000 })
      .then(r => setMaintData(r.data.results || r.data || []))
      .catch(() => setMaintData([]))
      .finally(() => setMaintLoading(false))
  }

  // ── Induction QHSE ──
  const [inductionData, setInductionData] = useState([])
  const [inductionLoading, setInductionLoading] = useState(false)
  const [inductionSearch, setInductionSearch] = useState('')
  const [inductionStatFilter, setInductionStatFilter] = useState('')

  const inductionFiltered = React.useMemo(() => {
    let f = inductionData
    if (inductionSearch) {
      const s = inductionSearch.toLowerCase()
      f = f.filter(r => {
        const p = r.personnel_detail || {}
        return [p.nom, p.prenom, p.societe].some(v => (v||'').toLowerCase().includes(s))
      })
    }
    if (inductionStatFilter) f = f.filter(r => r.statut === inductionStatFilter)
    return f
  }, [inductionData, inductionSearch, inductionStatFilter])

  const loadInduction = () => {
    setInductionLoading(true)
    inductionAPI.list({ page_size: 2000 })
      .then(r => setInductionData(r.data.results || r.data || []))
      .catch(() => setInductionData([]))
      .finally(() => setInductionLoading(false))
  }

  // Données filtrées côté client
  const repasFiltered = React.useMemo(() => {
    let filtered = repasData
    if (repasSearch) {
      const s = repasSearch.toLowerCase()
      filtered = filtered.filter(r =>
        (r.resident||'').toLowerCase().includes(s) ||
        (r.societe||'').toLowerCase().includes(s)
      )
    }
    if (repasDateDebut) {
      filtered = filtered.filter(r => r.date_validation && r.date_validation.slice(0,10) >= repasDateDebut)
    }
    if (repasDateFin) {
      filtered = filtered.filter(r => r.date_validation && r.date_validation.slice(0,10) <= repasDateFin)
    }
    return filtered
  }, [repasData, repasSearch, repasDateDebut, repasDateFin])

  // Chambre search — résidence optionnelle, recherche sur tout si vide
  const [chambreQ, setChambreQ] = useState({
    batiment:'',     // dropdown sélection
    batiment_saisie:'', // saisie libre
    nom:'',          // nom occupant (saisie libre)
    date_debut: yearAgoStr,
    date_fin: todayStr
  })
  const [personneQ, setPersonneQ] = useState({personnel:'', date_debut:yearAgoStr, date_fin:todayStr})
  const [selPers, setSelPers] = useState('')

  useEffect(() => {
    personnelAPI.list({page_size:500}).then(r => setPers(r.data.results||r.data))
    batiments.list({page_size:300}).then(r => {
      const items = r.data.results||r.data
      setBats([...items].sort((a,b)=>a.residence.localeCompare(b.residence,undefined,{numeric:true})))
    })
    voyagesAPI.vueEnsemble().then(r => setVoyEnsemble(r.data)).catch(()=>{})
  }, [])

  const searchChambre = async () => {
    setLoading(true); setResults([]); setSearched(true)
    try {
      const p = {}
      const bat = chambreQ.batiment_saisie || chambreQ.batiment
      if (bat) p.batiment = bat
      if (chambreQ.nom) p.nom = chambreQ.nom
      if (chambreQ.date_debut) p.date_debut = chambreQ.date_debut
      if (chambreQ.date_fin) p.date_fin = chambreQ.date_fin
      // If no filter at all, still search (show all)
      const r = await occupationHistory.recherche(p)
      setResults(r.data.results||r.data||[])
    } catch(e) { alert('Erreur: '+(e.response?.data?JSON.stringify(e.response.data):e.message)) }
    finally { setLoading(false) }
  }

  const searchPersonne = async () => {
    if (!personneQ.personnel) return alert('Sélectionner un membre du personnel')
    setLoading(true); setResults([]); setSearched(true)
    try {
      const r = await occupationHistory.recherche({
        personnel: personneQ.personnel,
        date_debut: personneQ.date_debut,
        date_fin: personneQ.date_fin,
      })
      setResults(r.data.results||r.data||[])
    } catch(e) { alert('Erreur: '+(e.response?.data?JSON.stringify(e.response.data):e.message)) }
    finally { setLoading(false) }
  }

  const searchVoyages = async () => {
    if (!selPers) return alert('Sélectionner un membre')
    setVoyLoading(true); setVoyData(null)
    try {
      const r = await personnelAPI.historiqueVoyages(selPers)
      setVoyData(r.data)
    } catch(e) { alert('Erreur: '+(e.response?.data?JSON.stringify(e.response.data):e.message)) }
    finally { setVoyLoading(false) }
  }



  // repasFiltered remplacé par repasFiltered (useMemo)

  const exportRepasCSV = () => {
    if (!repasFiltered.length) return
    const headers = ['Personnel','Société','Type repas','Date','Heure','Validé par']
    const rows = repasFiltered.map(r => {
      const dt = r.date_validation ? new Date(r.date_validation) : null
      return [
        r.resident || '',
        r.societe || '',
        r.type_repas_label || r.type_repas || '',
        dt ? dt.toLocaleDateString('fr-FR') : '',
        dt ? dt.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}) : '',
        r.valide_par_nom || ''
      ]
    })
    const csv = [headers, ...rows].map(row => row.map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `repas_restauration_${new Date().toISOString().slice(0,10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const telechargerCSV = (headers, rows, filename) => {
    const csv = [headers, ...rows].map(row => row.map(v => `"${String(v??'').replace(/"/g,'""')}"`).join(',')).join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  const exportMaintenanceCSV = () => {
    if (!maintFiltered.length) return
    telechargerCSV(
      ['Titre','Catégorie','Résidence','Priorité','Créé le','Clôturé le'],
      maintFiltered.map(i => [
        i.titre || '', i.categorie || '', i.residence || '', i.priorite || '',
        i.date_creation ? new Date(i.date_creation).toLocaleDateString('fr-FR') : '',
        i.date_cloture ? new Date(i.date_cloture).toLocaleDateString('fr-FR') : '',
      ]),
      `maintenance_clotures_${new Date().toISOString().slice(0,10)}.csv`
    )
  }

  const exportInductionCSV = () => {
    if (!inductionFiltered.length) return
    const STATUT_LABEL = { en_cours:'En cours', valide:'Validé — Induit', refuse:'Refusé', expire:'Expiré' }
    telechargerCSV(
      ['Nom','Société','Statut','Progression (%)','Score quiz (%)','Débuté le','Terminé le','Badge émis'],
      inductionFiltered.map(r => {
        const p = r.personnel_detail || {}
        return [
          `${p.nom||''} ${p.prenom||''}`.trim(), p.societe || '',
          STATUT_LABEL[r.statut] || r.statut || '',
          r.progression ?? 0, r.quiz_score ?? '',
          r.date_debut ? new Date(r.date_debut).toLocaleDateString('fr-FR') : '',
          r.date_fin ? new Date(r.date_fin).toLocaleDateString('fr-FR') : '',
          r.badge_emis ? 'Oui' : 'Non',
        ]
      }),
      `induction_qhse_${new Date().toISOString().slice(0,10)}.csv`
    )
  }

  const loadRepas = async () => {
    setRepasLoading(true)
    try {
      const p = repasFilter !== 'all' ? { type_repas: repasFilter } : {}
      const r = await qr.historiqueScans(p)
      setRepasData(r.data.results || r.data || [])
    } catch(e) { console.error(e) }
    finally { setRepasLoading(false) }
  }

  const exportChambre = () => {
    const bat = chambreQ.batiment_saisie || chambreQ.batiment
    const p = {}
    if (bat) p.batiment = bat
    if (chambreQ.nom) p.nom = chambreQ.nom
    window.open(occupationHistory.exportCsv(p), '_blank')
  }

  const TABS = [
    ['chambre','🏠 Occupation chambres'],
    ['personne','👤 Parcours d\'un résident'],
    ['voyages_pers','✈️ Voyages personnel'],
    ['ensemble','🌍 Tous les voyages'],
    ['repas','🍽️ Restaurant'],
    ['maintenance','🛠️ Maintenance (clôturés)'],
    ['induction','🎓 Induction QHSE'],
  ]

  return (
    <div style={{padding:'16px'}}>
      <div style={{marginBottom:16}}>
        <h2 style={{fontSize:19,fontWeight:700,color:'var(--blue)',marginBottom:3}}>📋 Historisation & Recherche</h2>
        <p style={{fontSize:12,color:'var(--text-dim)'}}>Toutes les chambres · Qui a dormi où · Parcours · Voyages · Export CSV</p>
      </div>

      {/* TABS */}
      <div style={{display:'flex',gap:2,marginBottom:16,background:'var(--surface2)',borderRadius:10,padding:4,border:'1px solid var(--border)'}}>
        {TABS.map(([k,l])=>(
          <button key={k} onClick={()=>{setTab(k);setResults([]);setVoyData(null);setSearched(false); if(k==='maintenance') loadMaintenance(); if(k==='induction') loadInduction()}}
            style={{flex:1,padding:'8px 4px',borderRadius:8,border:'none',cursor:'pointer',fontSize:11,fontWeight:600,
              background:tab===k?'#fff':'transparent',color:tab===k?'var(--blue)':'var(--text-dim)',
              boxShadow:tab===k?'var(--shadow)':'none',transition:'.2s'}}>
            {l}
          </button>
        ))}
      </div>

      {/* ── CHAMBRE ── */}
      {tab==='chambre' && (
        <div>
          <SearchCard title="🏠 Occupation des chambres — Tous filtres optionnels" color="var(--blue)">
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:12}}>
              <Fld label="Résidence (liste)">
                <select value={chambreQ.batiment} onChange={e=>setChambreQ({...chambreQ,batiment:e.target.value,batiment_saisie:''})} style={inp}>
                  <option value="">— Toutes les résidences —</option>
                  {bats.map(b=><option key={b.id} value={b.residence}>{b.residence} ({b.bloc})</option>)}
                </select>
              </Fld>
              <Fld label="Résidence (saisie libre)">
                <input value={chambreQ.batiment_saisie}
                  onChange={e=>setChambreQ({...chambreQ,batiment_saisie:e.target.value,batiment:''})}
                  style={inp} placeholder="Ex: A3, B1, Bloc_A1..."/>
              </Fld>
              <Fld label="Nom occupant (saisie libre)">
                <input value={chambreQ.nom} onChange={e=>setChambreQ({...chambreQ,nom:e.target.value})}
                  style={inp} placeholder="Nom, prénom ou résidence..."/>
              </Fld>
              <div/>
              <Fld label="Du">
                <input type="date" value={chambreQ.date_debut} onChange={e=>setChambreQ({...chambreQ,date_debut:e.target.value})} style={inp}/>
              </Fld>
              <Fld label="Au">
                <input type="date" value={chambreQ.date_fin} onChange={e=>setChambreQ({...chambreQ,date_fin:e.target.value})} style={inp}/>
              </Fld>
            </div>
            <div style={{display:'flex',gap:10,alignItems:'center',justifyContent:'space-between',flexWrap:'wrap'}}>
              <div style={{fontSize:12,color:'var(--text-dim)'}}>
                💡 Sans filtre → affiche <b>toutes les occupations</b>
              </div>
              <div style={{display:'flex',gap:8}}>
                <button onClick={()=>{setChambreQ({batiment:'',batiment_saisie:'',nom:'',date_debut:yearAgoStr,date_fin:todayStr})}}
                  style={{background:'var(--surface2)',border:'1px solid var(--border)',color:'var(--text-dim)',padding:'8px 14px',borderRadius:8,cursor:'pointer',fontSize:12}}>
                  ✕ Reset
                </button>
                <button onClick={searchChambre} disabled={loading}
                  style={{background:'var(--blue)',color:'#fff',border:'none',padding:'9px 22px',borderRadius:8,cursor:'pointer',fontSize:13,fontWeight:700}}>
                  {loading?'Recherche...':'🔍 Rechercher'}
                </button>
              </div>
            </div>
          </SearchCard>

          {results.length>0 && (
            <div style={{marginBottom:10,display:'flex',justifyContent:'flex-end'}}>
              <button onClick={exportChambre}
                style={{background:'#16a34a',color:'#fff',border:'none',padding:'7px 16px',borderRadius:8,cursor:'pointer',fontSize:12,fontWeight:700}}>
                ⬇ Export CSV ({results.length})
              </button>
            </div>
          )}
          <ResultsTable results={results} loading={loading} searched={searched} type="chambre"/>
        </div>
      )}

      {/* ── PERSONNE ── */}
      {tab==='personne' && (
        <div>
          <SearchCard title="👤 Où a dormi cette personne ?" color="#7c3aed">
            <div style={{display:'grid',gridTemplateColumns:'2fr 1fr 1fr',gap:10,alignItems:'end'}}>
              <Fld label="Personnel *">
                <select value={personneQ.personnel} onChange={e=>setPersonneQ({...personneQ,personnel:e.target.value})} style={inp}>
                  <option value="">— Sélectionner —</option>
                  {pers.map(p=><option key={p.id} value={p.id}>{p.nom} {p.prenom} · {p.societe}</option>)}
                </select>
              </Fld>
              <Fld label="Du"><input type="date" value={personneQ.date_debut} onChange={e=>setPersonneQ({...personneQ,date_debut:e.target.value})} style={inp}/></Fld>
              <Fld label="Au"><input type="date" value={personneQ.date_fin} onChange={e=>setPersonneQ({...personneQ,date_fin:e.target.value})} style={inp}/></Fld>
            </div>
            <div style={{display:'flex',justifyContent:'flex-end',marginTop:12}}>
              <button onClick={searchPersonne} disabled={loading}
                style={{background:'#7c3aed',color:'#fff',border:'none',padding:'9px 22px',borderRadius:8,cursor:'pointer',fontSize:13,fontWeight:700}}>
                {loading?'Recherche...':'🔍 Rechercher'}
              </button>
            </div>
          </SearchCard>
          {results.length>0 && (
            <div style={{marginBottom:10,display:'flex',justifyContent:'flex-end'}}>
              <button onClick={()=>window.open(occupationHistory.exportCsv({personnel:personneQ.personnel}),'_blank')}
                style={{background:'#16a34a',color:'#fff',border:'none',padding:'7px 16px',borderRadius:8,cursor:'pointer',fontSize:12,fontWeight:700}}>
                ⬇ Export CSV
              </button>
            </div>
          )}
          <ResultsTable results={results} loading={loading} searched={searched} type="personne"/>
        </div>
      )}

      {/* ── VOYAGES PERSONNEL ── */}
      {tab==='voyages_pers' && (
        <div>
          <SearchCard title="✈️ Voyages d'un personnel" color="#ea580c">
            <div style={{display:'grid',gridTemplateColumns:'3fr auto',gap:10,alignItems:'end'}}>
              <Fld label="Personnel *">
                <select value={selPers} onChange={e=>setSelPers(e.target.value)} style={inp}>
                  <option value="">— Sélectionner —</option>
                  {pers.map(p=><option key={p.id} value={p.id}>{p.nom} {p.prenom} · {p.societe}</option>)}
                </select>
              </Fld>
              <button onClick={searchVoyages} disabled={voyLoading}
                style={{background:'#ea580c',color:'#fff',border:'none',padding:'9px 22px',borderRadius:8,cursor:'pointer',fontSize:13,fontWeight:700}}>
                {voyLoading?'Chargement...':'🔍 Voir'}
              </button>
            </div>
          </SearchCard>

          {voyData && (
            <div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(4, minmax(0, 1fr))',gap:10,marginBottom:14}}>
                {[[voyData.total_voyages,'Total','var(--blue)','✈️'],[voyData.en_voyage||0,'En voyage','#ea580c','🚀'],
                  [voyData.destinations_uniques?.length||0,'Destinations','#7c3aed','📍'],
                  [(voyData.voyages||[]).filter(v=>v.statut==='retour'||v.statut?.includes('Retour')).length,'Retours','#16a34a','🏠']
                ].map(([v,l,c,ic])=>(
                  <div key={l} style={{background:'#fff',border:'1px solid var(--border)',borderRadius:10,padding:14,borderTop:`3px solid ${c}`,boxShadow:'var(--shadow)'}}>
                    <div style={{fontFamily:'monospace',fontSize:24,fontWeight:700,color:c}}>{v}</div>
                    <div style={{fontSize:10,color:'var(--text-dim)',marginTop:4,textTransform:'uppercase',letterSpacing:1}}>{ic} {l}</div>
                  </div>
                ))}
              </div>

              {voyData.destinations_uniques?.length>0 && (
                <div style={{background:'#fff',border:'1px solid var(--border)',borderRadius:10,padding:12,marginBottom:12,boxShadow:'var(--shadow)'}}>
                  <div style={{fontSize:11,color:'var(--text-dim)',fontFamily:'monospace',textTransform:'uppercase',letterSpacing:1,marginBottom:8}}>📍 Destinations</div>
                  <div style={{display:'flex',flexWrap:'wrap',gap:8}}>
                    {voyData.destinations_uniques.map(d=>(
                      <span key={d} style={{background:'rgba(234,88,12,.1)',color:'#ea580c',border:'1px solid rgba(234,88,12,.2)',padding:'4px 12px',borderRadius:20,fontSize:12,fontWeight:600}}>{d}</span>
                    ))}
                  </div>
                </div>
              )}

              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
                <div style={{fontWeight:600,color:'var(--blue)',fontSize:13}}>✈️ {voyData.total_voyages} voyage(s) — {voyData.personnel}</div>
                <button onClick={()=>window.open(voyagesAPI.exportCsv({personnel:selPers}),'_blank')}
                  style={{background:'#16a34a',color:'#fff',border:'none',padding:'6px 14px',borderRadius:7,cursor:'pointer',fontSize:12,fontWeight:700}}>
                  ⬇ Export CSV
                </button>
              </div>
              <VoyageTable voyages={voyData.voyages||[]}/>
            </div>
          )}
          {!voyData&&!voyLoading&&searched===false&&<EmptyState icon="✈️" text="Sélectionner un personnel et cliquer Voir"/>}
        </div>
      )}

      {/* ── TOUS LES VOYAGES ── */}
      {tab==='ensemble' && (
        <div>
          {voyEnsemble?(
            <div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(4, minmax(0, 1fr))',gap:10,marginBottom:14}}>
                {[[voyEnsemble.total,'Total voyages','var(--blue)','✈️'],[voyEnsemble.en_voyage,'En voyage','#ea580c','🚀'],
                  [voyEnsemble.destinations_uniques?.length||0,'Destinations','#7c3aed','📍'],
                  [voyEnsemble.top_voyageurs?.[0]?.nb||0,'Max/personne','#16a34a','🏆']
                ].map(([v,l,c,ic])=>(
                  <div key={l} style={{background:'#fff',border:'1px solid var(--border)',borderRadius:10,padding:14,borderTop:`3px solid ${c}`,boxShadow:'var(--shadow)'}}>
                    <div style={{fontFamily:'monospace',fontSize:24,fontWeight:700,color:c}}>{v}</div>
                    <div style={{fontSize:10,color:'var(--text-dim)',marginTop:4,textTransform:'uppercase',letterSpacing:1}}>{ic} {l}</div>
                  </div>
                ))}
              </div>

              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14,marginBottom:14}}>
                {/* Top voyageurs */}
                <div style={{background:'#fff',border:'1px solid var(--border)',borderRadius:12,overflow:'hidden',boxShadow:'var(--shadow)'}}>
                  <div style={{padding:'10px 14px',background:'var(--blue)',color:'#fff',fontWeight:600,fontSize:13}}>🏆 Top voyageurs</div>
                  <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
                    <thead><tr style={{background:'var(--surface2)'}}>
                      {['Personnel','Société','Voyages'].map(h=><th key={h} style={{padding:'7px 12px',textAlign:'left',fontSize:10,fontFamily:'monospace',color:'var(--text-dim)',letterSpacing:1,textTransform:'uppercase',fontWeight:500}}>{h}</th>)}
                    </tr></thead>
                    <tbody>
                      {(voyEnsemble.top_voyageurs||[]).map((t,i)=>(
                        <tr key={i} style={{borderTop:'1px solid var(--border)',background:i%2?'var(--surface2)':'#fff'}}>
                          <td style={{padding:'8px 12px',fontWeight:600}}>{t.personnel__nom} {t.personnel__prenom}</td>
                          <td style={{padding:'8px 12px',fontSize:11,color:'var(--text-dim)'}}>{t.personnel__societe}</td>
                          <td style={{padding:'8px 12px',fontFamily:'monospace',fontWeight:700,color:'var(--blue)'}}>{t.nb}</td>
                        </tr>
                      ))}
                      {(!voyEnsemble.top_voyageurs||voyEnsemble.top_voyageurs.length===0)&&
                        <tr><td colSpan={3} style={{padding:20,textAlign:'center',color:'var(--text-dim)',fontSize:12}}>Aucun voyage enregistré</td></tr>}
                    </tbody>
                  </table>
                </div>
                {/* Destinations */}
                <div style={{background:'#fff',border:'1px solid var(--border)',borderRadius:12,padding:14,boxShadow:'var(--shadow)'}}>
                  <div style={{fontSize:13,fontWeight:600,color:'var(--blue)',marginBottom:10}}>📍 Destinations visitées</div>
                  {voyEnsemble.destinations_uniques?.length>0
                    ? <div style={{display:'flex',flexWrap:'wrap',gap:8}}>
                        {voyEnsemble.destinations_uniques.map(d=>(
                          <span key={d} style={{background:'rgba(234,88,12,.1)',color:'#ea580c',border:'1px solid rgba(234,88,12,.2)',padding:'4px 12px',borderRadius:20,fontSize:12,fontWeight:600}}>{d}</span>
                        ))}
                      </div>
                    : <div style={{color:'var(--text-dim)',fontSize:12}}>Aucune destination enregistrée</div>
                  }
                </div>
              </div>

              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
                <div style={{fontWeight:600,color:'var(--blue)',fontSize:13}}>Tous les voyages ({voyEnsemble.total})</div>
                <button onClick={()=>window.open(voyagesAPI.exportCsv({}),'_blank')}
                  style={{background:'#16a34a',color:'#fff',border:'none',padding:'6px 14px',borderRadius:7,cursor:'pointer',fontSize:12,fontWeight:700}}>
                  ⬇ Export CSV complet
                </button>
              </div>
              <VoyageTable voyages={voyEnsemble.voyages||[]} showPersonnel/>
            </div>
          ):<div style={{padding:40,textAlign:'center',color:'var(--text-dim)'}}>Chargement...</div>}
        </div>
      )}

      {/* ── RESTAURANT ── */}
      {tab==='repas' && (
        <div>
          <SearchCard title="🍽️ Historique des repas restaurant" color="#7c3aed">
            <div style={{display:'flex',gap:8,marginBottom:8,flexWrap:'wrap',alignItems:'center'}}>
              {/* Filtre type repas */}
              <select value={repasFilter} onChange={e=>{setRepasFilter(e.target.value);loadRepas()}}
                style={{background:'var(--surface2)',border:'1px solid var(--border)',color:'var(--text)',padding:'8px 12px',borderRadius:8,fontSize:13,minWidth:140}}>
                <option value="all">🍽️ Tous les repas</option>
                <option value="petit_dejeuner">🌅 Petit-déjeuner</option>
                <option value="dejeuner">☀️ Déjeuner</option>
                <option value="diner">🌙 Dîner</option>
              </select>

              {/* Filtre date début */}
              <input type="date" value={repasDateDebut||''} onChange={e=>setRepasDateDebut(e.target.value)}
                placeholder="Date début"
                style={{background:'var(--surface2)',border:'1px solid var(--border)',color:'var(--text)',padding:'8px 10px',borderRadius:8,fontSize:13}} />

              {/* Filtre date fin */}
              <input type="date" value={repasDateFin||''} onChange={e=>setRepasDateFin(e.target.value)}
                placeholder="Date fin"
                style={{background:'var(--surface2)',border:'1px solid var(--border)',color:'var(--text)',padding:'8px 10px',borderRadius:8,fontSize:13}} />

              {/* Recherche personne */}
              <input type="text" value={repasSearch||''} onChange={e=>setRepasSearch(e.target.value)}
                placeholder="🔍 Nom du résident..."
                style={{background:'var(--surface2)',border:'1px solid var(--border)',color:'var(--text)',padding:'8px 12px',borderRadius:8,fontSize:13,minWidth:160}} />

              <button onClick={loadRepas} disabled={repasLoading}
                style={{background:'#7c3aed',color:'#fff',border:'none',padding:'8px 16px',borderRadius:8,cursor:'pointer',fontSize:13,fontWeight:700}}>
                {repasLoading?'⏳ Recherche...':'🔍 Rechercher'} Actualiser
              </button>

              {/* Reset filtres */}
              {(repasDateDebut||repasDateFin||repasSearch) && (
                <button onClick={()=>{setRepasDateDebut('');setRepasDateFin('');setRepasSearch('');loadRepas()}}
                  style={{background:'rgba(100,116,139,.1)',color:'#64748b',border:'1px solid rgba(100,116,139,.2)',padding:'8px 12px',borderRadius:8,cursor:'pointer',fontSize:12,fontWeight:600}}>
                  ✕ Reset
                </button>
              )}

              {repasFiltered.length > 0 && (
                <button onClick={exportRepasCSV}
                  style={{background:'rgba(124,58,237,.1)',color:'#7c3aed',border:'1px solid rgba(124,58,237,.3)',padding:'8px 14px',borderRadius:8,cursor:'pointer',fontSize:13,fontWeight:700}}>
                  ⬇ Export CSV ({repasFiltered.length})
                </button>
              )}
            </div>
          </SearchCard>

          {repasFiltered.length > 0 ? (
            <div style={{background:'#fff',border:'1px solid var(--border)',borderRadius:12,overflow:'hidden',boxShadow:'var(--shadow)'}}>
              <div style={{padding:'10px 16px',background:'#7c3aed',color:'#fff',fontWeight:600,fontSize:13,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <span>📋 {repasFiltered.length}/{repasData.length} scan(s) de repas</span>
                <button onClick={exportRepasCSV}
                  style={{background:'rgba(255,255,255,.2)',color:'#fff',border:'1px solid rgba(255,255,255,.4)',padding:'4px 12px',borderRadius:20,cursor:'pointer',fontSize:12,fontWeight:600}}>
                  ⬇ CSV
                </button>
              </div>
              <div style={{overflowX:'auto',maxHeight:500,overflowY:'auto'}}>
                <table style={{width:'100%',borderCollapse:'collapse',fontSize:12.5}}>
                  <thead><tr style={{background:'var(--surface2)'}}>
                    {['Personnel','Société','Type repas','Date/Hora','Validé par'].map(h=>(
                      <th key={h} style={{padding:'9px 12px',textAlign:'left',fontSize:10,fontFamily:'monospace',color:'var(--text-dim)',letterSpacing:1,textTransform:'uppercase'}}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {repasFiltered.map((r,i)=>{
                      const dt = r.date_validation ? new Date(r.date_validation) : null
                      return (
                        <tr key={r.id||i} style={{borderTop:'1px solid var(--border)',background:i%2?'var(--surface2)':'#fff'}}>
                          <td style={{padding:'9px 12px',fontWeight:600,color:'var(--blue)'}}>{r.resident||'—'}</td>
                          <td style={{padding:'9px 12px',fontSize:12,color:'var(--text-dim)'}}>{r.societe||'—'}</td>
                          <td style={{padding:'9px 12px'}}><span style={{background:'rgba(124,58,237,.12)',color:'#7c3aed',padding:'3px 8px',borderRadius:20,fontSize:11,fontWeight:700}}>{r.type_repas_label||r.type_repas}</span></td>
                          <td style={{padding:'9px 12px',fontFamily:'monospace',fontSize:11}}>
                            {dt ? dt.toLocaleDateString('fr-FR') + ' ' + dt.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}) : '—'}
                          </td>
                          <td style={{padding:'9px 12px',fontSize:11,color:'var(--text-dim)'}}>{r.valide_par_nom||'—'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <EmptyState icon="🍽️" text="Aucun scan enregistré. Utilisez la page Restaurant pour scanner les repas."/>
          )}
        </div>
      )}

      {tab==='maintenance' && (
        <div>
          <SearchCard title="🛠️ Historique des dossiers de maintenance clôturés" color="#5B6472">
            <div style={{display:'flex',gap:8,marginBottom:8,flexWrap:'wrap',alignItems:'center'}}>
              <input type="date" value={maintDateDebut||''} onChange={e=>setMaintDateDebut(e.target.value)}
                placeholder="Date clôture début"
                style={{background:'var(--surface2)',border:'1px solid var(--border)',color:'var(--text)',padding:'8px 10px',borderRadius:8,fontSize:13}} />

              <input type="date" value={maintDateFin||''} onChange={e=>setMaintDateFin(e.target.value)}
                placeholder="Date clôture fin"
                style={{background:'var(--surface2)',border:'1px solid var(--border)',color:'var(--text)',padding:'8px 10px',borderRadius:8,fontSize:13}} />

              <input type="text" value={maintSearch||''} onChange={e=>setMaintSearch(e.target.value)}
                placeholder="🔍 Titre, résidence, catégorie..."
                style={{background:'var(--surface2)',border:'1px solid var(--border)',color:'var(--text)',padding:'8px 12px',borderRadius:8,fontSize:13,minWidth:160}} />

              <button onClick={loadMaintenance} disabled={maintLoading}
                style={{background:'#5B6472',color:'#fff',border:'none',padding:'8px 16px',borderRadius:8,cursor:'pointer',fontSize:13,fontWeight:700}}>
                {maintLoading?'⏳ Recherche...':'🔍 Actualiser'}
              </button>

              {(maintDateDebut||maintDateFin||maintSearch) && (
                <button onClick={()=>{setMaintDateDebut('');setMaintDateFin('');setMaintSearch('')}}
                  style={{background:'rgba(100,116,139,.1)',color:'#64748b',border:'1px solid rgba(100,116,139,.2)',padding:'8px 12px',borderRadius:8,cursor:'pointer',fontSize:12,fontWeight:600}}>
                  ✕ Reset
                </button>
              )}

              {maintFiltered.length > 0 && (
                <button onClick={exportMaintenanceCSV}
                  style={{background:'rgba(22,163,74,.1)',color:'#16a34a',border:'1px solid rgba(22,163,74,.3)',padding:'8px 14px',borderRadius:8,cursor:'pointer',fontSize:13,fontWeight:700}}>
                  ⬇ Export CSV ({maintFiltered.length})
                </button>
              )}
            </div>
          </SearchCard>

          {maintFiltered.length > 0 ? (
            <div style={{background:'#fff',border:'1px solid var(--border)',borderRadius:12,overflow:'hidden',boxShadow:'var(--shadow)'}}>
              <div style={{padding:'10px 16px',background:'#5B6472',color:'#fff',fontWeight:600,fontSize:13}}>
                📋 {maintFiltered.length}/{maintData.length} dossier(s) clôturé(s)
              </div>
              <div style={{overflowX:'auto',maxHeight:500,overflowY:'auto'}}>
                <table style={{width:'100%',borderCollapse:'collapse',fontSize:12.5}}>
                  <thead><tr style={{background:'var(--surface2)'}}>
                    {['Titre','Catégorie','Résidence','Priorité','Créé le','Clôturé le',''].map(h=>(
                      <th key={h} style={{padding:'9px 12px',textAlign:'left',fontSize:10,fontFamily:'monospace',color:'var(--text-dim)',letterSpacing:1,textTransform:'uppercase'}}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {maintFiltered.map((i,idx)=>{
                      const dtC = i.date_creation ? new Date(i.date_creation) : null
                      const dtF = i.date_cloture ? new Date(i.date_cloture) : null
                      return (
                        <tr key={i.id||idx} onClick={()=>ouvrirDossierMaintenance(i)}
                          style={{borderTop:'1px solid var(--border)',background:idx%2?'var(--surface2)':'#fff',cursor:'pointer'}}>
                          <td style={{padding:'9px 12px',fontWeight:600,color:'var(--blue)'}}>{i.titre||'—'}</td>
                          <td style={{padding:'9px 12px',fontSize:12,color:'var(--text-dim)'}}>{i.categorie||'—'}</td>
                          <td style={{padding:'9px 12px',fontSize:12,color:'var(--text-dim)'}}>{i.residence||'—'}</td>
                          <td style={{padding:'9px 12px'}}><span style={{background:'rgba(91,100,114,.12)',color:'#5B6472',padding:'3px 8px',borderRadius:20,fontSize:11,fontWeight:700}}>{i.priorite||'—'}</span></td>
                          <td style={{padding:'9px 12px',fontFamily:'monospace',fontSize:11}}>{dtC ? dtC.toLocaleDateString('fr-FR') : '—'}</td>
                          <td style={{padding:'9px 12px',fontFamily:'monospace',fontSize:11}}>{dtF ? dtF.toLocaleDateString('fr-FR') : '—'}</td>
                          <td style={{padding:'9px 12px'}}>
                            <button onClick={(e)=>{e.stopPropagation(); ouvrirDossierMaintenance(i)}}
                              style={{background:'rgba(91,100,114,.1)',color:'#5B6472',border:'1px solid rgba(91,100,114,.25)',padding:'4px 10px',borderRadius:6,cursor:'pointer',fontSize:11,fontWeight:700,whiteSpace:'nowrap'}}>
                              📄 Rapport
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <EmptyState icon="🛠️" text={maintLoading ? "Chargement..." : "Aucun dossier de maintenance clôturé."}/>
          )}

          {maintSelected && (
            <div style={{ position:'fixed', inset:0, background:'rgba(15,36,71,.5)', zIndex:900,
              display:'flex', alignItems:'center', justifyContent:'flex-end' }}
              onClick={e=>e.target===e.currentTarget && setMaintSelected(null)}>
              <div style={{ background:'#fff', width:'100%', maxWidth:460, height:'100%', overflow:'auto', boxShadow:'-4px 0 30px rgba(0,0,0,.2)' }}>
                <div style={{ background:'linear-gradient(135deg,#5B6472,#3a4048)', color:'#fff', padding:'14px 16px', position:'sticky', top:0, zIndex:10, display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                  <div>
                    <div style={{ fontWeight:700, fontSize:15 }}>{maintSelected.titre}</div>
                    <div style={{ fontSize:11, opacity:.8, marginTop:2 }}>{maintSelected.residence} · {maintSelected.categorie} · 🔒 Clôturé</div>
                  </div>
                  <div style={{display:'flex',gap:6,alignItems:'flex-start'}}>
                    <button onClick={()=>imprimerRapport(maintSelected)}
                      title="Imprimer le rapport"
                      style={{ background:'rgba(255,255,255,.2)', border:'none', color:'#fff', width:28, height:28, borderRadius:8, cursor:'pointer', fontSize:14 }}>🖨️</button>
                    <button onClick={()=>setMaintSelected(null)}
                      style={{ background:'rgba(255,255,255,.2)', border:'none', color:'#fff', width:28, height:28, borderRadius:8, cursor:'pointer', fontSize:16 }}>✕</button>
                  </div>
                </div>

                <div style={{ padding:16 }}>
                  {maintSelLoading && <div style={{textAlign:'center',color:'var(--text-dim)',padding:20}}>⏳ Chargement du rapport...</div>}

                  <div style={{ background:'#f8fafc', borderRadius:10, padding:12, marginBottom:12 }}>
                    <div style={{ fontSize:11, fontWeight:700, color:'#64748b', marginBottom:4 }}>DESCRIPTION DE L'INCIDENT</div>
                    <div style={{ fontSize:13 }}>{maintSelected.description || '—'}</div>
                  </div>

                  {(maintSelected.photo_base64 || maintSelected.photo_resolution_base64) && (
                    <div style={{ display:'grid', gridTemplateColumns: (maintSelected.photo_base64 && maintSelected.photo_resolution_base64) ? '1fr 1fr' : '1fr', gap:10, marginBottom:12 }}>
                      {maintSelected.photo_base64 && (
                        <div>
                          <div style={{ fontSize:10, fontWeight:700, color:'#64748b', marginBottom:4 }}>📷 PHOTO AVANT</div>
                          <img src={`data:${maintSelected.photo_mime||'image/jpeg'};base64,${maintSelected.photo_base64}`}
                            style={{ width:'100%', borderRadius:8, border:'1px solid #e2e8f0', display:'block' }}
                            alt="Photo avant intervention" />
                        </div>
                      )}
                      {maintSelected.photo_resolution_base64 && (
                        <div>
                          <div style={{ fontSize:10, fontWeight:700, color:'#16a34a', marginBottom:4 }}>📷 PHOTO APRÈS</div>
                          <img src={`data:image/jpeg;base64,${maintSelected.photo_resolution_base64}`}
                            style={{ width:'100%', borderRadius:8, border:'1px solid #bbf7d0', display:'block' }}
                            alt="Photo après intervention" />
                        </div>
                      )}
                    </div>
                  )}

                  {maintSelected.commentaire_resolution && (
                    <div style={{ background:'rgba(22,163,74,.06)', border:'1px solid rgba(22,163,74,.2)', borderRadius:10, padding:12, marginBottom:12 }}>
                      <div style={{ fontSize:11, fontWeight:700, color:'#16a34a', marginBottom:4 }}>✅ RAPPORT D'INTERVENTION / RÉSOLUTION</div>
                      <div style={{ fontSize:13 }}>{maintSelected.commentaire_resolution}</div>
                      {maintSelected.date_resolution && <div style={{fontSize:11,color:'var(--text-dim)',marginTop:6}}>Résolu le {new Date(maintSelected.date_resolution).toLocaleString('fr-FR')}</div>}
                    </div>
                  )}

                  {maintSelected.commentaire_cloture && (
                    <div style={{ background:'rgba(91,100,114,.06)', border:'1px solid rgba(91,100,114,.2)', borderRadius:10, padding:12, marginBottom:12 }}>
                      <div style={{ fontSize:11, fontWeight:700, color:'#5B6472', marginBottom:4 }}>🔒 COMMENTAIRE DE CLÔTURE</div>
                      <div style={{ fontSize:13 }}>{maintSelected.commentaire_cloture}</div>
                      {maintSelected.date_cloture && <div style={{fontSize:11,color:'var(--text-dim)',marginTop:6}}>Clôturé le {new Date(maintSelected.date_cloture).toLocaleString('fr-FR')}</div>}
                    </div>
                  )}

                  {!maintSelLoading && !maintSelected.commentaire_resolution && !maintSelected.commentaire_cloture && (
                    <div style={{fontSize:12,color:'var(--text-dim)',fontStyle:'italic',marginBottom:12}}>Aucun rapport d'intervention renseigné pour ce dossier.</div>
                  )}

                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, fontSize:12 }}>
                    <div><span style={{color:'var(--text-dim)'}}>Priorité :</span> <b>{maintSelected.priorite || '—'}</b></div>
                    <div><span style={{color:'var(--text-dim)'}}>Créé le :</span> <b>{maintSelected.date_creation ? new Date(maintSelected.date_creation).toLocaleDateString('fr-FR') : '—'}</b></div>
                    <div><span style={{color:'var(--text-dim)'}}>Déclaré par :</span> <b>{maintSelected.auteur_nom || '—'}</b></div>
                    <div><span style={{color:'var(--text-dim)'}}>Assigné à :</span> <b>{maintSelected.assigne_nom || '—'}</b></div>
                  </div>

                  {maintSelected.commentaires?.length > 0 && (
                    <div style={{ marginTop:16 }}>
                      <div style={{ fontSize:11, fontWeight:700, color:'#64748b', marginBottom:8 }}>💬 HISTORIQUE DES COMMENTAIRES</div>
                      {maintSelected.commentaires.map((c,i)=>(
                        <div key={i} style={{ background:'#f8fafc', borderRadius:8, padding:10, marginBottom:6, fontSize:12 }}>
                          <div style={{ fontWeight:600, marginBottom:2 }}>{c.auteur_nom || c.auteur || '—'}</div>
                          <div>{c.contenu || c.texte || c.commentaire}</div>
                          {c.photo_base64 && (
                            <img src={`data:image/jpeg;base64,${c.photo_base64}`}
                              style={{ width:'100%', maxWidth:200, borderRadius:6, border:'1px solid #e2e8f0', display:'block', marginTop:6 }}
                              alt="Photo jointe au commentaire" />
                          )}
                          {(c.date_creation || c.date) && <div style={{fontSize:10,color:'var(--text-dim)',marginTop:4}}>{new Date(c.date_creation || c.date).toLocaleString('fr-FR')}</div>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {tab==='induction' && (
        <div>
          <SearchCard title="🎓 Historique des inductions QHSE" color="#0F2A5C">
            <div style={{display:'flex',gap:8,marginBottom:8,flexWrap:'wrap',alignItems:'center'}}>
              <select value={inductionStatFilter} onChange={e=>setInductionStatFilter(e.target.value)}
                style={{background:'var(--surface2)',border:'1px solid var(--border)',color:'var(--text)',padding:'8px 10px',borderRadius:8,fontSize:13}}>
                <option value="">Tous statuts</option>
                <option value="en_cours">En cours</option>
                <option value="valide">Validé — Induit</option>
                <option value="refuse">Refusé</option>
                <option value="expire">Expiré</option>
              </select>

              <input type="text" value={inductionSearch||''} onChange={e=>setInductionSearch(e.target.value)}
                placeholder="🔍 Nom, société..."
                style={{background:'var(--surface2)',border:'1px solid var(--border)',color:'var(--text)',padding:'8px 12px',borderRadius:8,fontSize:13,minWidth:160}} />

              <button onClick={loadInduction} disabled={inductionLoading}
                style={{background:'#0F2A5C',color:'#fff',border:'none',padding:'8px 16px',borderRadius:8,cursor:'pointer',fontSize:13,fontWeight:700}}>
                {inductionLoading?'⏳ Recherche...':'🔍 Actualiser'}
              </button>

              {inductionFiltered.length > 0 && (
                <button onClick={exportInductionCSV}
                  style={{background:'rgba(22,163,74,.1)',color:'#16a34a',border:'1px solid rgba(22,163,74,.3)',padding:'8px 14px',borderRadius:8,cursor:'pointer',fontSize:13,fontWeight:700}}>
                  ⬇ Export CSV ({inductionFiltered.length})
                </button>
              )}
            </div>
          </SearchCard>

          {inductionFiltered.length > 0 ? (
            <div style={{background:'#fff',border:'1px solid var(--border)',borderRadius:12,overflow:'hidden',boxShadow:'var(--shadow)'}}>
              <div style={{padding:'10px 16px',background:'#0F2A5C',color:'#fff',fontWeight:600,fontSize:13}}>
                🎓 {inductionFiltered.length}/{inductionData.length} induction(s)
              </div>
              <div style={{overflowX:'auto',maxHeight:500,overflowY:'auto'}}>
                <table style={{width:'100%',borderCollapse:'collapse',fontSize:12.5}}>
                  <thead><tr style={{background:'var(--surface2)'}}>
                    {['Nom','Société','Statut','Progression','Score quiz','Débuté le','Terminé le','Badge'].map(h=>(
                      <th key={h} style={{padding:'9px 12px',textAlign:'left',fontSize:10,fontFamily:'monospace',color:'var(--text-dim)',letterSpacing:1,textTransform:'uppercase'}}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {inductionFiltered.map((r,idx)=>{
                      const p = r.personnel_detail || {}
                      const statutStyle = {
                        en_cours: {bg:'rgba(217,119,6,.12)',color:'#d97706',label:'En cours'},
                        valide:   {bg:'rgba(22,163,74,.12)',color:'#16a34a',label:'Validé — Induit'},
                        refuse:   {bg:'rgba(220,38,38,.12)',color:'#dc2626',label:'Refusé'},
                        expire:   {bg:'rgba(100,116,139,.12)',color:'#64748b',label:'Expiré'},
                      }[r.statut] || {bg:'rgba(100,116,139,.12)',color:'#64748b',label:r.statut}
                      return (
                        <tr key={r.id||idx} style={{borderTop:'1px solid var(--border)',background:idx%2?'var(--surface2)':'#fff'}}>
                          <td style={{padding:'9px 12px',fontWeight:600,color:'var(--blue)'}}>{p.nom} {p.prenom}</td>
                          <td style={{padding:'9px 12px',fontSize:12,color:'var(--text-dim)'}}>{p.societe||'—'}</td>
                          <td style={{padding:'9px 12px'}}><span style={{background:statutStyle.bg,color:statutStyle.color,padding:'3px 10px',borderRadius:20,fontSize:11,fontWeight:700}}>{statutStyle.label}</span></td>
                          <td style={{padding:'9px 12px',fontFamily:'monospace',fontSize:12}}>{r.progression ?? 0}%</td>
                          <td style={{padding:'9px 12px',fontFamily:'monospace',fontSize:12}}>{r.quiz_score != null ? `${r.quiz_score}%` : '—'}</td>
                          <td style={{padding:'9px 12px',fontFamily:'monospace',fontSize:11}}>{r.date_debut ? new Date(r.date_debut).toLocaleDateString('fr-FR') : '—'}</td>
                          <td style={{padding:'9px 12px',fontFamily:'monospace',fontSize:11}}>{r.date_fin ? new Date(r.date_fin).toLocaleDateString('fr-FR') : '—'}</td>
                          <td style={{padding:'9px 12px',fontSize:12}}>{r.badge_emis ? '✅' : '—'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <EmptyState icon="🎓" text={inductionLoading ? "Chargement..." : "Aucune induction enregistrée."}/>
          )}
        </div>
      )}
    </div>
  )
}

function EmptyState({ icon, text }) {
  return (
    <div style={{background:'#fff',border:'1px solid var(--border)',borderRadius:12,padding:40,textAlign:'center',color:'var(--text-dim)',boxShadow:'var(--shadow)'}}>
      <div style={{fontSize:36,marginBottom:10}}>{icon}</div>
      <div style={{fontSize:13}}>{text}</div>
    </div>
  )
}

function ResultsTable({ results, loading, searched, type }) {
  if (loading) return <div style={{padding:40,textAlign:'center',color:'var(--text-dim)'}}>🔍 Recherche en cours...</div>
  if (!searched) return (
    <div style={{background:'#fff',border:'1px solid var(--border)',borderRadius:12,padding:40,textAlign:'center',color:'var(--text-dim)',boxShadow:'var(--shadow)'}}>
      <div style={{fontSize:36,marginBottom:10}}>🔍</div>
      <div style={{fontWeight:600,fontSize:14,marginBottom:4}}>Lancez une recherche</div>
      <div style={{fontSize:12}}>Sans filtre → affiche toutes les occupations · Avec filtres → résultats précis</div>
    </div>
  )
  if (results.length===0) return (
    <div style={{background:'#fff',border:'1px solid var(--border)',borderRadius:12,padding:40,textAlign:'center',color:'var(--text-dim)',boxShadow:'var(--shadow)'}}>
      <div style={{fontSize:36,marginBottom:10}}>📭</div>
      <div style={{fontSize:14}}>Aucun résultat pour ces critères</div>
    </div>
  )

  const totalJ = results.reduce((s,r)=>s+(r.duree_jours||0),0)
  const enCours = results.filter(r=>r.en_cours).length

  return (
    <div>
      <div style={{display:'flex',gap:10,marginBottom:12,flexWrap:'wrap'}}>
        <div style={{background:'var(--blue)',color:'#fff',borderRadius:8,padding:'6px 14px',fontSize:13,fontWeight:700}}>{results.length} résultat{results.length>1?'s':''}</div>
        <div style={{background:'#fff',border:'1px solid var(--border)',borderRadius:8,padding:'6px 14px',fontSize:13}}>Durée totale : <b style={{color:'var(--blue)'}}>{totalJ} jours</b></div>
        {enCours>0 && <div style={{background:'rgba(22,163,74,.1)',border:'1px solid rgba(22,163,74,.3)',borderRadius:8,padding:'6px 14px',fontSize:13,color:'#16a34a',fontWeight:700}}>{enCours} en cours</div>}
      </div>
      <div style={{background:'#fff',border:'1px solid var(--border)',borderRadius:12,overflow:'hidden',boxShadow:'var(--shadow)'}}>
        <div style={{overflowX:'auto'}}>
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:12.5,minWidth:600}}>
            <thead><tr style={{background:'var(--blue)'}}>
              {(type==='chambre'
                ?['Résidence','Bloc','Occupant','Société','Arrivée','Départ','Durée','Statut']
                :['Résidence','Bloc','Arrivée','Départ','Durée','Motif','Statut']
              ).map(h=>(
                <th key={h} style={{padding:'9px 12px',textAlign:'left',fontSize:10,fontFamily:'monospace',color:'rgba(255,255,255,.85)',letterSpacing:1,textTransform:'uppercase',fontWeight:500}}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {results.map((r,i)=>(
                <tr key={String(r.id)} style={{borderTop:'1px solid var(--border)',background:i%2?'var(--surface2)':'#fff'}}>
                  <td style={{padding:'9px 12px',fontFamily:'monospace',fontWeight:700,color:'var(--blue)'}}>{r.residence}</td>
                  <td style={{padding:'9px 12px',fontSize:11,color:'var(--text-dim)'}}>{r.bloc}</td>
                  {type==='chambre'&&<>
                    <td style={{padding:'9px 12px',fontWeight:600}}>{r.occupant}</td>
                    <td style={{padding:'9px 12px',fontSize:11}}>{r.societe||'—'}</td>
                  </>}
                  <td style={{padding:'9px 12px',fontFamily:'monospace',fontSize:11}}>{r.date_arrivee}</td>
                  <td style={{padding:'9px 12px',fontFamily:'monospace',fontSize:11,color:!r.date_depart?'#16a34a':'inherit',fontWeight:!r.date_depart?700:'normal'}}>{r.date_depart||'En cours'}</td>
                  <td style={{padding:'9px 12px'}}><Chip jours={r.duree_jours||0}/></td>
                  {type==='personne'&&<td style={{padding:'9px 12px',fontSize:11,color:'var(--text-dim)'}}>{r.motif_depart||'—'}</td>}
                  <td style={{padding:'9px 12px'}}>
                    <span style={{background:r.en_cours?'rgba(22,163,74,.12)':'var(--surface2)',color:r.en_cours?'#16a34a':'var(--text-dim)',padding:'3px 8px',borderRadius:20,fontSize:11,fontWeight:700}}>
                      {r.en_cours?'✅ En cours':'Terminé'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function VoyageTable({ voyages, showPersonnel }) {
  if (!voyages||voyages.length===0) return <EmptyState icon="✈️" text="Aucun voyage enregistré"/>
  return (
    <div style={{background:'#fff',border:'1px solid var(--border)',borderRadius:12,overflow:'hidden',boxShadow:'var(--shadow)'}}>
      <div style={{overflowX:'auto'}}>
        <table style={{width:'100%',borderCollapse:'collapse',fontSize:12.5,minWidth:600}}>
          <thead><tr style={{background:'var(--blue)'}}>
            {(showPersonnel
              ?['Personnel','Société','Chambre','Destination','Départ','Retour prévu','Retour réel','Statut']
              :['#','Chambre','Destination','Départ','Retour prévu','Retour réel','Statut']
            ).map(h=>(
              <th key={h} style={{padding:'9px 12px',textAlign:'left',fontSize:10,fontFamily:'monospace',color:'rgba(255,255,255,.85)',letterSpacing:1,textTransform:'uppercase',fontWeight:500}}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {voyages.map((v,i)=>{
              const sc = Object.values(STATUT_V).find(x=>x.label===v.statut_label)||STATUT_V.retour
              return (
                <tr key={v.id||i} style={{borderTop:'1px solid var(--border)',background:i%2?'var(--surface2)':'#fff'}}>
                  {showPersonnel
                    ?<><td style={{padding:'9px 12px',fontWeight:600}}>{v.personnel}</td><td style={{padding:'9px 12px',fontSize:11,color:'var(--text-dim)'}}>{v.societe}</td></>
                    :<td style={{padding:'9px 12px',fontFamily:'monospace',fontWeight:700,color:'var(--blue)'}}>#{i+1}</td>
                  }
                  <td style={{padding:'9px 12px',fontFamily:'monospace',color:'var(--blue)',fontWeight:700}}>{v.chambre||'—'}</td>
                  <td style={{padding:'9px 12px',fontWeight:600}}>{v.destination||<span style={{color:'var(--text-dim)'}}>—</span>}</td>
                  <td style={{padding:'9px 12px',fontFamily:'monospace',fontSize:11}}>{v.date_depart}</td>
                  <td style={{padding:'9px 12px',fontFamily:'monospace',fontSize:11}}>{v.date_retour_prevue}</td>
                  <td style={{padding:'9px 12px',fontFamily:'monospace',fontSize:11,color:!v.date_retour_effective?'#ea580c':'inherit'}}>{v.date_retour_effective||'En cours'}</td>
                  <td style={{padding:'9px 12px'}}><span style={{background:sc.bg,color:sc.color,padding:'3px 10px',borderRadius:20,fontSize:11,fontWeight:700}}>{v.statut_label||v.statut}</span></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
