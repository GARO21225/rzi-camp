/**
 * Personnel — Gestion des membres, QR codes, sous-traitants
 * Version stable - Erreurs gérées par Error Boundary
 */
import React, { useState, useCallback, useEffect, useMemo } from 'react'
import { personnel as personnelAPI, rolesAPI, residentsPrincipaux as rpAPI, batiments as batimentsAPI, parametres as paramAPI, auth as authAPI, departementsAPI, entreprisesAPI } from '../api'
import SelectRecherche from '../components/SelectRecherche'
import { useIsMobile } from '../hooks/useIsMobile'
import { useReadOnly } from '../hooks/useReadOnly'
import { toast, confirmDialog } from '../toast'
import { useStore } from '../store'

// ── Error Boundary ───────────────────────────────────────
class PersonnelBoundary extends React.Component {
  constructor(p) { super(p); this.state = {err: null} }
  static getDerivedStateFromError(e) { return {err: e.message || 'Erreur'} }
  componentDidCatch(e) { console.error('Personnel crash:', e) }
  render() {
    if (this.state.err) return (
      <div style={{padding:40,textAlign:'center'}}>
        <div style={{fontSize:48,marginBottom:12}}>⚠️</div>
        <div style={{fontWeight:700,color:'#dc2626',fontSize:16,marginBottom:8}}>Erreur d\'affichage</div>
        <div style={{color:'#64748b',fontSize:12,marginBottom:16,maxWidth:400,margin:'0 auto 16px'}}>
          {this.state.err}
        </div>
        <button onClick={()=>this.setState({err:null})}
          style={{background:'var(--rzc-ore-gold)',color:'#1A1206',border:'none',padding:'10px 24px',
            borderRadius:10,cursor:'pointer',fontSize:14,fontWeight:700}}>
          🔄 Réessayer
        </button>
      </div>
    )
    return this.props.children
  }
}

// ── Composant principal ──────────────────────────────────
export default function Personnel() {
  const isMobile = useIsMobile()
  const lectureSeule = useReadOnly()
  const setUser = useStore(s => s.setUser)
  const [data,         setData]         = useState([])
  const [loading,      setLoading]      = useState(true)
  const [search,       setSearch]       = useState('')
  const [typeFilter,   setTypeFilter]   = useState('')
  const [profilFilter, setProfilFilter] = useState('')
  const [societeFilter,setSocieteFilter]= useState('')
  const [actifFilter,  setActifFilter]  = useState('')
  const [inductionFilter,setInductionFilter]= useState('')
  const [expatrieFilter,setExpatrieFilter]  = useState('')
  const [mobiliteFilter,setMobiliteFilter]  = useState('')
  const [modal,        setModal]        = useState(null)   // null | 'new' | personnel object
  const [qrModal,      setQrModal]      = useState(null)
  const [masseModal,   setMasseModal]   = useState(false)
  const [masseForm,    setMasseForm]    = useState({societe:'', nombre:5, duree_h:72})
  const [masseResult,  setMasseResult]  = useState(null)
  const [masseLoading, setMasseLoading] = useState(false)
  const [form,         setForm]         = useState({
    nom:'', prenom:'', email:'', telephone:'', numero_whatsapp:'',
    societe:'ROXGOLD', type_personnel:'roxgold', numero:'', actif:true,
    est_expatrie:false, pays_origine:'', eligible_mobilite:false, mobilite:true
  })
  const [deps, setDeps] = useState([])
  const [ents, setEnts] = useState([])
  useEffect(() => {
    departementsAPI.list().then(r => setDeps((r.data?.results || r.data || []).filter(d => d.actif))).catch(() => {})
    entreprisesAPI.list().then(r => setEnts((r.data?.results || r.data || []).filter(e => e.actif))).catch(() => {})
  }, [])
  const [saving,       setSaving]       = useState(false)
  const [selected_ids, setSelectedIds]  = useState(new Set())  // IDs sélectionnés pour masse
  const [massAction,   setMassAction]   = useState('')  // action en cours
  const [err,          setErr]          = useState('')
  const [confirmDel,   setConfirmDel]   = useState(null)   // Personnel à supprimer
  const [roleModal,    setRoleModal]    = useState(null)   // Personnel dont on change le rôle
  const [profilsDynamiques, setProfilsDynamiques] = useState(null) // charges depuis RoleCustom, remplace la liste figee
  const [canalOtp, setCanalOtp] = useState('sms') // canal_otp (Parametrage) - determine quel champ (telephone/whatsapp/email) est obligatoire ci-dessous
  const [credentialsModal, setCredentialsModal] = useState(null) // Identifiants generes a afficher UNE fois
  const [newRole,      setNewRole]      = useState('')
  const [newProfil,    setNewProfil]    = useState('')
  const [newLoginRole, setNewLoginRole] = useState('')
  const [rpModal, setRpModal] = useState(null)       // personnel en cours de declaration resident principal
  const [rpBatiments, setRpBatiments] = useState([])
  const [rpBatimentChoisi, setRpBatimentChoisi] = useState('')

  const load = useCallback(() => {
    setLoading(true)
    personnelAPI.list({ page_size:500 })
      .then(r => setData(r.data.results || r.data || []))
      .catch(() => setData([]))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    // Les roles configures dans Parametrage -> Roles & Acces DOIVENT
    // apparaitre ici automatiquement - avant ce correctif, cette liste
    // etait figee dans le code et un nouveau role cree par l'admin
    // n'etait jamais selectionnable pour un membre du personnel.
    rolesAPI.list().then(r => {
      const liste = r.data?.results || r.data || []
      if (liste.length) setProfilsDynamiques(liste.map(role => ({ v: role.code, l: role.label })))
    }).catch(() => {})
    paramAPI.list().then(r => {
      const liste = r.data?.results || r.data || []
      const p = liste.find(x => x.cle === 'canal_otp')
      if (p?.valeur) setCanalOtp(p.valeur)
    }).catch(() => {})
  }, [])

  // Filtrage — mémoïsé : recalculé seulement quand data ou les filtres changent,
  // pas à chaque re-render du composant (ex: ouverture d'un modal, saisie dans
  // un autre champ du formulaire). Sur 500 personnes × 7 champs comparés, ce
  // calcul n'est pas gratuit à répéter inutilement.
  const filtered = useMemo(() => data.filter(p => {
    const q = search.toLowerCase()
    const matchSearch = !q || [p.nom,p.prenom,p.email,p.societe,p.numero,p.telephone,p.numero_whatsapp,p.profil,p.matricule]
      .some(v => (v||'').toLowerCase().includes(q))
    const matchType    = !typeFilter    || p.type_personnel === typeFilter
    const matchSociete = !societeFilter || (p.societe||'').toLowerCase().includes(societeFilter.toLowerCase())
    const matchProfil  = !profilFilter  || p.profil === profilFilter
    const matchActif   = !actifFilter   || (actifFilter==='actif' ? p.actif : !p.actif)
    const matchExpatrie = !expatrieFilter || (expatrieFilter==='oui' ? p.est_expatrie : !p.est_expatrie)
    const matchMobilite = !mobiliteFilter || (mobiliteFilter==='oui' ? p.a_droit_mobilite : !p.a_droit_mobilite)
    return matchSearch && matchType && matchSociete && matchProfil && matchActif && matchExpatrie && matchMobilite
  }), [data, search, typeFilter, societeFilter, profilFilter, actifFilter, expatrieFilter, mobiliteFilter])

  // Sauvegarde
  const handleSave = async () => {
    if (!form.nom || !form.prenom) { setErr('Nom et prénom requis'); return }
    // Meme regle que le backend (residences/serializers.py::PersonnelSerializer.validate())
    // - verifiee ici aussi pour eviter un aller-retour serveur inutile,
    // mais le backend reste la source de verite (import CSV notamment).
    if (!(modal && modal.id)) {
      // Téléphone + WhatsApp désormais TOUJOURS obligatoires (quel que soit
      // le canal configuré) ; email obligatoire seulement si canal='email'.
      if (!form.telephone) { setErr("Téléphone requis"); return }
      if (!form.numero_whatsapp) { setErr("Numéro WhatsApp requis"); return }
      if (canalOtp === 'email' && !form.email) { setErr("Email requis — canal de connexion configuré : email"); return }
    }
    if (form.type_personnel !== 'sous_traitant' && !(form.departement||'').trim() && deps.length) {
      setErr(form.type_personnel === 'visiteur' ? "Département requis — le visiteur est rattaché à un département" : "Département requis — tout employé Roxgold appartient à un département"); return
    }
    if (form.type_personnel === 'sous_traitant' && !(form.societe||'').trim()) { setErr("Entreprise sous-traitante requise"); return }
    setSaving(true); setErr('')
    try {
      if (modal && modal.id) {
        await personnelAPI.update(modal.id, form)
      } else {
        const r = await personnelAPI.create(form)
        // Le mot de passe n'est JAMAIS revele nulle part ailleurs (retire
        // de la liste/detail standard pour ne pas l'exposer en clair a
        // chaque lecture) - c'est la SEULE occasion de le voir et de le
        // transmettre au nouvel employe.
        if (r.data?.login_genere && r.data?.password_genere) {
          setCredentialsModal({ nom: form.nom, prenom: form.prenom, login: r.data.login_genere, password: r.data.password_genere, envois: r.data.identifiants_envoyes })
        }
      }
      setModal(null)
      setForm({nom:'',prenom:'',email:'',telephone:'',numero_whatsapp:'',departement:'',societe:'ROXGOLD',type_personnel:'roxgold',numero:'',actif:true,est_expatrie:false,pays_origine:'',eligible_mobilite:false,mobilite:true})
      load()
    } catch(e) {
      setErr(e.response?.data?.detail || JSON.stringify(e.response?.data) || 'Erreur')
    } finally { setSaving(false) }
  }

  // Sélection en masse
  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
  const toggleAll = () => {
    if (selected_ids.size === filtered.length) setSelectedIds(new Set())
    else setSelectedIds(new Set(filtered.map(p=>p.id)))
  }

  const massSupprimerSelected = async () => {
    if (!await confirmDialog(`Supprimer ${selected_ids.size} membre(s) ?`)) return
    for (const id of selected_ids) {
      try { await personnelAPI.delete(id) } catch(e) {}
    }
    setSelectedIds(new Set()); load()
  }

  const massChangerRole = async (action) => {
    const BASE = import.meta?.env?.VITE_API_URL || window.location.origin
    const token = localStorage.getItem('access_token') || ''
    const hdrs = {'Content-Type':'application/json','Authorization':`Bearer ${token}`}
    
    if (action === 'export') {
      const sel = filtered.filter(p=>selected_ids.has(p.id))
      const asText = (v) => v ? `="${String(v).replace(/"/g,'""')}"` : ''
      const rows = [['NOM','PRENOM','TYPE','SOCIETE','DEPARTEMENT','WHATSAPP','EMAIL','TEL','PROFIL','EXPATRIE','DROIT_MOBILITE'],
        ...sel.map(p=>[p.nom,p.prenom,p.type_personnel,p.societe,p.departement,asText(p.numero_whatsapp),p.email,asText(p.numero),p.profil,p.est_expatrie?'Oui':'Non',p.eligible_mobilite?'Oui':'Non'])]
      const csv = rows.map(r=>r.map(v=>typeof v==='string'&&v.startsWith('="')?v:`"${v||''}"`).join(',')).join('\n')
      const a = document.createElement('a')
      a.href = 'data:text/csv;charset=utf-8,\uFEFF' + encodeURIComponent(csv)
      a.download = 'personnel_selection.csv'
      a.click()
      return
    }
    
    for (const id of selected_ids) {
      try {
        let body = {}
        if (action.startsWith('type:'))    body = { type_personnel: action.slice(5) }
        else if (action.startsWith('profil:')) body = { profil: action.slice(7) }
        else if (action === 'activer')    body = { actif: true }
        else if (action === 'desactiver') body = { actif: false }
        else if (action === 'no_induction')   body = { induction_requise: false }
        else if (action === 'with_induction') body = { induction_requise: true }
        else if (action === 'expatrie')       body = { est_expatrie: true }
        else if (action === 'non_expatrie')   body = { est_expatrie: false }
        else if (action === 'mobilite_oui')   body = { mobilite: true }
        else if (action === 'mobilite_non')   body = { mobilite: false }
        else body = { type_personnel: action }
        await fetch(`${BASE}/api/personnel/${id}/`, {method:'PATCH',headers:hdrs,body:JSON.stringify(body)})
      } catch(e) {}
    }
    setSelectedIds(new Set()); load(); setMassAction('')
  }

  const handleDelete = async (p) => {
    try {
      await personnelAPI.delete(p.id)
      setConfirmDel(null)
      load()
    } catch(e) { toast.error(e.response?.data?.error || e.response?.data?.detail || 'Erreur suppression') }
  }

  const handleToggleActif = async (p) => {
    try {
      await personnelAPI.update(p.id, { actif: !p.actif })
      load()
    } catch(e) { toast.error('Erreur') }
  }

  const handleChangeRole = async () => {
    if (!roleModal) return
    try {
      const payload = {}
      if (newRole)   payload.type_personnel = newRole
      if (newProfil) payload.profil         = newProfil
      if (Object.keys(payload).length > 0) {
        await personnelAPI.update(roleModal.id, payload)
      }
      if (newLoginRole) {
        await personnelAPI.assigRole(roleModal.id, newLoginRole)
        // BUG REEL CORRIGE ICI : changer le rôle (ex: admin -> agent) mettait
        // bien à jour la base, mais la bannière/le contenu affichés restaient
        // sur l'ancien rôle tant que la page n'était pas rechargée - le store
        // Zustand (user/role, qui pilote isAdmin()/le menu) n'était jamais
        // réactualisé après ce changement, seule la liste du personnel l'était
        // (load()). On ne sait pas ici si la personne modifiée est l'utilisateur
        // connecté lui-même (l'id du compte User lié n'est pas exposé par ce
        // serializer) - un simple re-fetch de /api/auth/me/ est sans risque
        // dans tous les cas (no-op si ce n'est pas soi-même) et résout le cas
        // exact signalé (un admin qui se rétrograde lui-même en agent).
        try { const me = await authAPI.me(); setUser(me.data) } catch {}
      }
      if (Object.keys(payload).length === 0 && !newLoginRole) { setRoleModal(null); return }
      setRoleModal(null); setNewProfil(''); setNewLoginRole(''); load()
    } catch(e) {
      const msg = e.response?.data ? JSON.stringify(e.response.data) : 'Erreur réseau'
      toast.error('Erreur: ' + msg)
    }
  }

  // Styles
  const inp = {
    width:'100%', border:'1px solid var(--rzc-border-light)', borderRadius:9,
    padding:'10px 12px', fontSize:13, outline:'none', fontFamily:'inherit',
    boxSizing:'border-box', background:'var(--rzc-charcoal-l2)', color:'var(--rzc-text)'
  }
  const btn = (bg, color='#fff') => ({
    background:bg, color, border:'none', padding:'9px 16px', borderRadius:9,
    cursor:'pointer', fontSize:12, fontWeight:700, fontFamily:'inherit'
  })

  const TYPES = [
    {v:'roxgold',      l:'Employé Roxgold'},
    {v:'sous_traitant', l:'Employé non Roxgold (sous-traitant)'},
    {v:'visiteur',     l:'Visiteur'},
  ]

  const PROFILS = profilsDynamiques || [
  { v:'admin',      l:'Administrateur' },
  { v:'agent',      l:'Agent' },
  { v:'accueil',    l:"Agent d'accueil" },
  { v:'technicien', l:'Technicien' },
  { v:'hse',        l:'HSE / QHSE' },
  { v:'restaurant', l:'Restauration' },
  { v:'boutique',   l:'Bar & Boutique' },
  { v:'securite',   l:'Sécurité' },
  { v:'medical',    l:'Médical' },
  { v:'manager',    l:'Manager / Responsable' },
]

  const exportPersonnelCSV = (list) => {
    // Excel convertit automatiquement une cellule "0701234567" en nombre 701234567,
    // ce qui efface le 0 initial. La formule ="..." force Excel à garder le texte tel quel.
    const asText = (v) => v ? `="${String(v).replace(/"/g,'""')}"` : ''
    const headers = ['Matricule','Nom','Prénom','Société','Département','Poste','Téléphone','WhatsApp','Email','Résidence','Chambre','Statut','Date création']
    const rows = list.map(p => [
      asText(p.matricule), p.nom||'', p.prenom||'', p.societe||p.entreprise||'', p.departement||'',
      p.poste||p.fonction||'', asText(p.telephone), asText(p.numero_whatsapp), p.email||'',
      p.batiment?.nom||p.residence||'', p.chambre||'', p.statut||'actif',
      p.date_creation?new Date(p.date_creation).toLocaleDateString('fr-FR'):''
    ])
    const csv = [headers.join(';'), ...rows.map(r=>r.join(';'))].join('\n')
    const blob = new Blob(['\uFEFF'+csv], {type:'text/csv;charset=utf-8;'})
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'personnel_'+new Date().toISOString().slice(0,10)+'.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  const downloadPersonnelTemplate = () => {
    // BUG REEL CORRIGE ICI : la colonne "email" manquait du template
    // telechargeable - or le backend (valider_contact_selon_canal) exige
    // l'email quand le canal de connexion configure (Parametrage) est
    // "email", et l'import_csv_data la lit deja si presente (colonne
    // "email"/"e-mail"/"mail" cote parsing frontend). Sans cette colonne
    // dans le template fourni, quiconque le remplit avec canal_otp=email
    // configure voyait TOUTES ses lignes rejetees silencieusement
    // ("l'importation ne passe pas").
    const csv = 'nom;prenom;telephone;numero_whatsapp;email;matricule;societe;departement;type_personnel\n' +
      'KOUAME;Jean;0701234567;0701234567;jean.kouame@exemple.com;MAT001;Roxgold;Maintenance;employe\n' +
      'TRAORE;Marie;0501234567;0501234567;marie.traore@exemple.com;MAT002;SODECI;RH;sous_traitant\n' +
      'DIALLO;Ibrahim;0102030405;0102030405;ibrahim.diallo@exemple.com;MAT003;Roxgold;Logistique;employe'
    const blob = new Blob(['\uFEFF'+csv], {type:'text/csv;charset=utf-8;'})
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href=url; a.download='template_personnel.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  const importPersonnelCSV = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.csv,.txt'
    // Sur certains navigateurs (notamment mobile/tablette), un <input type=file>
    // détaché du DOM ne déclenche pas toujours la sélection de fichier au .click().
    input.style.display = 'none'
    document.body.appendChild(input)

    input.onchange = async (e) => {
      const file = e.target.files?.[0]
      input.remove()
      if (!file) return

      try {
        const text = (await file.text()).replace(/^\uFEFF/, '')
        const lines = text
          .split(/\r?\n/)
          .filter(l => l.trim())

        if (lines.length < 2) {
          toast.success('CSV vide')
          return
        }

        // Détection du séparateur
        const sep = lines[0].includes(';') ? ';' : ','

        // Parse CSV simple avec gestion des champs entre guillemets
        const parseLine = (line) => {
          const result = []
          let current = ''
          let quoted = false

          for (let i = 0; i < line.length; i++) {
            const c = line[i]

            if (c === '"') {
              if (quoted && line[i + 1] === '"') {
                current += '"'
                i++
              } else {
                quoted = !quoted
              }
            } else if (c === sep && !quoted) {
              result.push(current.trim())
              current = ''
            } else {
              current += c
            }
          }

          result.push(current.trim())
          return result
        }

        const cleanHeader = (h) =>
          String(h || '')
            .replace(/^["']|["']$/g, '')
            .trim()
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')

        const headers = parseLine(lines[0]).map(cleanHeader)

        const get = (row, names) => {
          for (const name of names) {
            const wanted = cleanHeader(name)
            const i = headers.indexOf(wanted)

            if (i >= 0 && row[i] != null) {
              const value = String(row[i])
                .replace(/^["']|["']$/g, '')
                .trim()

              if (value !== '') return value
            }
          }

          return ''
        }

        // IMPORTANT :
        // Tous les téléphones restent des chaînes.
        // Si Excel a supprimé le 0 ivoirien, on le restaure.
        const normalizePhone = (value) => {
          if (!value) return ''

          let v = String(value).trim().replace(/[\s().-]+/g, '')

          // +225XXXXXXXXXX -> 0XXXXXXXXX
          if (/^\+225\d{9,10}$/.test(v)) {
            v = v.slice(4)
          }
          // 225XXXXXXXXXX -> 0XXXXXXXXX
          else if (/^225\d{9,10}$/.test(v)) {
            v = v.slice(3)
          }

          // Excel supprime le 0 initial quel que soit le chiffre suivant
          // (ex: 0701234567 -> 701234567, 0102030405 -> 102030405).
          // Un numéro ivoirien complet fait 9 chiffres une fois le 0 retiré.
          if (/^\d{9}$/.test(v) && !v.startsWith('0')) {
            v = '0' + v
          }

          return v
        }

        const rows = []

        for (let i = 1; i < lines.length; i++) {
          const row = parseLine(lines[i])

          const nom = get(row, ['nom', 'name'])
          const prenom = get(row, ['prenom', 'prénom', 'firstname'])

          if (!nom) continue

          /*
           * SOCIÉTÉ
           *
           * Si le CSV contient "roxgold" dans la colonne type,
           * on considère Roxgold comme la société.
           */
          let societe = get(row, [
            'societe',
            'société',
            'entreprise',
            'company'
          ])

          const typeRaw = get(row, [
            'type_personnel',
            'type',
            'categorie',
            'category'
          ]).toLowerCase().trim()

          if (!societe && typeRaw === 'roxgold') {
            societe = 'Roxgold'
          }

          /*
           * TYPE DE PERSONNEL
           *
           * Roxgold = société, PAS type.
           * Le type par défaut est toujours employé.
           */
          let type_personnel = 'employe'

          if (typeRaw === 'sous_traitant' || typeRaw === 'sous-traitant') {
            type_personnel = 'sous_traitant'
          } else if (typeRaw === 'visiteur') {
            type_personnel = 'visiteur'
          } else if (
            typeRaw === 'employe' ||
            typeRaw === 'employé' ||
            typeRaw === 'employee' ||
            typeRaw === 'agent'
          ) {
            type_personnel = 'employe'
          } else if (typeRaw === 'roxgold') {
            type_personnel = 'employe'
          }

          /*
           * TÉLÉPHONE
           */
          const telephone = normalizePhone(get(row, [
            'telephone',
            'téléphone',
            'tel',
            'phone',
            'numero_telephone',
            'numero telephone',
            'mobile'
          ]))

          /*
           * WHATSAPP
           * Si absent, on reprend automatiquement le téléphone.
           */
          const whatsapp = normalizePhone(get(row, [
            'numero_whatsapp',
            'whatsapp',
            'telephone_whatsapp',
            'tel_whatsapp'
          ])) || telephone

          /*
           * MATRICULE
           *
           * TRÈS IMPORTANT :
           * on ne prend QUE la colonne matricule.
           * Jamais telephone, mobile ou numero.
           */
          const matricule = get(row, [
            'matricule',
            'matricule_personnel',
            'id_personnel'
          ])
          const departement = get(row, ['departement', 'département', 'cie/departement', 'cie / departements', 'service'])

          rows.push({
            nom,
            prenom,
            email: get(row, ['email', 'e-mail', 'mail']) || '',

            telephone,
            numero_whatsapp: whatsapp,

            societe: societe || '',
            departement: departement || '',

            // Le matricule est indépendant du téléphone.
            matricule,
            numero: matricule,

            type_personnel,
            actif: true
          })
        }

        console.log('IMPORT PERSONNEL — payload:', rows)

        // BUG REEL CORRIGE ICI : cet appel utilisait un fetch() maison,
        // avec credentials:'include' et sa PROPRE reconstruction de BASE -
        // different de tout le reste de l'app, qui passe par l'instance
        // axios partagee (api/index.js), configuree explicitement
        // withCredentials:false ("évite les preflight complexes"). Ce
        // fetch etait le SEUL appel de toute l'app a envoyer des
        // cookies (credentials:'include') sur une requete CORS -
        // incoherent avec la configuration voulue, et source plausible
        // d'un echec CORS silencieux specifique a cette seule fonctionnalite
        // (import CSV) alors que le reste de l'app, via axios, fonctionne.
        // Remplace par l'instance api partagee, prouvee fonctionnelle
        // partout ailleurs dans l'app.
        let d
        try {
          const res = await personnelAPI.importCsvData(rows)
          d = res.data
        } catch (err) {
          throw new Error(
            err.response?.data?.detail ||
            err.response?.data?.error ||
            (err.response?.data ? JSON.stringify(err.response.data) : '') ||
            err.message ||
            'Erreur réseau'
          )
        }

        const ok = d.imported || 0
        const errs = d.errors || []
        const envoyes = d.identifiants_envoyes || 0
        const echecsEnvoi = d.identifiants_echecs || []
        const canalLabel = { sms: 'SMS', whatsapp: 'WhatsApp', email: 'email' }[d.canal_otp] || d.canal_otp || 'SMS'

        (errs.length ? toast.warning : toast.success)(
          `✅ ${ok} personnel importé(s) — identifiants envoyés par ${canalLabel} à ${envoyes}/${ok}` +
          (
            errs.length
              ? '\n\n⚠️ Lignes ignorées:\n' + errs.slice(0, 5).join('\n')
              : ''
          ) +
          (
            echecsEnvoi.length
              ? '\n\n⚠️ Envoi identifiants échoué:\n' + echecsEnvoi.slice(0, 5).join('\n')
              : ''
          )
        )

        load()

      } catch (e) {
        console.error('Erreur import personnel:', e)
        toast.error('Erreur import: ' + e.message)
      }
    }

    input.click()
  }

  // ── Chip actif (mobile) — dérivé des filtres existants plutôt qu'un
  // état séparé, pour ne jamais désynchroniser chip affiché / filtre réel.
  const mobileChip =
    typeFilter==='roxgold'       ? 'roxgold' :
    typeFilter==='sous_traitant' ? 'sous_traitant' :
    inductionFilter==='non_commence' ? 'induction' :
    actifFilter==='actif'        ? 'actifs' : 'tous'
  const setMobileChip = (chip) => {
    setTypeFilter(chip==='roxgold' ? 'roxgold' : chip==='sous_traitant' ? 'sous_traitant' : '')
    setActifFilter(chip==='actifs' ? 'actif' : '')
    setInductionFilter(chip==='induction' ? 'non_commence' : '')
  }
  const MOBILE_CHIPS = [
    {v:'tous', l:'Tous'}, {v:'actifs', l:'Actifs'}, {v:'roxgold', l:'Roxgold'},
    {v:'sous_traitant', l:'Sous-traitants'}, {v:'induction', l:'Induction à faire'},
  ]

  return (
    <PersonnelBoundary>
      <div className="page rzc-dark-scope" style={{padding: isMobile ? '16px 16px 90px' : '20px 22px', position:'relative'}}>

      {isMobile ? (
      <>
        {/* ── MOBILE : en-tête + recherche + chips + cartes ── */}
        <div style={{display:'flex',alignItems:'baseline',justifyContent:'space-between'}}>
          <h1 style={{margin:0,fontSize:20,fontWeight:700,color:'var(--rzc-text,#0F1A2E)'}}>Personnel</h1>
          <span style={{fontSize:12.5,color:'var(--rzc-text-3,#5B6472)',fontWeight:600}}>{filtered.length} membre(s)</span>
        </div>

        <div style={{marginTop:12,background:'#fff',border:'1px solid rgba(15,26,46,.12)',borderRadius:12,
          display:'flex',alignItems:'center',gap:8,padding:'0 12px',height:42}}>
          <span aria-hidden="true">🔍</span>
          <input value={search} onChange={e=>setSearch(e.target.value)}
            placeholder="Nom, société, matricule…" aria-label="Rechercher un membre du personnel"
            style={{border:'none',outline:'none',fontSize:13.5,color:'var(--rzc-text,#0F1A2E)',width:'100%',
              fontFamily:'inherit',background:'transparent'}}/>
        </div>

        <div style={{display:'flex',gap:8,overflowX:'auto',marginTop:10,paddingBottom:4}}>
          {MOBILE_CHIPS.map(c => (
            <button key={c.v} onClick={()=>setMobileChip(c.v)} aria-pressed={mobileChip===c.v}
              style={{border:'1px solid rgba(15,26,46,.14)',
                background: mobileChip===c.v ? 'var(--rzc-navy,#0F2A5C)' : '#fff',
                color: mobileChip===c.v ? '#fff' : 'var(--rzc-text-2,#2D3B52)',
                borderRadius:99,padding:'7px 14px',fontSize:12.5,fontWeight:600,whiteSpace:'nowrap',
                flexShrink:0,cursor:'pointer'}}>
              {c.l}
            </button>
          ))}
        </div>

        <div style={{display:'flex',flexDirection:'column',gap:10,marginTop:14}}>
          {loading ? (
            <div style={{textAlign:'center',padding:40,fontSize:32}}>⏳</div>
          ) : filtered.length === 0 ? (
            <div style={{textAlign:'center',padding:40,color:'var(--rzc-text-4,#8B95A1)'}}>
              <div style={{fontSize:40,marginBottom:10}}>👤</div>
              Aucun membre trouvé
            </div>
          ) : filtered.map(p => {
            const initiales = `${(p.nom||'?')[0]||''}${(p.prenom||'')[0]||''}`.toUpperCase()
            const chambre = p.residence_principale?.residence || p.chambre
            return (
              <button key={p.id} onClick={() => {
                  setForm({
                    nom:p.nom, prenom:p.prenom, email:p.email||'',
                    telephone:p.telephone||'', numero_whatsapp:p.numero_whatsapp||'', departement:p.departement||'', societe:p.societe||'',
                    type_personnel:p.type_personnel||'employe',
                    numero:p.numero||'', actif:p.actif,
                    est_expatrie:!!p.est_expatrie, pays_origine:p.pays_origine||'', eligible_mobilite:!!p.eligible_mobilite, mobilite:!!p.a_droit_mobilite
                  })
                  setErr(''); setModal(p)
                }}
                style={{display:'flex',alignItems:'center',gap:12,width:'100%',textAlign:'left',
                  background:'#fff',border:'1px solid rgba(15,26,46,.10)',borderRadius:14,padding:12,
                  boxSizing:'border-box',cursor:'pointer',fontFamily:'inherit'}}>
                <div style={{width:42,height:42,borderRadius:'50%',background:'var(--rzc-navy,#0F2A5C)',color:'#fff',
                  display:'flex',alignItems:'center',justifyContent:'center',fontSize:14,fontWeight:600,flexShrink:0}}>
                  {initiales || '?'}
                </div>
                <div style={{flex:1,minWidth:0}}>
                  <p style={{margin:0,fontSize:13.5,fontWeight:700,color:'var(--rzc-text,#0F1A2E)',
                    overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{p.nom} {p.prenom}</p>
                  <p style={{margin:'2px 0 0',fontSize:11.5,color:'var(--rzc-text-3,#5B6472)',
                    overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                    {p.societe || '—'}{p.poste ? ` · ${p.poste}` : ''}{chambre ? ` · 🏠 ${chambre}` : ''}
                  </p>
                </div>
                {p.qr_code_data && (
                  <span onClick={e=>{e.stopPropagation(); setQrModal(p)}}
                    style={{fontSize:16,flexShrink:0,padding:4}} role="button" aria-label="Voir le QR code" tabIndex={0}
                    onKeyDown={e=>{if(e.key==='Enter'){e.stopPropagation(); setQrModal(p)}}}>
                    🔲
                  </span>
                )}
                <span className="rzc-badge" style={{fontSize:10.5,fontWeight:700,borderRadius:99,padding:'2px 9px',
                  flexShrink:0, background: p.actif ? 'rgba(22,163,74,.12)' : 'rgba(220,38,38,.10)',
                  color: p.actif ? '#16A34A' : '#DC2626'}}>
                  {p.actif ? 'Actif' : 'Inactif'}
                </span>
              </button>
            )
          })}
        </div>

        {!lectureSeule && (
          <button onClick={()=>{
              setForm({nom:'',prenom:'',email:'',telephone:'',numero_whatsapp:'',departement:'',societe:'ROXGOLD',type_personnel:'roxgold',numero:'',actif:true,est_expatrie:false,pays_origine:'',eligible_mobilite:false,mobilite:true})
              setErr(''); setModal('new')
            }}
            aria-label="Ajouter un membre du personnel"
            style={{position:'fixed',right:16,bottom:'calc(98px + env(safe-area-inset-bottom, 0px))',
              width:54,height:54,borderRadius:27,background:'var(--rzc-ore-gold,#C9972B)',border:'none',
              boxShadow:'0 6px 16px rgba(201,151,43,.4)',fontSize:24,color:'#1A1206',cursor:'pointer',zIndex:90}}>
            +
          </button>
        )}
      </>
      ) : (
      <>
        {/* ── HEADER ── */}
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20,flexWrap:'wrap',gap:10}}>
          <div>
            <h2 style={{fontSize:22,fontWeight:800,color:'var(--rzc-bright-gold)',margin:0}}>
              👤 Gestion du Personnel
            </h2>
            <p style={{fontSize:12,color:'var(--rzc-text-3)',margin:'4px 0 0'}}>
              {data.length} membres enregistrés
            </p>
          </div>
          <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
            <button onClick={()=>{setMasseResult(null);setMasseModal(true)}}
              style={{...btn('var(--rzc-copper)')}}>
              👥 Sous-traitants masse
            </button>
            {!lectureSeule && (
              <>
                <button onClick={()=>{
                  setForm({nom:'',prenom:'',email:'',telephone:'',numero_whatsapp:'',departement:'',societe:'ROXGOLD',type_personnel:'roxgold',numero:'',actif:true,est_expatrie:false,pays_origine:'',eligible_mobilite:false,mobilite:true})
                  setErr(''); setModal('new')
                }} style={{...btn('var(--rzc-ore-gold)'), color:'#1A1206'}}>
                  ➕ Nouveau membre
                </button>
                <button onClick={()=>downloadPersonnelTemplate()} style={{...btn('var(--rzc-blue)'),fontSize:12}}>📋 Template</button>
                <button onClick={()=>importPersonnelCSV()} style={{...btn('var(--rzc-blue)'),fontSize:12}}>📤 Import CSV</button>
              </>
            )}
            <button onClick={()=>exportPersonnelCSV(filtered)} style={{...btn('var(--rzc-green)'),fontSize:12}}>📥 Export CSV ({filtered.length})</button>
          </div>
        </div>

        {/* ── FILTRES ── */}
        <div style={{display:'flex',gap:10,marginBottom:16,flexWrap:'wrap'}}>
          <input value={search} onChange={e=>setSearch(e.target.value)}
            placeholder="🔍 Rechercher nom, email, société..."
            style={{...inp,maxWidth:300}}/>
          <select value={typeFilter} onChange={e=>setTypeFilter(e.target.value)}
            style={{...inp,maxWidth:160}}>
            <option value="">Tous les types</option>
            {TYPES.map(t => <option key={t.v} value={t.v}>{t.l}</option>)}
          </select>
          <select value={actifFilter||''} onChange={e=>setActifFilter(e.target.value)}
            style={{...inp,maxWidth:140}}>
            <option value="">Tous (actif)</option>
            <option value="actif">✅ Actifs</option>
            <option value="inactif">🔒 Inactifs</option>
          </select>
          <select value={inductionFilter||''} onChange={e=>setInductionFilter(e.target.value)}
            style={{...inp,maxWidth:160}}>
            <option value="">Toutes inducti.</option>
            <option value="induit">✅ Induits</option>
            <option value="en_cours">⏳ En cours</option>
            <option value="non_commence">❌ Non commencé</option>
          </select>
          <select value={expatrieFilter} onChange={e=>setExpatrieFilter(e.target.value)}
            style={{...inp,maxWidth:150}}>
            <option value="">Expatrié ?</option>
            <option value="oui">✈️ Expatriés</option>
            <option value="non">🏠 Non-expatriés</option>
          </select>
          <select value={mobiliteFilter} onChange={e=>setMobiliteFilter(e.target.value)}
            style={{...inp,maxWidth:170}}>
            <option value="">Droit mobilité ?</option>
            <option value="oui">🚐 Avec droit</option>
            <option value="non">🚫 Sans droit</option>
          </select>
          {(typeFilter||profilFilter||societeFilter||actifFilter||inductionFilter||expatrieFilter||mobiliteFilter||search) && (
            <button onClick={()=>{setTypeFilter('');setProfilFilter('');setSocieteFilter('');setActifFilter('');setInductionFilter('');setExpatrieFilter('');setMobiliteFilter('');setSearch('')}}
              style={{background:'var(--rzc-red-l)',color:'#DC2626',border:'1px solid rgba(220,38,38,.25)',borderRadius:9,
                padding:'8px 14px',cursor:'pointer',fontSize:12,fontWeight:700,whiteSpace:'nowrap'}}>
              ✕ Reset
            </button>
          )}
          <select value={profilFilter} onChange={e=>setProfilFilter(e.target.value)}
            style={{...inp,maxWidth:160}}>
            <option value="">Tous les profils</option>
            {PROFILS.map(p => <option key={p.v} value={p.v}>{p.l}</option>)}
          </select>
          <input value={societeFilter} onChange={e=>setSocieteFilter(e.target.value)}
            placeholder="🏢 Filtrer par société..." style={{...inp,maxWidth:200}}/>
          {(typeFilter||profilFilter||societeFilter) && (
            <button onClick={()=>{setTypeFilter('');setProfilFilter('');setSocieteFilter('')}}
              style={{background:'rgba(15,26,46,.06)',border:'none',borderRadius:8,padding:'7px 12px',
                fontSize:12,cursor:'pointer',color:'var(--rzc-text-3)'}}>✕ Reset</button>
          )}
        </div>

        {/* ── TABLE ── */}
        {/* Barre actions masse */}
        {selected_ids.size > 0 && !lectureSeule && (
          <div style={{background:'linear-gradient(135deg,var(--rzc-ore-gold),var(--rzc-copper))',color:'#1A1206',
            borderRadius:12,padding:'10px 16px',marginBottom:12,
            display:'flex',alignItems:'center',gap:10,flexWrap:'wrap'}}>
            <span style={{fontWeight:700,fontSize:13}}>
              {selected_ids.size} sélectionné(s)
            </span>
            <select value={massAction} onChange={e=>setMassAction(e.target.value)}
              style={{border:'none',borderRadius:8,padding:'5px 10px',fontSize:12,fontWeight:600,
                background:'rgba(255,255,255,.15)',color:'#fff',outline:'none',cursor:'pointer'}}>
              <option value="">— Action groupée —</option>
              <optgroup label="── Type" style={{color:'#000'}}>
                {TYPES.map(t=><option key={t.v} value={`type:${t.v}`} style={{color:'#000'}}>{t.l}</option>)}
              </optgroup>
              <optgroup label="── Profil" style={{color:'#000'}}>
                {PROFILS.map(p=><option key={p.v} value={`profil:${p.v}`} style={{color:'#000'}}>{p.l}</option>)}
              </optgroup>
              <optgroup label="── Induction" style={{color:'#000'}}>
                <option value="no_induction" style={{color:'#000'}}>🚫 Marquer sans induction</option>
                <option value="with_induction" style={{color:'#000'}}>✅ Marquer avec induction</option>
              </optgroup>
              <optgroup label="── Expatriation" style={{color:'#000'}}>
                <option value="expatrie" style={{color:'#000'}}>✈️ Marquer expatrié</option>
                <option value="non_expatrie" style={{color:'#000'}}>🏠 Marquer non-expatrié</option>
              </optgroup>
              <optgroup label="── Centre de mobilité" style={{color:'#000'}}>
                <option value="mobilite_oui" style={{color:'#000'}}>🚐 Accorder le droit mobilité</option>
                <option value="mobilite_non" style={{color:'#000'}}>🚫 Retirer le droit mobilité</option>
              </optgroup>
              <optgroup label="── Statut" style={{color:'#000'}}>
                <option value="activer" style={{color:'#000'}}>✅ Activer</option>
                <option value="desactiver" style={{color:'#000'}}>🔒 Désactiver</option>
              </optgroup>
              <optgroup label="── Export" style={{color:'#000'}}>
                <option value="export" style={{color:'#000'}}>📥 Exporter CSV</option>
              </optgroup>
            </select>
            {massAction && (
              <button onClick={()=>massChangerRole(massAction)}
                style={{background:'#f0a500',color:'#000',border:'none',padding:'5px 12px',
                  borderRadius:8,cursor:'pointer',fontSize:12,fontWeight:700}}>
                ✓ Appliquer
              </button>
            )}
            <button onClick={massSupprimerSelected}
              style={{background:'#dc2626',color:'#fff',border:'none',padding:'5px 12px',
                borderRadius:8,cursor:'pointer',fontSize:12,fontWeight:700,marginLeft:'auto'}}>
              🗑️ Supprimer ({selected_ids.size})
            </button>
            <button onClick={()=>setSelectedIds(new Set())}
              style={{background:'rgba(255,255,255,.2)',color:'#fff',border:'none',
                padding:'5px 8px',borderRadius:8,cursor:'pointer',fontSize:11}}>
              ✕ Désélectionner
            </button>
          </div>
        )}

        {loading ? (
          <div style={{textAlign:'center',padding:60,fontSize:36}}>⏳</div>
        ) : filtered.length === 0 ? (
          <div style={{textAlign:'center',padding:60,color:'#94a3b8'}}>
            <div style={{fontSize:48,marginBottom:12}}>👤</div>
            <div>Aucun membre trouvé</div>
          </div>
        ) : (
          <div className="rzc-card" style={{overflowX:'auto'}}>
            <table className="rzc-table" style={{width:'100%',borderCollapse:'collapse',minWidth:900}}>
              <thead>
                <tr style={{background:'rgba(15,26,46,.02)',borderBottom:'1px solid var(--rzc-border)'}}>
                  <th style={{padding:'12px 14px',width:40}}>
                    <input type="checkbox"
                      checked={filtered.length>0 && filtered.every(p=>selected_ids.has(p.id))}
                      onChange={e=>{
                        if(e.target.checked) setSelectedIds(new Set(filtered.map(p=>p.id)))
                        else setSelectedIds(new Set())
                      }}
                      title="Tout sélectionner/désélectionner"
                      style={{width:16,height:16,cursor:'pointer'}}/>
                  </th>
                  {['Nom','Type','Rôle','Société','CIE / Département','Contact','Date création','Actions'].map(h => (
                    <th key={h} style={{padding:'12px 14px',textAlign:'left',fontSize:11,
                      fontWeight:700,color:'var(--rzc-text-3)',textTransform:'uppercase',letterSpacing:.5}}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((p, i) => (
                  <tr key={p.id} style={{borderBottom:'1px solid var(--rzc-border)',
                    background:i%2===0?'transparent':'rgba(15,26,46,.02)'}}>
                    <td style={{padding:'10px 14px',width:40}}>
                      <input type="checkbox" checked={selected_ids.has(p.id)}
                        onChange={()=>toggleSelect(p.id)} onClick={e=>e.stopPropagation()}
                        style={{cursor:'pointer',width:16,height:16}}/>
                    </td>
                    <td style={{padding:'10px 14px'}}>
                      <div style={{fontWeight:600,color:'var(--rzc-text)'}}>{p.nom} {p.prenom}</div>
                      <div style={{fontSize:11,color:'var(--rzc-text-4)'}}>{p.email}</div>
                    </td>
                    <td style={{padding:'10px 14px'}}>
                      <span style={{
                        background: p.type_personnel==='roxgold'?'var(--rzc-bright-gold-l)':
                          p.type_personnel==='sous_traitant'?'var(--rzc-ore-gold-l)':
                          p.type_personnel==='visiteur'?'var(--rzc-green-l)':'rgba(15,26,46,.06)',
                        color: p.type_personnel==='roxgold'?'var(--rzc-bright-gold)':
                          p.type_personnel==='sous_traitant'?'var(--rzc-copper)':
                          p.type_personnel==='visiteur'?'#15803D':'var(--rzc-text-3)',
                        padding:'3px 8px',borderRadius:99,fontSize:11,fontWeight:700
                      }}>
                        {TYPES.find(t=>t.v===p.type_personnel)?.l || p.type_personnel}
                      </span>
                    </td>
                    <td style={{padding:'10px 14px'}}>
                      <span style={{background:'rgba(124,58,237,.1)',color:'#7c3aed',
                        padding:'3px 8px',borderRadius:99,fontSize:11,fontWeight:700}}>
                        {p.profil_label || PROFILS.find(pr=>pr.v===p.profil)?.l || p.profil || '—'}
                      </span>
                      {p.user_role && p.user_role !== p.profil && (
                        <div style={{fontSize:10,color:'var(--rzc-text-4)',marginTop:3}} title="Rôle de connexion réel (pages/droits)">
                          🔑 {PROFILS.find(pr=>pr.v===p.user_role)?.l || p.user_role}
                        </div>
                      )}
                    </td>

                    <td style={{padding:'10px 14px',fontSize:12,color:'var(--rzc-text-2)'}}>
                      <div>{p.societe || '—'}</div>
                    </td>
                    <td style={{padding:'10px 14px',fontSize:12,color:'var(--rzc-text-2)'}}>
                      {p.departement || <span style={{color:'var(--rzc-text-4)'}}>—</span>}
                    </td>
                    <td style={{padding:'10px 14px',fontSize:12,color:'var(--rzc-text-2)'}}>
                      <div>{p.telephone || '—'}</div>
                      {p.numero_whatsapp && (
                        <div style={{fontSize:11,color:'#16a34a',marginTop:2}}>💬 {p.numero_whatsapp}</div>
                      )}
                    </td>
                    <td style={{padding:'10px 14px',fontSize:11,color:'var(--rzc-text-4)'}}>
                      {p.date_creation ? new Date(p.date_creation).toLocaleDateString('fr-FR') : p.created_at ? new Date(p.created_at).toLocaleDateString('fr-FR') : '—'}
                    </td>
                    <td style={{padding:'10px 14px'}}>
                      {p.qr_code_data ? (
                        <button onClick={() => setQrModal(p)}
                          style={{background:'rgba(15,26,46,.04)',border:'1px solid var(--rzc-border-light)',
                            borderRadius:6,padding:'4px 8px',cursor:'pointer',
                            fontSize:11,fontWeight:700,color:'var(--rzc-bright-gold)'}}>
                          🔲 QR
                        </button>
                      ) : (
                        <span style={{fontSize:11,color:'var(--rzc-text-4)'}}>—</span>
                      )}
                    </td>
                    <td style={{padding:'10px 14px'}}>
                      <div style={{display:'flex',gap:6}}>
                        {lectureSeule ? (
                          <span style={{fontSize:11,color:'var(--rzc-text-4)',fontStyle:'italic'}}>🔒 Lecture seule</span>
                        ) : (
                        <div style={{display:'flex',gap:4,flexWrap:'wrap'}}>
                          <button onClick={() => {
                            setForm({
                              nom:p.nom, prenom:p.prenom, email:p.email||'',
                              telephone:p.telephone||'', numero_whatsapp:p.numero_whatsapp||'', departement:p.departement||'', societe:p.societe||'',
                              type_personnel:p.type_personnel||'employe',
                              numero:p.numero||'', actif:p.actif,
                              est_expatrie:!!p.est_expatrie, pays_origine:p.pays_origine||'', eligible_mobilite:!!p.eligible_mobilite, mobilite:!!p.a_droit_mobilite
                            })
                            setErr(''); setModal(p)
                          }} style={{background:'var(--rzc-blue-l)',color:'#2563EB',border:'1px solid rgba(37,99,235,.25)',
                            padding:'4px 8px',borderRadius:7,cursor:'pointer',fontSize:11,fontWeight:700,title:'Modifier'}}>
                            ✏️
                          </button>
                          <button onClick={() => {setNewRole(p.type_personnel);setNewProfil(p.profil||'agent');setNewLoginRole('');setRoleModal(p)}}
                            style={{background:'var(--rzc-blue-l)',color:'#2563EB',border:'1px solid rgba(37,99,235,.25)',
                              padding:'4px 8px',borderRadius:7,cursor:'pointer',fontSize:11,fontWeight:700}}
                            title="Changer le profil">
                            👤
                          </button>
                          <button onClick={() => {
                              setRpModal(p); setRpBatimentChoisi(p.residence_principale?.batiment_id || '')
                              if (rpBatiments.length===0) batimentsAPI.list().then(r=>setRpBatiments(r.data.results||r.data||[])).catch(()=>{})
                            }}
                            style={{background: p.residence_principale ? '#16a34a20' : 'var(--rzc-blue-l)', color: p.residence_principale ? '#16a34a' : '#2563EB',
                              border:`1px solid ${p.residence_principale ? '#16a34a40' : 'rgba(37,99,235,.25)'}`,
                              padding:'4px 8px',borderRadius:7,cursor:'pointer',fontSize:11,fontWeight:700}}
                            title={p.residence_principale ? `Résident principal — ${p.residence_principale.residence}` : "Déclarer résident principal"}>
                            🏠
                          </button>
                          <button onClick={async () => {
                              if (!await confirmDialog(`Régénérer les identifiants de ${p.nom} ${p.prenom} ? L'ancien mot de passe ne fonctionnera plus.`)) return
                              try {
                                const r = await personnelAPI.regenererCompte(p.id)
                                setCredentialsModal({ nom: p.nom, prenom: p.prenom, login: r.data.login, password: r.data.password })
                              } catch(e) { toast.error(e.response?.data?.error || 'Erreur') }
                            }}
                            style={{background:'var(--rzc-bright-gold-l)',color:'var(--rzc-bright-gold)',border:'1px solid rgba(245,197,66,.3)',
                              padding:'4px 8px',borderRadius:7,cursor:'pointer',fontSize:11,fontWeight:700}}
                            title="Régénérer les identifiants de connexion">
                            🔑
                          </button>
                          <button onClick={() => handleToggleActif(p)}
                            style={{background:p.actif?'var(--rzc-bright-gold-l)':'var(--rzc-green-l)',
                              color:p.actif?'var(--rzc-bright-gold)':'#15803D',
                              border:'1px solid '+(p.actif?'rgba(245,197,66,.3)':'rgba(74,222,128,.3)'),
                              padding:'4px 8px',borderRadius:7,cursor:'pointer',fontSize:11,fontWeight:700}}
                            title={p.actif?'Désactiver':'Activer'}>
                            {p.actif ? '🔒' : '🔓'}
                          </button>
                          <button onClick={async()=>{
                              const BASE = import.meta?.env?.VITE_API_URL || window.location.origin
                              const token = localStorage.getItem('access_token') || ''
                              // Toggle: false si actuellement true (ou undefined), true si false
                              const curVal = p.induction_requise !== false
                              const newVal = !curVal
                              // Sauvegarder en localStorage immédiatement (évite 500 si colonne absente)
                              const lsKey = `rzi_no_induction_${p.id}`
                              if (!newVal) {
                                localStorage.setItem(lsKey, '1')
                              } else {
                                localStorage.removeItem(lsKey)
                              }
                              // Essayer l'API backend (silencieux si erreur)
                              fetch(`${BASE}/api/personnel/${p.id}/toggle_induction/`, {
                                method:'PATCH',
                                headers:{'Content-Type':'application/json','Authorization':`Bearer ${token}`},
                                body: JSON.stringify({induction_requise: newVal})
                              }).catch(()=>{})
                              load()
                            }}
                            style={{background: p.induction_requise===false?'var(--rzc-bright-gold-l)':'var(--rzc-green-l)',
                              color: p.induction_requise===false?'var(--rzc-bright-gold)':'#15803D',
                              border: `1px solid ${p.induction_requise===false?'rgba(245,197,66,.3)':'rgba(74,222,128,.3)'}`,
                              padding:'4px 8px',borderRadius:7,cursor:'pointer',fontSize:11,fontWeight:700}}
                            title={(()=>{const k=localStorage.getItem(`rzi_no_induction_${p.id}`);const noInd=p.induction_requise===false||k==='1';return noInd?"Activer l'induction":"Marquer sans induction"})()}>
                            {(p.induction_requise===false||localStorage.getItem(`rzi_no_induction_${p.id}`))?'🚫':'✅'}
                          </button>
                          <button onClick={() => setConfirmDel(p)}
                            style={{background:'var(--rzc-red-l)',color:'#DC2626',border:'1px solid rgba(220,38,38,.25)',
                              padding:'4px 8px',borderRadius:7,cursor:'pointer',fontSize:11,fontWeight:700}}
                            title="Supprimer">
                            🗑️
                          </button>
                        </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </>
      )}

        {/* ══ MODAL CRÉER/MODIFIER ══ */}
        {modal && (
          <div style={{position:'fixed',inset:0,background:'rgba(11,15,20,.82)',
            display:'flex',alignItems:'flex-start',justifyContent:'center',zIndex:1000,padding:16,overflowY:'auto'}}
            onClick={e=>e.target===e.currentTarget&&setModal(null)}>
            {/* Formulaire long (9+ champs) : sans maxHeight+overflowY sur le
                corps, le clic sur "Enregistrer" tombait hors-écran sur
                mobile, sans aucun moyen de scroller pour l'atteindre
                (l'overlay lui-meme n'avait pas overflowY, et alignItems:
                'center' sur un contenu plus haut que l'ecran coupe le
                debut du contenu de facon inaccessible au scroll sur
                mobile - d'ou le passage a alignItems:'flex-start'). ──
                display:flex column ici pour garder le header colore fixe
                et ne faire defiler QUE le corps du formulaire. */}
            <div className="rzc-card" style={{width:'100%',maxWidth:500,
              overflow:'hidden',marginTop:isMobile?8:'5vh',marginBottom:8,
              maxHeight:'92vh',display:'flex',flexDirection:'column'}}>
              <div style={{background:'linear-gradient(135deg,var(--rzc-ore-gold),var(--rzc-copper))',color:'#1A1206',
                padding:'14px 20px',display:'flex',justifyContent:'space-between',alignItems:'center',flexShrink:0}}>
                <div style={{fontWeight:700,fontSize:15}}>
                  {modal==='new' ? '➕ Nouveau membre' : `✏️ Modifier — ${modal.nom} ${modal.prenom}`}
                </div>
                <button onClick={()=>setModal(null)}
                  style={{background:'rgba(255,255,255,.2)',border:'none',color:'#fff',
                    width:28,height:28,borderRadius:8,cursor:'pointer',fontSize:16}}>✕</button>
              </div>
              <div style={{padding:20,display:'flex',flexDirection:'column',gap:12,overflowY:'auto'}}>
                {err && (
                  <div style={{background:'#fef2f2',border:'1px solid #fca5a5',borderRadius:8,
                    padding:'8px 12px',color:'#dc2626',fontSize:12}}>
                    ❌ {err}
                  </div>
                )}
                <div style={{display:'grid',gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap:12}}>
                  <div>
                    <label style={{display:'block',fontSize:11,fontWeight:700,color:'var(--rzc-text-3)',marginBottom:4}}>NOM *</label>
                    <input value={form.nom} onChange={e=>setForm({...form,nom:e.target.value})} style={inp}/>
                  </div>
                  <div>
                    <label style={{display:'block',fontSize:11,fontWeight:700,color:'var(--rzc-text-3)',marginBottom:4}}>PRÉNOM *</label>
                    <input value={form.prenom} onChange={e=>setForm({...form,prenom:e.target.value})} style={inp}/>
                  </div>
                </div>
                <div>
                  <label style={{display:'block',fontSize:11,fontWeight:700,color:'var(--rzc-text-3)',marginBottom:4}}>
                    EMAIL{canalOtp==='email' && ' *'}
                  </label>
                  <input type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} style={inp}/>
                  {canalOtp==='email' && <div style={{fontSize:10.5,color:'var(--rzc-text-3)',marginTop:3}}>Obligatoire — canal de connexion configuré : email</div>}
                </div>
                <div style={{display:'grid',gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap:12}}>
                  <div>
                    <label style={{display:'block',fontSize:11,fontWeight:700,color:'var(--rzc-text-3)',marginBottom:4}}>
                      TÉLÉPHONE *
                    </label>
                    <input
                      type="tel"
                      value={form.telephone}
                      onChange={e=>setForm({...form,telephone:e.target.value})}
                      style={inp}
                      placeholder="0701234567"
                    />
                    <div style={{fontSize:10.5,color:'var(--rzc-text-3)',marginTop:3}}>Obligatoire — format 0XXXXXXXXX</div>
                  </div>
                  <div>
                    <label style={{display:'block',fontSize:11,fontWeight:700,color:'var(--rzc-text-3)',marginBottom:4}}>
                      WHATSAPP *
                    </label>
                    <input
                      type="tel"
                      value={form.numero_whatsapp}
                      onChange={e=>setForm({...form,numero_whatsapp:e.target.value})}
                      style={inp}
                      placeholder="0701234567"
                    />
                    <div style={{fontSize:10.5,color:'var(--rzc-text-3)',marginTop:3}}>Obligatoire — format 0XXXXXXXXX</div>
                  </div>
                </div>

                <div>
                  <label style={{display:'block',fontSize:11,fontWeight:700,color:'var(--rzc-text-3)',marginBottom:4}}>TYPE</label>
                  <select value={form.type_personnel} onChange={e=>{
                    const v = e.target.value
                    // Employé Roxgold → société auto-remplie et verrouillée sur ROXGOLD
                    setForm({...form, type_personnel:v, societe: v==='roxgold' ? 'ROXGOLD' : (form.societe==='ROXGOLD' ? '' : form.societe), departement: v==='sous_traitant' ? '' : form.departement, mobilite: v!=='visiteur'})
                  }} style={inp}>
                    {TYPES.map(t => <option key={t.v} value={t.v}>{t.l}</option>)}
                  </select>
                </div>
                <div style={{display:'grid',gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap:12}}>
                  <div>
                    <label style={{display:'block',fontSize:11,fontWeight:700,color:'var(--rzc-text-3)',marginBottom:4}}>{form.type_personnel==='sous_traitant' ? 'ENTREPRISE SOUS-TRAITANTE' : 'SOCIÉTÉ'}</label>
                    {form.type_personnel==='sous_traitant' && ents.length ? (
                      <SelectRecherche value={form.societe} style={inp}
                        onChange={e=>{
                          const ent = ents.find(x => x.nom === e.target.value)
                          setForm(f=>({...f, societe:e.target.value, departement: ent?.departement_effectif_nom || ''}))
                        }}>
                        <option value="">— Choisir ou taper l'entreprise —</option>
                        {ents.map(x=><option key={x.id} value={x.nom}>{x.nom}{x.entreprise_mere_nom ? ` (via ${x.entreprise_mere_nom})` : x.departement_nom ? ` (${x.departement_nom})` : ''}</option>)}
                      </SelectRecherche>
                    ) : (
                      <input value={form.societe} disabled={form.type_personnel==='roxgold'}
                        onChange={e=>setForm({...form,societe:e.target.value})}
                        style={{...inp, ...(form.type_personnel==='roxgold' ? {opacity:.65, cursor:'not-allowed'} : {})}}/>
                    )}
                  </div>
                  <div>
                    <label style={{display:'block',fontSize:11,fontWeight:700,color:'var(--rzc-text-3)',marginBottom:4}}>N° MATRICULE</label>
                    <input value={form.numero} onChange={e=>setForm({...form,numero:e.target.value})} style={inp}/>
                  </div>
                  <div>
                    <label style={{display:'block',fontSize:11,fontWeight:700,color:'var(--rzc-text-3)',marginBottom:4}}>DÉPARTEMENT {form.type_personnel==='sous_traitant' ? <span style={{fontWeight:400,color:'var(--rzc-text-4)'}}>(déduit de l'entreprise)</span> : <span style={{fontWeight:400,color:'var(--rzc-red)'}}>*</span>}</label>
                    {form.type_personnel==='sous_traitant' ? (
                      <input value={form.departement||''} disabled placeholder="Choisissez l'entreprise" style={{...inp,opacity:.65,cursor:'not-allowed'}}/>
                    ) : deps.length ? (
                      <SelectRecherche value={form.departement||''} onChange={e=>setForm({...form,departement:e.target.value})} style={inp}>
                        <option value="">— Choisir ou taper le département —</option>
                        {(form.departement && !deps.some(d=>d.nom===form.departement)) && <option value={form.departement}>{form.departement} (hors liste)</option>}
                        {deps.map(d=><option key={d.id} value={d.nom}>{d.nom}</option>)}
                      </SelectRecherche>
                    ) : (
                      <input value={form.departement||''} placeholder="Ex: Mining, IT..." onChange={e=>setForm({...form,departement:e.target.value})} style={inp}/>
                    )}
                  </div>
                </div>
                <div style={{display:'grid',gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap:12, marginTop:12}}>
                  <div style={{display:'flex',alignItems:'center',gap:8,paddingTop:18}}>
                    <input type="checkbox" id="est_expatrie" checked={!!form.est_expatrie}
                      onChange={e=>setForm({...form,est_expatrie:e.target.checked})}
                      style={{width:16,height:16,cursor:'pointer'}}/>
                    <label htmlFor="est_expatrie" style={{fontSize:12,fontWeight:600,color:'var(--rzc-text-2)',cursor:'pointer'}}>
                      🌍 Personnel expatrié (billets d'avion)
                    </label>
                  </div>
                  {form.est_expatrie && (
                    <div>
                      <label style={{display:'block',fontSize:11,fontWeight:700,color:'var(--rzc-text-3)',marginBottom:4}}>PAYS D'ORIGINE</label>
                      <input list="pays-liste" value={form.pays_origine||''} onChange={e=>setForm({...form,pays_origine:e.target.value})}
                        onBlur={e=>{
                          const v = e.target.value.trim()
                          if (v) setForm(f=>({...f, pays_origine: v.charAt(0).toUpperCase() + v.slice(1).toLowerCase()}))
                        }}
                        placeholder="ex: Canada, France..." style={inp}/>
                      <datalist id="pays-liste">
                        {['Canada','France','Belgique','Suisse','Royaume-Uni','Australie','Afrique du Sud',
                          "Côte d'Ivoire",'Burkina Faso','Ghana','Mali','Sénégal','Togo','Bénin','Guinée',
                          'Niger','Nigéria','Sierra Leone','Libéria','États-Unis','Chine','Inde','Liban',
                          'Maroc','Tunisie','Allemagne','Pays-Bas','Espagne','Italie','Portugal'
                        ].map(c=><option key={c} value={c}/>)}
                      </datalist>
                    </div>
                  )}
                </div>
                <div style={{display:'flex',alignItems:'center',gap:8,marginTop:10,padding:10,background:'#fffbeb',borderRadius:8,border:'1px solid #fde68a'}}>
                  <input type="checkbox" id="mobilite_droit" checked={!!form.mobilite}
                    onChange={e=>setForm({...form,mobilite:e.target.checked})}
                    style={{width:16,height:16,cursor:'pointer'}}/>
                  <label htmlFor="mobilite_droit" style={{fontSize:12,fontWeight:600,color:'#92400e',cursor:'pointer'}}>
                    🧭 Droit au Centre de Mobilité <span style={{fontWeight:400}}>({form.type_personnel==='visiteur' ? 'un visiteur peut être logé sans accès aux voyages — à cocher explicitement' : 'accordé par défaut — décocher pour le retirer'})</span>
                  </label>
                </div>
                <div style={{display:'flex',gap:10,marginTop:4}}>
                  <button onClick={()=>setModal(null)}
                    style={{flex:1,background:'rgba(15,26,46,.04)',color:'var(--rzc-text-3)',border:'1px solid var(--rzc-border-light)',
                      padding:12,borderRadius:9,cursor:'pointer',fontFamily:'inherit',fontSize:13}}>
                    Annuler
                  </button>
                  <button onClick={handleSave} disabled={saving}
                    style={{flex:2,background:saving?'var(--rzc-rock-gray)':'var(--rzc-ore-gold)',color:'#1A1206',border:'none',
                      padding:12,borderRadius:9,cursor:saving?'wait':'pointer',fontFamily:'inherit',
                      fontSize:13,fontWeight:700}}>
                    {saving ? '⏳ Enregistrement...' : '💾 Enregistrer'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ══ MODAL QR ══ */}
        {qrModal && (
          <div style={{position:'fixed',inset:0,background:'rgba(11,15,20,.82)',
            display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000,padding:16}}
            onClick={e=>e.target===e.currentTarget&&setQrModal(null)}>
            <div style={{background:'var(--rzc-charcoal-l1)',border:'1px solid var(--rzc-border-light)',borderRadius:16,width:'100%',maxWidth:340,
              overflow:'hidden',boxShadow:'var(--rzc-shadow-lg)'}}>
              <div style={{background:'linear-gradient(135deg,var(--rzc-ore-gold),var(--rzc-copper))',color:'#1A1206',
                padding:'14px 20px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <div style={{fontWeight:700,color:'#1A1206'}}>🔲 QR — {qrModal.nom} {qrModal.prenom}</div>
                <button onClick={()=>setQrModal(null)}
                  style={{background:'rgba(255,255,255,.2)',border:'none',color:'#fff',
                    width:28,height:28,borderRadius:8,cursor:'pointer',fontSize:16}}>✕</button>
              </div>
              <div style={{padding:24,textAlign:'center'}}>
                {qrModal.qr_code_data ? (
                  <img src={"data:image/png;base64," + qrModal.qr_code_data}
                    alt="QR Code" style={{width:200,height:200,imageRendering:'pixelated',
                      border:'3px solid var(--rzc-ore-gold)',borderRadius:12,padding:8}}/>
                ) : (
                  <div style={{width:200,height:200,background:'rgba(15,26,46,.03)',border:'2px dashed var(--rzc-border-light)',
                    borderRadius:12,display:'flex',alignItems:'center',justifyContent:'center',
                    color:'var(--rzc-text-4)',fontSize:12,margin:'0 auto'}}>
                    QR non disponible
                  </div>
                )}
                <div style={{marginTop:12,fontWeight:700,color:'var(--rzc-bright-gold)',fontSize:14}}>
                  {qrModal.nom} {qrModal.prenom}
                </div>
                <div style={{fontSize:11,color:'var(--rzc-text-3)',marginTop:4}}>
                  {qrModal.societe} · {TYPES.find(t=>t.v===qrModal.type_personnel)?.l}
                </div>
                {qrModal.login_genere && (
                  <div style={{marginTop:8,background:'rgba(15,26,46,.04)',borderRadius:8,padding:'8px 12px',
                    fontFamily:'monospace',fontSize:12,color:'var(--rzc-bright-gold)'}}>
                    Login: {qrModal.login_genere}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ══ MODAL SOUS-TRAITANTS EN MASSE ══ */}
        {masseModal && (
          <div style={{position:'fixed',inset:0,background:'rgba(11,15,20,.82)',
            display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000,padding:16}}
            onClick={e=>e.target===e.currentTarget&&setMasseModal(false)}>
            <div style={{background:'var(--rzc-charcoal-l1)',border:'1px solid var(--rzc-border-light)',borderRadius:16,width:'100%',maxWidth:480,
              overflow:'hidden',boxShadow:'var(--rzc-shadow-lg)'}}>
              <div style={{background:'linear-gradient(135deg,#f59e0b,#d97706)',color:'#fff',
                padding:'14px 20px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <div>
                  <div style={{fontWeight:700,fontSize:15}}>👥 Sous-Traitants en masse</div>
                  <div style={{fontSize:11,opacity:.8,marginTop:2}}>
                    Génère N accès temporaires pour une société
                  </div>
                </div>
                <button onClick={()=>{setMasseModal(false);setMasseResult(null)}}
                  style={{background:'rgba(255,255,255,.2)',border:'none',color:'#fff',
                    width:28,height:28,borderRadius:8,cursor:'pointer',fontSize:16}}>✕</button>
              </div>
              <div style={{padding:20}}>
                {masseResult === null ? (
                  <div style={{display:'flex',flexDirection:'column',gap:14}}>
                    <div style={{background:'var(--rzc-bright-gold-l)',borderRadius:10,padding:'10px 14px',
                      fontSize:12,color:'var(--rzc-bright-gold)'}}>
                      💡 Logins et mots de passe générés automatiquement
                    </div>
                    <div>
                      <label style={{display:'block',fontSize:11,fontWeight:700,
                        color:'var(--rzc-text-3)',marginBottom:5}}>SOCIÉTÉ *</label>
                      <input value={masseForm.societe}
                        onChange={e=>setMasseForm({...masseForm,societe:e.target.value})}
                        placeholder="Ex: SGBCI Mining, SAPH..."
                        style={inp}/>
                    </div>
                    <div style={{display:'grid',gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap:12}}>
                      <div>
                        <label style={{display:'block',fontSize:11,fontWeight:700,
                          color:'var(--rzc-text-3)',marginBottom:5}}>NOMBRE</label>
                        <input type="number" value={masseForm.nombre}
                          onChange={e=>setMasseForm({...masseForm,nombre:parseInt(e.target.value)||1})}
                          min={1} max={100} style={inp}/>
                      </div>
                      <div>
                        <label style={{display:'block',fontSize:11,fontWeight:700,
                          color:'var(--rzc-text-3)',marginBottom:5}}>DURÉE</label>
                        <select value={masseForm.duree_h}
                          onChange={e=>setMasseForm({...masseForm,duree_h:parseInt(e.target.value)})}
                          style={inp}>
                          <option value={24}>24 heures</option>
                          <option value={48}>48 heures</option>
                          <option value={72}>3 jours</option>
                          <option value={168}>1 semaine</option>
                          <option value={720}>1 mois</option>
                        </select>
                      </div>
                    </div>
                    <button disabled={masseLoading}
                      onClick={async () => {
                        if (!masseForm.societe.trim()) { toast.success('Société requise'); return }
                        setMasseLoading(true)
                        try {
                          const r = await personnelAPI.declarerMasse(masseForm)
                          setMasseResult(r.data)
                          load()
                        } catch(e) {
                          toast.error(e.response?.data?.error || 'Erreur serveur')
                        } finally {
                          setMasseLoading(false)
                        }
                      }}
                      style={{background:masseLoading?'var(--rzc-rock-gray)':'var(--rzc-copper)',color:'#fff',
                        border:'none',padding:13,borderRadius:10,cursor:masseLoading?'wait':'pointer',
                        fontSize:14,fontWeight:700,fontFamily:'inherit'}}>
                      {masseLoading ? '⏳ Création...' : ("Créer " + masseForm.nombre + " agents — " + masseForm.societe)}
                    </button>
                  </div>
                ) : (
                  <div>
                    <div style={{background:'var(--rzc-green-l)',border:'1px solid rgba(74,222,128,.3)',borderRadius:12,
                      padding:'12px 16px',marginBottom:16}}>
                      <div style={{fontWeight:700,color:'#15803D'}}>{masseResult.message}</div>
                      <div style={{fontSize:11,color:'#15803D'}}>Expire: {masseResult.expire}</div>
                    </div>
                    <div style={{maxHeight:220,overflowY:'auto',border:'1px solid var(--rzc-border-light)',
                      borderRadius:10,overflow:'hidden'}}>
                      <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
                        <thead>
                          <tr style={{background:'rgba(15,26,46,.04)'}}>
                            {['#','Login','Mot de passe'].map(h=>(
                              <th key={h} style={{padding:'8px 12px',textAlign:'left',
                                color:'var(--rzc-text-3)',fontWeight:700}}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {(masseResult.agents||[]).map((a,i)=>(
                            <tr key={i} style={{borderTop:'1px solid var(--rzc-border)',
                              background:i%2?'rgba(15,26,46,.02)':'transparent'}}>
                              <td style={{padding:'7px 12px',color:'var(--rzc-text-4)'}}>{i+1}</td>
                              <td style={{padding:'7px 12px',fontFamily:'monospace',
                                fontWeight:700,color:'var(--rzc-bright-gold)'}}>{a.login}</td>
                              <td style={{padding:'7px 12px',fontFamily:'monospace',
                                color:'#DC2626'}}>{a.pwd}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div style={{display:'flex',gap:10,marginTop:14}}>
                      <button onClick={()=>{
                        const txt = (masseResult.agents||[]).map(a=>a.login+' / '+a.pwd).join('\n')
                        navigator.clipboard.writeText(txt).then(()=>toast.success('Copié !'))
                      }} style={{flex:1,background:'var(--rzc-ore-gold)',color:'#1A1206',border:'none',
                        padding:11,borderRadius:9,cursor:'pointer',fontWeight:700,fontFamily:'inherit',fontSize:12}}>
                        📋 Copier
                      </button>
                      <button onClick={()=>{
                        setMasseResult(null)
                        setMasseForm({societe:'',nombre:5,duree_h:72})
                      }} style={{flex:1,background:'var(--rzc-copper)',color:'#fff',border:'none',
                        padding:11,borderRadius:9,cursor:'pointer',fontWeight:700,fontFamily:'inherit',fontSize:12}}>
                        👥 Nouvelle
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

      {/* ══ MODAL CONFIRMER SUPPRESSION ══ */}
      {confirmDel && (
        <div style={{position:'fixed',inset:0,background:'rgba(11,15,20,.82)',
          display:'flex',alignItems:'center',justifyContent:'center',zIndex:1100,padding:16}}
          onClick={e=>e.target===e.currentTarget&&setConfirmDel(null)}>
          <div style={{background:'var(--rzc-charcoal-l1)',border:'1px solid var(--rzc-border-light)',borderRadius:16,width:'100%',maxWidth:380,
            overflow:'hidden',boxShadow:'var(--rzc-shadow-lg)'}}>
            <div style={{background:'linear-gradient(135deg,#dc2626,#b91c1c)',color:'#fff',
              padding:'14px 20px'}}>
              <div style={{fontWeight:700}}>🗑️ Supprimer le membre</div>
            </div>
            <div style={{padding:20}}>
              <p style={{color:'var(--rzc-text-2)',fontSize:14,margin:'0 0 16px'}}>
                Confirmer la suppression de <strong>{confirmDel.nom} {confirmDel.prenom}</strong> ?
                <br/><span style={{color:'#dc2626',fontSize:12}}>⚠️ Action irréversible</span>
              </p>
              <div style={{display:'flex',gap:10}}>
                <button onClick={()=>setConfirmDel(null)}
                  style={{flex:1,background:'rgba(15,26,46,.04)',color:'var(--rzc-text-3)',border:'1px solid var(--rzc-border-light)',
                    padding:11,borderRadius:9,cursor:'pointer',fontFamily:'inherit',fontSize:13}}>
                  Annuler
                </button>
                <button onClick={()=>handleDelete(confirmDel)}
                  style={{flex:1,background:'#dc2626',color:'#fff',border:'none',
                    padding:11,borderRadius:9,cursor:'pointer',fontFamily:'inherit',fontSize:13,fontWeight:700}}>
                  🗑️ Supprimer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══ MODAL IDENTIFIANTS GENERES (affichage unique) ══ */}
      {credentialsModal && (
        <div style={{position:'fixed',inset:0,background:'rgba(11,15,20,.82)',
          display:'flex',alignItems:'center',justifyContent:'center',zIndex:1200,padding:16}}>
          <div className="rzc-card" style={{maxWidth:420,width:'100%',padding:24,textAlign:'center'}}>
            <div style={{fontSize:40,marginBottom:10}}>🔑</div>
            <div style={{fontWeight:800,fontSize:16,color:'var(--rzc-navy,#0F2A5C)',marginBottom:4}}>
              Identifiants de connexion
            </div>
            <div style={{fontSize:13,color:'var(--rzc-text-3)',marginBottom:16}}>
              {credentialsModal.nom} {credentialsModal.prenom}
            </div>
            <div style={{background:'#fffbeb',border:'1px solid #fde68a',borderRadius:10,padding:'14px 18px',
              fontSize:12,color:'#92400e',marginBottom:16,textAlign:'left'}}>
              ⚠️ Ce mot de passe ne sera <b>plus jamais affiché</b> nulle part dans l'application.
              Notez-le ou communiquez-le à la personne maintenant.
            </div>
            {credentialsModal.envois && (
              <div style={{marginBottom:16,fontSize:12,
                color: credentialsModal.envois.mode_test ? '#b45309' : (credentialsModal.envois.ok ? '#16a34a' : '#b45309')}}>
                {credentialsModal.envois.mode_test
                  // Le fournisseur 'test' (Paramétrage) répond toujours "ok" sans
                  // rien envoyer réellement - le signaler clairement ici évite de
                  // croire à une livraison qui n'a jamais eu lieu.
                  ? `🧪 Mode TEST — aucun envoi réel par ${{sms:'SMS',whatsapp:'WhatsApp',email:'email'}[credentialsModal.envois.canal] || credentialsModal.envois.canal} (changez le fournisseur dans Paramétrage pour un envoi réel)`
                  : credentialsModal.envois.ok
                    ? `✅ Identifiants envoyés par ${{sms:'SMS',whatsapp:'WhatsApp',email:'email'}[credentialsModal.envois.canal] || credentialsModal.envois.canal}`
                    : `⚠️ Envoi par ${{sms:'SMS',whatsapp:'WhatsApp',email:'email'}[credentialsModal.envois.canal] || credentialsModal.envois.canal} échoué : ${credentialsModal.envois.info || ''}`}
              </div>
            )}
            <div style={{display:'flex',flexDirection:'column',gap:10,marginBottom:18}}>
              <div style={{background:'rgba(15,26,46,.04)',borderRadius:8,padding:'10px 14px',
                fontFamily:'monospace',fontSize:15,fontWeight:700,color:'var(--rzc-navy,#0F2A5C)',
                display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <span>👤 {credentialsModal.login}</span>
              </div>
              <div style={{background:'rgba(15,26,46,.04)',borderRadius:8,padding:'10px 14px',
                fontFamily:'monospace',fontSize:15,fontWeight:700,color:'var(--rzc-bright-gold)',
                display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <span>🔒 {credentialsModal.password}</span>
              </div>
            </div>
            <button onClick={()=>{
                navigator.clipboard?.writeText(`Identifiant: ${credentialsModal.login}\nMot de passe: ${credentialsModal.password}`).catch(()=>{})
                toast.success('Copié dans le presse-papier')
              }}
              style={{width:'100%',background:'rgba(15,26,46,.06)',color:'var(--rzc-navy,#0F2A5C)',border:'none',
                padding:10,borderRadius:9,cursor:'pointer',fontSize:13,fontWeight:700,marginBottom:8}}>
              📋 Copier les deux
            </button>
            <button onClick={()=>setCredentialsModal(null)}
              style={{width:'100%',background:'var(--rzc-navy,#0F2A5C)',color:'#fff',border:'none',
                padding:10,borderRadius:9,cursor:'pointer',fontSize:13,fontWeight:700}}>
              J'ai noté — Fermer
            </button>
          </div>
        </div>
      )}

      {/* ══ MODAL CHANGER RÔLE ══ */}
      {roleModal && (
        <div style={{position:'fixed',inset:0,background:'rgba(11,15,20,.82)',
          display:'flex',alignItems:'center',justifyContent:'center',zIndex:1100,padding:16}}
          onClick={e=>e.target===e.currentTarget&&setRoleModal(null)}>
          <div style={{background:'var(--rzc-charcoal-l1)',border:'1px solid var(--rzc-border-light)',borderRadius:16,width:'100%',maxWidth:380,
            overflow:'hidden',boxShadow:'var(--rzc-shadow-lg)'}}>
            <div style={{background:'linear-gradient(135deg,#7c3aed,#6d28d9)',color:'#fff',
              padding:'14px 20px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <div style={{fontWeight:700}}>👤 Changer le profil</div>
              <button onClick={()=>setRoleModal(null)}
                style={{background:'rgba(255,255,255,.2)',border:'none',color:'#fff',
                  width:28,height:28,borderRadius:8,cursor:'pointer',fontSize:16}}>✕</button>
            </div>
            <div style={{padding:20}}>
              <p style={{fontSize:13,color:'var(--rzc-text-3)',margin:'0 0 12px'}}>
                Profil actuel de <strong>{roleModal.nom} {roleModal.prenom}</strong> :
                <span style={{fontWeight:700,color:'var(--rzc-blue)',marginLeft:6}}>
                  {TYPES.find(t=>t.v===roleModal.type_personnel)?.l || roleModal.type_personnel}
                </span>
              </p>
              <div style={{display:'grid',gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap:10,marginBottom:12}}>
                <div>
                  <div style={{fontSize:10,fontWeight:700,color:'var(--rzc-text-3)',marginBottom:5,textTransform:'uppercase'}}>
                    Type personnel
                  </div>
                  <select value={newRole} onChange={e=>setNewRole(e.target.value)} style={inp}>
                    {TYPES.map(t => <option key={t.v} value={t.v}>{t.l}</option>)}
                  </select>
                </div>
                <div>
                  <div style={{fontSize:10,fontWeight:700,color:'var(--rzc-text-3)',marginBottom:5,textTransform:'uppercase'}}>
                    🔑 Rôle (profil et accès)
                  </div>
                  <select value={newProfil||''} onChange={e=>{setNewProfil(e.target.value); setNewLoginRole(e.target.value)}} style={inp}>
                    <option value="">Inchangé</option>
                    {PROFILS.map(pr => <option key={pr.v} value={pr.v}>{pr.l}</option>)}
                  </select>
                  <div style={{fontSize:10,color:'var(--rzc-text-4)',marginTop:4}}>
                    Détermine les pages visibles et les droits (configurés dans Paramétrage → Rôles & Accès).
                  </div>
                </div>
              </div>
              {newProfil && (
                <div style={{background:'var(--rzc-blue-l)',border:'1px solid rgba(37,99,235,.25)',borderRadius:8,
                  padding:'6px 10px',fontSize:11,color:'#2563EB',marginBottom:10}}>
                  🎭 <strong>{PROFILS.find(pr=>pr.v===newProfil)?.l}</strong> · Type: <strong>{TYPES.find(t=>t.v===newRole)?.l}</strong>
                </div>
              )}
              <div style={{display:'flex',gap:10,marginTop:0}}>
                <button onClick={()=>setRoleModal(null)}
                  style={{flex:1,background:'rgba(15,26,46,.04)',color:'var(--rzc-text-3)',border:'1px solid var(--rzc-border-light)',
                    padding:11,borderRadius:9,cursor:'pointer',fontFamily:'inherit',fontSize:13}}>
                  Annuler
                </button>
                <button onClick={handleChangeRole}
                  style={{flex:2,background:'var(--rzc-blue)',color:'#fff',border:'none',
                    padding:11,borderRadius:9,cursor:'pointer',fontFamily:'inherit',
                    fontSize:13,fontWeight:700}}>
                  💾 Enregistrer Type & Profil
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══ MODAL RESIDENT PRINCIPAL ══ */}
      {rpModal && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.5)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000,padding:16}}
          onClick={e=>e.target===e.currentTarget && setRpModal(null)}>
          <div style={{background:'#fff',borderRadius:14,maxWidth:420,width:'100%',overflow:'hidden'}}>
            <div style={{padding:'14px 18px',background:'#16a34a',color:'#fff',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <div style={{fontWeight:700,fontSize:14}}>🏠 Résident principal — {rpModal.nom} {rpModal.prenom}</div>
              <button onClick={()=>setRpModal(null)} style={{background:'rgba(255,255,255,.2)',border:'none',color:'#fff',borderRadius:6,cursor:'pointer',width:28,height:28,fontSize:16}}>✕</button>
            </div>
            <div style={{padding:20}}>
              {rpModal.residence_principale ? (
                <div style={{background:'#f0fdf4',border:'1px solid #bbf7d0',borderRadius:9,padding:'12px 14px',marginBottom:16,fontSize:13}}>
                  Résident principal depuis le <b>{new Date(rpModal.residence_principale.date_debut).toLocaleDateString('fr-FR')}</b>, chambre <b>{rpModal.residence_principale.residence}</b>.
                  <div style={{fontSize:11,color:'#64748b',marginTop:4}}>Cette chambre reste la sienne même en son absence (voyage en cours via le Centre de mobilité).</div>
                </div>
              ) : (
                <div style={{fontSize:13,color:'#64748b',marginBottom:16}}>Cette personne n'est pas déclarée résidente principale.</div>
              )}
              <label style={{display:'block',fontSize:11,fontWeight:700,color:'#64748b',marginBottom:6,textTransform:'uppercase'}}>
                {rpModal.residence_principale ? 'Changer de chambre principale' : 'Affecter une chambre principale'}
              </label>
              <select value={rpBatimentChoisi} onChange={e=>setRpBatimentChoisi(e.target.value)}
                style={{width:'100%',border:'1px solid #e2e8f0',borderRadius:8,padding:'9px 12px',fontSize:13,marginBottom:14}}>
                <option value="">— Choisir une chambre —</option>
                {rpBatiments.filter(b=>b.statut!=='Maintenance').map(b=>(
                  <option key={b.id} value={b.id}>
                    {b.residence} {b.resident_principal && b.resident_principal.personnel_id!==rpModal.id ? `(déjà résidence principale de ${b.resident_principal.personnel_nom})` : ''}
                  </option>
                ))}
              </select>
              <div style={{display:'flex',gap:8}}>
                <button onClick={async()=>{
                    if (!rpBatimentChoisi) return toast.error('Choisissez une chambre.')
                    try {
                      if (rpModal.residence_principale) {
                        if (!await confirmDialog(`Changer la résidence principale de ${rpModal.residence_principale.residence} vers la nouvelle chambre choisie ? L'ancienne affectation sera conservée dans l'historique.`)) return
                        await rpAPI.changerChambre(rpModal.residence_principale.id, rpBatimentChoisi)
                      } else {
                        await rpAPI.declarer(rpModal.id, rpBatimentChoisi)
                      }
                      toast.success('Résidence principale enregistrée.')
                      setRpModal(null); load()
                    } catch(e) { toast.error(e.response?.data?.error || 'Erreur') }
                  }}
                  style={{flex:1,background:'#16a34a',color:'#fff',border:'none',padding:11,borderRadius:9,cursor:'pointer',fontSize:13,fontWeight:700}}>
                  {rpModal.residence_principale ? 'Changer de chambre' : 'Déclarer résident principal'}
                </button>
                {rpModal.residence_principale && (
                  <button onClick={async()=>{
                      if (!await confirmDialog(`Mettre fin à la résidence principale de ${rpModal.nom} ${rpModal.prenom} ?`)) return
                      try {
                        await rpAPI.mettreFin(rpModal.residence_principale.id)
                        toast.success('Résidence principale terminée.')
                        setRpModal(null); load()
                      } catch(e) { toast.error(e.response?.data?.error || 'Erreur') }
                    }}
                    style={{background:'#fef2f2',color:'#dc2626',border:'1px solid #fecaca',padding:'11px 14px',borderRadius:9,cursor:'pointer',fontSize:13,fontWeight:700}}>
                    Fin
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      </div>
    </PersonnelBoundary>
  )
}
