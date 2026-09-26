import React, { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { parametres as paramAPI, personnel as personnelAPI, rolesAPI, rapportsPlanifiesAPI, groupesDiffusion as groupesDiffusionAPI } from '../api'
import { useStore } from '../store'
import InductionAdmin from './InductionAdmin'
import Boutique from './Boutique'
import { questionsAvis as questionsAvisAPI } from '../api'
import { toast, confirmDialog } from '../toast'

const CHAMPS = [
  { section: 'Maintenance — Délais SLA', items: [
    { cle: 'sla_critique_h', label: 'Priorité Critique', suffix: 'heures', type: 'number' },
    { cle: 'sla_haute_h',    label: 'Priorité Haute',    suffix: 'heures', type: 'number' },
    { cle: 'sla_moyenne_h',  label: 'Priorité Moyenne',  suffix: 'heures', type: 'number' },
    { cle: 'sla_basse_h',    label: 'Priorité Basse',    suffix: 'heures', type: 'number' },
  ]},
  { section: 'Général', items: [
    { cle: 'nom_application', label: "Nom de l'application", suffix: '', type: 'text', hint: 'Affiché dans le menu, l\'écran de connexion et le titre d\'onglet — un changement ne nécessite plus de redéploiement' },
    { cle: 'societe_defaut', label: 'Société par défaut', suffix: '', type: 'text', hint: 'Utilisée pour l\'auto-remplissage "Employé Roxgold" dans Personnel' },
    { cle: 'nom_camp',       label: 'Nom du camp',        suffix: '', type: 'text' },
  ]},
  { section: '🛡️ Plan de gestion de voyage (JMP) — coordonnées d\'urgence', items: [
    { cle: 'jmp_tel_satellite', label: 'Téléphone satellite d\'urgence', suffix: '', type: 'text', hint: 'Imprimé en en-tête de chaque document JMP' },
    { cle: 'jmp_tel_mtn', label: 'Numéro MTN du centre d\'urgence', suffix: '', type: 'text', hint: '' },
    { cle: 'jmp_tel_orange', label: 'Numéro Orange du centre d\'urgence', suffix: '', type: 'text', hint: '' },
    { cle: 'jmp_securite_nom', label: 'Nom du responsable sécurité', suffix: '', type: 'text', hint: 'Approuve chaque document JMP' },
    { cle: 'jmp_securite_fonction', label: 'Fonction du responsable sécurité', suffix: '', type: 'text', hint: '' },
  ]},
  { section: '📱 Mobile Money — Numéros marchands du camp', items: [
    { cle: 'mm_numero_om',   label: 'Orange Money', suffix: '', type: 'text', hint: 'Numéro qui reçoit/envoie les paiements Orange Money' },
    { cle: 'mm_numero_wave', label: 'Wave',         suffix: '', type: 'text', hint: 'Numéro qui reçoit/envoie les paiements Wave' },
    { cle: 'mm_numero_mtn',  label: 'MTN Mobile Money', suffix: '', type: 'text', hint: 'Numéro qui reçoit/envoie les paiements MTN Money' },
    { cle: 'mm_numero_moov', label: 'Moov Money',  suffix: '', type: 'text', hint: 'Numéro qui reçoit/envoie les paiements Moov Money' },
  ]},
  { section: '📱 Connexion par SMS (OTP)', items: [
    { cle: 'sms_provider', label: 'Fournisseur SMS', suffix: '', type: 'text',
      hint: 'test (aucun envoi réel — code visible à l\'écran, pour valider le flux gratuitement), orange, africastalking, prosms, hsms' },
    { cle: 'canal_otp', label: "Canal d'envoi du code OTP", suffix: '', type: 'text',
      hint: 'sms ou whatsapp — whatsapp nécessite whatsapp_provider=meta ci-dessous (API WhatsApp Business officielle)' },
    { cle: 'sms_prosms_client_id', label: 'proSMS — Client ID', suffix: '', type: 'text', hint: 'Depuis prosms.ci/api-credentials — documentation confirmée et vérifiée' },
    { cle: 'sms_prosms_client_secret', label: 'proSMS — Client Secret', suffix: '', type: 'password', hint: '' },
    { cle: 'sms_prosms_sender_id', label: 'proSMS — Sender ID', suffix: '', type: 'text', hint: 'Max 11 caractères, doit être pré-approuvé sur prosms.ci sinon les envois sont rejetés (403)' },
    { cle: 'sms_hsms_token', label: 'HSMS — Token API (v2)', suffix: '', type: 'password', hint: 'Copié depuis votre tableau de bord hsms.ci. Sender ID : non applicable — l\'API HTTP v2 n\'a pas de champ sender ID (uniquement le SMPP, à accès séparé, en utilise un).' },
    { cle: 'sms_hsms_client_id', label: 'HSMS — Client ID', suffix: '', type: 'text', hint: 'Tableau de bord hsms.ci → votre application → onglet « Identifiants API »' },
    { cle: 'sms_hsms_client_secret', label: 'HSMS — Client Secret', suffix: '', type: 'password', hint: '' },
    { cle: 'sms_hsms_email', label: 'HSMS — Email du compte (optionnel)', suffix: '', type: 'text', hint: 'Permet de renouveler automatiquement le token quand il expire' },
    { cle: 'sms_hsms_password', label: 'HSMS — Mot de passe du compte (optionnel)', suffix: '', type: 'password', hint: 'Utilisé uniquement pour renouveler le token automatiquement' },
    { cle: 'sms_orange_client_id', label: 'Orange SMS API — Client ID', suffix: '', type: 'text', hint: 'Depuis developer.orange.com' },
    { cle: 'sms_orange_client_secret', label: 'Orange SMS API — Client Secret', suffix: '', type: 'password', hint: 'Depuis developer.orange.com' },
    { cle: 'sms_orange_from', label: 'Orange SMS API — Numéro expéditeur', suffix: '', type: 'text', hint: 'Numéro court fourni par Orange' },
    { cle: 'sms_at_username', label: "Africa's Talking — Username", suffix: '', type: 'text', hint: '' },
    { cle: 'sms_at_api_key', label: "Africa's Talking — API Key", suffix: '', type: 'password', hint: '' },
  ]},
  { section: '💬 WhatsApp — API Meta officielle', items: [
    { cle: 'whatsapp_provider', label: 'Fournisseur WhatsApp', suffix: '', type: 'text',
      hint: "meta pour activer (API WhatsApp Business officielle, remplit les champs ci-dessous) — vide/auto désactive le canal WhatsApp" },
    { cle: 'meta_whatsapp_phone_number_id', label: 'Meta — Phone Number ID', suffix: '', type: 'text', hint: 'Depuis developers.facebook.com → votre app → WhatsApp → API Setup' },
    { cle: 'meta_whatsapp_access_token', label: 'Meta — Access Token', suffix: '', type: 'password', hint: 'Token permanent généré via un utilisateur système (System User) dans Meta Business Manager — pas le token temporaire de 24h affiché par défaut' },
    { cle: 'meta_whatsapp_template_name', label: 'Meta — Nom du modèle de message', suffix: '', type: 'text', hint: 'Le modèle doit être créé et approuvé dans Meta Business Manager au préalable, avec UNE seule variable {{1}} dans le corps' },
    { cle: 'meta_whatsapp_template_lang', label: 'Meta — Code langue du modèle', suffix: '', type: 'text', hint: 'Ex: fr ou fr_FR — doit correspondre exactement à la langue choisie lors de la création du modèle' },
  ]},
  { section: '🗺️ Carte SIG — Icônes des points d\'intérêt', items: [
    { cle: 'icone_poi_restaurant',       label: 'Restaurant',              suffix: '', type: 'text', hint: 'Un seul emoji, ex: 🍽️' },
    { cle: 'icone_poi_bar',              label: 'Bar & Boutique',          suffix: '', type: 'text', hint: '' },
    { cle: 'icone_poi_sport',            label: 'Salle de sport',          suffix: '', type: 'text', hint: '' },
    { cle: 'icone_poi_terrain_sport',    label: 'Terrain de sport',        suffix: '', type: 'text', hint: '' },
    { cle: 'icone_poi_rampe',            label: 'Rampe / Héliport',        suffix: '', type: 'text', hint: '' },
    { cle: 'icone_poi_securite',         label: 'Sécurité',                suffix: '', type: 'text', hint: '' },
    { cle: 'icone_poi_guerite',          label: 'Guérite',                 suffix: '', type: 'text', hint: '' },
    { cle: 'icone_poi_infirmerie',       label: 'Infirmerie',              suffix: '', type: 'text', hint: '' },
    { cle: 'icone_poi_parking',          label: 'Parking',                 suffix: '', type: 'text', hint: '' },
    { cle: 'icone_poi_bureau',           label: 'Bureau / Administration', suffix: '', type: 'text', hint: '' },
    { cle: 'icone_poi_communautaire',    label: 'Bureau communautaire',    suffix: '', type: 'text', hint: '' },
    { cle: 'icone_poi_accueil',          label: "Bureau d'accueil",        suffix: '', type: 'text', hint: '' },
    { cle: 'icone_poi_reunion',          label: 'Salle de réunion',        suffix: '', type: 'text', hint: '' },
    { cle: 'icone_poi_serveur',          label: 'Salle serveur',           suffix: '', type: 'text', hint: '' },
    { cle: 'icone_poi_ats',              label: 'Bureau ATS',              suffix: '', type: 'text', hint: '' },
    { cle: 'icone_poi_toilette',         label: 'Toilette',                suffix: '', type: 'text', hint: '' },
    { cle: 'icone_poi_toilette_commune', label: 'Toilette commune',        suffix: '', type: 'text', hint: '' },
    { cle: 'icone_poi_loisirs',          label: 'Loisirs',                 suffix: '', type: 'text', hint: '' },
    { cle: 'icone_poi_autre',            label: 'Autre',                   suffix: '', type: 'text', hint: 'Catégorie par défaut si aucune ne correspond' },
  ]},
]

const LIENS_RAPIDES = [
  { to: '/boutique',        label: 'Menu du jour & Boutique', icon: '🍽️', desc: 'Articles, prix, stock' },
  { to: '/mon-compte',      label: 'Mon compte', icon: '👤', desc: 'Mot de passe, informations personnelles' },
]

const TABS = [
  ['general',    '⚙️ Général & SLA'],
  ['roles',      '👥 Rôles & Accès'],
  ['rapports-planifies', '📧 Rapports par email'],
  ['groupes-diffusion', '📢 Groupes de diffusion'],
  ['apparence',  '🎨 Apparence'],
  ['badges',     '🪪 Badges QR — Personnel'],
  ['induction',  '🎓 Induction du Camp'],
  ['catalogue',  '📦 Catalogue Boutique'],
  ['avis',       '⭐ Questions Avis Restauration'],
]

const inputStyle = (isAdmin) => ({
  width:'100%', border:'1px solid #e2e8f0', borderRadius:9,
  padding:'9px 12px', fontSize:13, outline:'none',
  background: isAdmin ? '#fff' : '#f8fafc',
  color: isAdmin ? '#1e293b' : '#94a3b8'
})

// Choisit noir ou blanc pour le texte selon la luminosite de la couleur de
// fond, pour que le texte reste toujours lisible quelle que soit la
// couleur choisie par l'admin (une couleur claire au hasard rendait le
// texte blanc fixe illisible).
function texteLisibleSur(hex) {
  if (!hex || !/^#[0-9a-f]{6}$/i.test(hex)) return '#fff'
  const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16)
  const luminance = (0.299*r + 0.587*g + 0.114*b) / 255
  return luminance > 0.6 ? '#0f172a' : '#fff'
}

export default function Parametrage() {
  const navigate = useNavigate()
  const { user } = useStore()
  const isAdmin = !!(user?.is_staff || user?.is_superuser)

  const [tab, setTab] = useState('general')
  const [valeurs, setValeurs] = useState({})
  const [descriptions, setDescriptions] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState(null)

  const charger = () => {
    setLoading(true)
    paramAPI.list()
      .then(r => {
        const v = {}, d = {}
        for (const p of r.data) { v[p.cle] = p.valeur; d[p.cle] = p.description }
        setValeurs(v); setDescriptions(d)
      })
      .catch(() => setMsg({ type:'error', text:'Impossible de charger les paramètres.' }))
      .finally(() => setLoading(false))
  }

  useEffect(charger, [])

  const handleChange = (cle, val) => setValeurs(v => ({ ...v, [cle]: val }))

  const sauvegarder = async (extra = {}) => {
    setSaving(true); setMsg(null)
    try {
      const fusion = { ...valeurs, ...extra }
      const liste = Object.entries(fusion).map(([cle, valeur]) => ({
        cle, valeur, description: descriptions[cle] || ''
      }))
      await paramAPI.save(liste)
      setValeurs(fusion)
      // Application immédiate (sans attendre un rechargement de page)
      if (fusion.theme_primaire) document.documentElement.style.setProperty('--rzc-navy', fusion.theme_primaire)
      if (fusion.theme_accent)   document.documentElement.style.setProperty('--rzc-ore-gold', fusion.theme_accent)
      setMsg({ type:'success', text:'✅ Paramètres enregistrés.' })
    } catch (e) {
      setMsg({ type:'error', text: e?.response?.data?.error || 'Échec de l\'enregistrement.' })
    } finally {
      setSaving(false)
      setTimeout(() => setMsg(null), 4000)
    }
  }

  if (loading) return <div style={{padding:40,textAlign:'center',color:'#94a3b8'}}>⏳ Chargement...</div>

  return (
    <div style={{ padding:20 }}>
      <h2 style={{ fontSize:20, fontWeight:700, marginBottom:4 }}>⚙️ Paramétrage</h2>
      <p style={{ fontSize:13, color:'#64748b', marginBottom:16 }}>
        Réglages centraux de l'application. {!isAdmin && "Lecture seule — réservé aux administrateurs pour la modification."}
      </p>

      <div style={{ display:'flex', gap:6, marginBottom:18, flexWrap:'wrap' }}>
        {TABS.map(([k,l]) => (
          <button key={k} onClick={()=>setTab(k)}
            style={{
              padding:'8px 16px', borderRadius:9, border:'none', cursor:'pointer',
              fontSize:12, fontWeight:700,
              background: tab===k ? 'var(--rzc-navy, #1E3A8A)' : '#e2e8f0',
              color: tab===k ? '#fff' : '#475569'
            }}>{l}</button>
        ))}
      </div>

      {msg && (
        <div style={{
          padding:'10px 14px', borderRadius:9, marginBottom:16, fontSize:13, fontWeight:600,
          background: msg.type==='success' ? 'rgba(22,163,74,.1)' : 'rgba(220,38,38,.1)',
          color: msg.type==='success' ? '#16a34a' : '#dc2626',
          border: `1px solid ${msg.type==='success' ? 'rgba(22,163,74,.25)' : 'rgba(220,38,38,.25)'}`
        }}>{msg.text}</div>
      )}

      {tab === 'general' && (
        <GeneralTab
          isAdmin={isAdmin} valeurs={valeurs} handleChange={handleChange}
          saving={saving} sauvegarder={sauvegarder} navigate={navigate}
        />
      )}

      {tab === 'roles' && (
        <RolesTab isAdmin={isAdmin} />
      )}

      {tab === 'rapports-planifies' && (
        <RapportsPlanifiesTab isAdmin={isAdmin} />
      )}

      {tab === 'groupes-diffusion' && (
        <GroupesDiffusionTab isAdmin={isAdmin} />
      )}

      {tab === 'apparence' && (
        <ApparenceTab isAdmin={isAdmin} valeurs={valeurs} sauvegarder={sauvegarder} saving={saving} />
      )}

      {tab === 'badges' && (
        <BadgesTab valeurs={valeurs} />
      )}

      {tab === 'induction' && (
        <div style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:12, padding:18 }}>
          <InductionAdmin />
        </div>
      )}

      {tab === 'catalogue' && (
        <div style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:12, padding:18 }}>
          <Boutique embedded />
        </div>
      )}

      {tab === 'avis' && <QuestionsAvisTab />}
    </div>
  )
}

const TYPES_QUESTION = [
  ['etoiles', '⭐ Note en étoiles (1-5)'],
  ['texte',   '💬 Texte libre'],
  ['oui_non', '✅ Oui / Non'],
  ['choix',   '🔘 Choix parmi une liste'],
]

function QuestionsAvisTab() {
  const [questions, setQuestions] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ label:'', type_question:'etoiles', options:[], ordre:0, actif:true, obligatoire:false })
  const [optionsText, setOptionsText] = useState('')

  const charger = () => {
    setLoading(true)
    questionsAvisAPI.list(false).then(r => setQuestions(r.data.results || r.data || [])).catch(() => setQuestions([])).finally(() => setLoading(false))
  }
  useEffect(charger, [])

  const ouvrirNouvelle = () => {
    setEditing(null)
    setForm({ label:'', type_question:'etoiles', options:[], ordre:questions.length+1, actif:true, obligatoire:false })
    setOptionsText('')
    setShowForm(true)
  }

  const ouvrirEdition = (q) => {
    setEditing(q)
    setForm({ label:q.label, type_question:q.type_question, options:q.options||[], ordre:q.ordre, actif:q.actif, obligatoire:q.obligatoire })
    setOptionsText((q.options||[]).join('\n'))
    setShowForm(true)
  }

  const enregistrer = async () => {
    if (!form.label.trim()) { toast.success('Le libellé de la question est requis.'); return }
    const payload = {
      ...form,
      options: form.type_question === 'choix' ? optionsText.split('\n').map(s=>s.trim()).filter(Boolean) : [],
    }
    try {
      if (editing) await questionsAvisAPI.update(editing.id, payload)
      else await questionsAvisAPI.create(payload)
      setShowForm(false)
      charger()
    } catch { toast.error("Erreur lors de l'enregistrement") }
  }

  const supprimer = async (id) => {
    if (!await confirmDialog('Supprimer cette question ? Les réponses déjà données seront conservées mais la question ne sera plus posée.')) return
    try { await questionsAvisAPI.delete(id); charger() } catch { toast.error('Erreur suppression') }
  }

  const toggleActif = async (q) => {
    try { await questionsAvisAPI.update(q.id, { actif: !q.actif }); charger() } catch { toast.error('Erreur') }
  }

  if (loading) return <div style={{textAlign:'center',padding:40,color:'#94a3b8'}}>⏳ Chargement...</div>

  return (
    <div style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:12, padding:18 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
        <div>
          <div style={{ fontSize:13, fontWeight:700, color:'#1e293b' }}>⭐ Questions du sondage repas</div>
          <div style={{ fontSize:12, color:'#64748b', marginTop:2 }}>
            Personnalisez entièrement le questionnaire affiché après un scan de repas — étoiles, texte libre, oui/non, ou choix multiple.
          </div>
        </div>
        <button onClick={ouvrirNouvelle}
          style={{ background:'var(--rzc-navy, #1E3A8A)', color:'#fff', border:'none', padding:'9px 16px', borderRadius:9, cursor:'pointer', fontSize:13, fontWeight:700, flexShrink:0 }}>
          ➕ Nouvelle question
        </button>
      </div>

      {questions.length === 0 ? (
        <div style={{ textAlign:'center', padding:30, color:'#94a3b8', fontSize:13 }}>
          Aucune question configurée — le formulaire retombe sur une note globale simple à 5 étoiles.
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {questions.sort((a,b)=>a.ordre-b.ordre).map(q => (
            <div key={q.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 12px',
              background:'#f8fafc', border:'1px solid #e2e8f0', borderRadius:9, opacity: q.actif?1:0.5 }}>
              <span style={{ fontSize:11, color:'#94a3b8', fontFamily:'monospace', width:20 }}>#{q.ordre}</span>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:13, fontWeight:600 }}>{q.label}{q.obligatoire && <span style={{color:'#dc2626'}}> *</span>}</div>
                <div style={{ fontSize:11, color:'#64748b' }}>{q.type_question_label}{q.type_question==='choix' && q.options?.length ? ` — ${q.options.join(', ')}` : ''}</div>
              </div>
              <button onClick={()=>toggleActif(q)}
                style={{ background: q.actif?'#dcfce7':'#f1f5f9', color: q.actif?'#16a34a':'#94a3b8', border:'none', padding:'5px 10px', borderRadius:7, cursor:'pointer', fontSize:11, fontWeight:700 }}>
                {q.actif ? 'Actif' : 'Inactif'}
              </button>
              <button onClick={()=>ouvrirEdition(q)}
                style={{ background:'#eff6ff', color:'#2563eb', border:'none', padding:'5px 10px', borderRadius:7, cursor:'pointer', fontSize:11, fontWeight:700 }}>
                ✏️
              </button>
              <button onClick={()=>supprimer(q.id)}
                style={{ background:'#fee2e2', color:'#dc2626', border:'none', padding:'5px 10px', borderRadius:7, cursor:'pointer', fontSize:11, fontWeight:700 }}>
                🗑️
              </button>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', zIndex:2000, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}
          onClick={e=>e.target===e.currentTarget && setShowForm(false)}>
          <div style={{ background:'#fff', borderRadius:14, width:'100%', maxWidth:420, overflow:'hidden' }}>
            <div style={{ background:'var(--rzc-navy, #1E3A8A)', color:'#fff', padding:'12px 16px', fontWeight:700 }}>
              {editing ? '✏️ Modifier la question' : '➕ Nouvelle question'}
            </div>
            <div style={{ padding:16, display:'flex', flexDirection:'column', gap:10 }}>
              <div>
                <label style={{ fontSize:11, fontWeight:700, color:'#64748b' }}>LIBELLÉ DE LA QUESTION</label>
                <input value={form.label} onChange={e=>setForm(f=>({...f,label:e.target.value}))}
                  placeholder="Ex: Que pensez-vous de la propreté des tables ?"
                  style={{ width:'100%', border:'1px solid #e2e8f0', borderRadius:8, padding:'9px 12px', fontSize:13, boxSizing:'border-box', marginTop:4 }}/>
              </div>
              <div>
                <label style={{ fontSize:11, fontWeight:700, color:'#64748b' }}>TYPE DE RÉPONSE</label>
                <select value={form.type_question} onChange={e=>setForm(f=>({...f,type_question:e.target.value}))}
                  style={{ width:'100%', border:'1px solid #e2e8f0', borderRadius:8, padding:'9px 12px', fontSize:13, marginTop:4 }}>
                  {TYPES_QUESTION.map(([v,l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              {form.type_question === 'choix' && (
                <div>
                  <label style={{ fontSize:11, fontWeight:700, color:'#64748b' }}>OPTIONS (une par ligne)</label>
                  <textarea value={optionsText} onChange={e=>setOptionsText(e.target.value)}
                    placeholder={"Excellent\nBon\nMoyen\nMauvais"}
                    style={{ width:'100%', border:'1px solid #e2e8f0', borderRadius:8, padding:'9px 12px', fontSize:13, boxSizing:'border-box', marginTop:4, minHeight:80 }}/>
                </div>
              )}
              <div style={{ display:'flex', gap:16 }}>
                <label style={{ display:'flex', alignItems:'center', gap:6, fontSize:12, cursor:'pointer' }}>
                  <input type="checkbox" checked={form.obligatoire} onChange={e=>setForm(f=>({...f,obligatoire:e.target.checked}))}/>
                  Réponse obligatoire
                </label>
                <label style={{ display:'flex', alignItems:'center', gap:6, fontSize:12, cursor:'pointer' }}>
                  <input type="checkbox" checked={form.actif} onChange={e=>setForm(f=>({...f,actif:e.target.checked}))}/>
                  Question active
                </label>
              </div>
              <div>
                <label style={{ fontSize:11, fontWeight:700, color:'#64748b' }}>ORDRE D'AFFICHAGE</label>
                <input type="number" value={form.ordre} onChange={e=>setForm(f=>({...f,ordre:Number(e.target.value)}))}
                  style={{ width:'100%', border:'1px solid #e2e8f0', borderRadius:8, padding:'9px 12px', fontSize:13, boxSizing:'border-box', marginTop:4 }}/>
              </div>
              <div style={{ display:'flex', gap:8, marginTop:6 }}>
                <button onClick={()=>setShowForm(false)}
                  style={{ flex:1, background:'#f1f5f9', color:'#64748b', border:'none', padding:10, borderRadius:9, cursor:'pointer', fontWeight:700 }}>
                  Annuler
                </button>
                <button onClick={enregistrer}
                  style={{ flex:1, background:'var(--rzc-navy, #1E3A8A)', color:'#fff', border:'none', padding:10, borderRadius:9, cursor:'pointer', fontWeight:700 }}>
                  💾 Enregistrer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function GeneralTab({ isAdmin, valeurs, handleChange, saving, sauvegarder, navigate }) {
  return (
    <>
      {CHAMPS.map(sec => (
        <div key={sec.section} style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:12, padding:18, marginBottom:16 }}>
          <div style={{ fontSize:13, fontWeight:700, color:'#1e293b', marginBottom:14 }}>{sec.section}</div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))', gap:14 }}>
            {sec.items.map(champ => (
              <div key={champ.cle}>
                <label style={{ display:'block', fontSize:11, fontWeight:700, color:'#64748b', marginBottom:4 }}>
                  {champ.label.toUpperCase()}
                </label>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <input
                    type={champ.type}
                    value={valeurs[champ.cle] ?? ''}
                    disabled={!isAdmin}
                    onChange={e => handleChange(champ.cle, e.target.value)}
                    style={inputStyle(isAdmin)}
                  />
                  {champ.suffix && <span style={{ fontSize:12, color:'#94a3b8', whiteSpace:'nowrap' }}>{champ.suffix}</span>}
                </div>
                {champ.hint && <div style={{ fontSize:11, color:'#94a3b8', marginTop:4 }}>{champ.hint}</div>}
              </div>
            ))}
          </div>
        </div>
      ))}

      {isAdmin && (
        <button onClick={()=>sauvegarder()} disabled={saving}
          style={{
            background:'var(--rzc-navy, #1E3A8A)', color:'#fff', border:'none',
            padding:'11px 22px', borderRadius:9, cursor: saving ? 'not-allowed' : 'pointer',
            fontSize:13, fontWeight:700, opacity: saving ? .6 : 1, marginBottom:24
          }}>
          {saving ? '⏳ Enregistrement...' : '💾 Enregistrer les paramètres'}
        </button>
      )}

      <div style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:12, padding:18 }}>
        <div style={{ fontSize:13, fontWeight:700, color:'#1e293b', marginBottom:12 }}>Autres réglages</div>
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {LIENS_RAPIDES.map(l => (
            <a key={l.to} href={l.to} onClick={(e)=>{e.preventDefault(); navigate(l.to)}}
              style={{
                display:'flex', alignItems:'center', gap:12, padding:'10px 12px',
                borderRadius:9, textDecoration:'none', background:'#f8fafc',
                border:'1px solid #e2e8f0', color:'#1e293b', cursor:'pointer'
              }}>
              <span style={{ fontSize:18 }}>{l.icon}</span>
              <div>
                <div style={{ fontSize:13, fontWeight:700 }}>{l.label}</div>
                <div style={{ fontSize:11, color:'#64748b' }}>{l.desc}</div>
              </div>
            </a>
          ))}
        </div>
      </div>
    </>
  )
}

// Liste des pages qu'un role NON-admin peut se voir attribuer. Exclut
// deliberement les pages sensibles (Parametrage, Audit, Diagnostic) qui
// restent reservees a l'admin quoi qu'il arrive, meme depuis cet ecran.
const PAGES_ASSIGNABLES = [
  ['/', '📊 Dashboard'], ['/carte', '🗺️ Carte GIS'], ['/mon-compte', '👤 Mon compte'],
  ['/personnel', '👤 Personnel'], ['/presences', '🟢 Présences'], ['/induction', '🎓 Induction QHSE'],
  ['/induction-camp', '🏕️ Induction Camp'], ['/epi', '🦺 Équipements EPI'], ['/annuaire', '📋 Annuaire'],
  ['/residences', '🏠 Résidences'], ['/rotations', '🧭 Centre de Mobilité'], ['/voyages', '✈️ Voyages'],
  ['/restauration', '🍽️ Restauration'], ['/boutique', '🛒 Bar & Boutique'], ['/reservations', '📅 Réservations'],
  ['/maintenance', '🛠️ Maintenance'], ['/evenements', '📡 Événements'], ['/demandes', '📝 Demandes'],
  ['/analytics', '📈 Analytics'], ['/rapports', '📄 Rapports'], ['/historique', '📋 Historique'],
]

function RolesTab({ isAdmin }) {
  const [roles, setRoles] = useState([])
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState(null)
  const [nouveauCode, setNouveauCode] = useState('')
  const [nouveauLabel, setNouveauLabel] = useState('')
  const [creating, setCreating] = useState(false)

  const charger = () => {
    setLoading(true)
    rolesAPI.list().then(r => setRoles(r.data.results || r.data || [])).finally(()=>setLoading(false))
  }
  useEffect(charger, [])

  const toggle = (role, path) => {
    const next = role.menu_pages.includes(path)
      ? role.menu_pages.filter(p => p !== path)
      : [...role.menu_pages, path]
    // Retirer une page de menu_pages doit aussi la retirer de
    // pages_readonly - sinon un reglage "lecture seule" orphelin reste en
    // base pour une page que le role ne voit plus.
    const nextRO = role.pages_readonly.includes(path) && !next.includes(path)
      ? role.pages_readonly.filter(p => p !== path)
      : role.pages_readonly
    setRoles(rs => rs.map(r => r.id === role.id ? {...r, menu_pages: next, pages_readonly: nextRO} : r))
  }
  const toggleEcriture = (role, path) => {
    // Coche = peut modifier (ecriture) = PAS dans pages_readonly.
    // Decoche = lecture seule sur CETTE page precisement, les autres
    // pages du role ne sont pas affectees.
    const next = role.pages_readonly.includes(path)
      ? role.pages_readonly.filter(p => p !== path)
      : [...role.pages_readonly, path]
    setRoles(rs => rs.map(r => r.id === role.id ? {...r, pages_readonly: next} : r))
  }
  const enregistrerRole = async (role) => {
    setSavingId(role.id)
    try {
      await rolesAPI.update(role.id, { menu_pages: role.menu_pages, pages_readonly: role.pages_readonly })
      toast.success(`Accès de "${role.label}" enregistrés.`)
    } catch(e) { toast.error(e.response?.data?.error || 'Erreur') }
    setSavingId(null)
  }
  const supprimerRole = async (role) => {
    if (!await confirmDialog(`Supprimer le rôle "${role.label}" ? Les comptes concernés repasseront automatiquement en "Agent Terrain".`)) return
    try {
      const r = await rolesAPI.delete(role.id)
      const n = r.data?.comptes_reassignes_vers_agent || 0
      toast.success(`Rôle supprimé.${n > 0 ? ` ${n} compte(s) réaffecté(s) à Agent Terrain.` : ''}`)
      charger()
    } catch(e) { toast.error(e.response?.data?.error || 'Erreur') }
  }
  const creerRole = async () => {
    const code = nouveauCode.trim().toLowerCase().replace(/\s+/g,'_')
    if (!code || !nouveauLabel.trim()) { toast.error('Code et libellé requis.'); return }
    setCreating(true)
    try {
      await rolesAPI.create({ code, label: nouveauLabel.trim(), menu_pages: [] })
      toast.success(`Rôle "${nouveauLabel}" créé — cochez ses pages ci-dessous puis enregistrez.`)
      setNouveauCode(''); setNouveauLabel('')
      charger()
    } catch(e) { toast.error(e.response?.data?.error || 'Erreur') }
    setCreating(false)
  }

  if (loading) return <div style={{padding:20,textAlign:'center',color:'#94a3b8'}}>⏳ Chargement des rôles...</div>

  return (
    <div style={{display:'flex',flexDirection:'column',gap:24}}>
      <div style={{background:'#eff6ff',border:'1px solid #bfdbfe',borderRadius:10,padding:'12px 16px',fontSize:12.5,color:'#1e40af'}}>
        ℹ️ L'administrateur garde toujours accès à toutes les pages, quels que soient les réglages ci-dessous. Ceci ne configure que ce que voient les autres rôles.
      </div>

      {isAdmin && (
        <div style={{border:'1px dashed #C9972B',borderRadius:12,padding:16,background:'#fffbeb'}}>
          <div style={{fontWeight:700,fontSize:14,color:'#92400e',marginBottom:10}}>➕ Créer un nouveau rôle</div>
          <div style={{display:'flex',gap:10,flexWrap:'wrap',alignItems:'center'}}>
            <input value={nouveauLabel} onChange={e=>setNouveauLabel(e.target.value)} placeholder="Nom affiché (ex: Chef d'équipe)"
              style={{flex:'1 1 220px',border:'1px solid #e2e8f0',borderRadius:8,padding:'8px 12px',fontSize:13}}/>
            <input value={nouveauCode} onChange={e=>setNouveauCode(e.target.value)} placeholder="code_technique (ex: chef_equipe)"
              style={{flex:'1 1 200px',border:'1px solid #e2e8f0',borderRadius:8,padding:'8px 12px',fontSize:13,fontFamily:'monospace'}}/>
            <button onClick={creerRole} disabled={creating}
              style={{background:'#C9972B',color:'#fff',border:'none',padding:'9px 18px',borderRadius:8,
                cursor:creating?'not-allowed':'pointer',fontSize:13,fontWeight:700}}>
              {creating ? '⏳...' : 'Créer'}
            </button>
          </div>
        </div>
      )}

      {roles.map(role => (
        <div key={role.id} style={{border:'1px solid #e2e8f0',borderRadius:12,padding:16, opacity: role.est_systeme ? .7 : 1}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10,flexWrap:'wrap',gap:8}}>
            <div style={{fontWeight:700,fontSize:14,color:'#0f172a'}}>
              {role.label} {role.est_systeme && <span style={{fontSize:11,color:'#94a3b8',fontWeight:400}}>(rôle système, protégé)</span>}
            </div>
            {!role.est_systeme && (
              <div style={{display:'flex',alignItems:'center',gap:14}}>
                {isAdmin && (
                  <button onClick={()=>supprimerRole(role)}
                    style={{background:'#fef2f2',color:'#dc2626',border:'1px solid #fecaca',padding:'5px 10px',
                      borderRadius:7,cursor:'pointer',fontSize:11,fontWeight:700}}>
                    🗑️ Supprimer
                  </button>
                )}
              </div>
            )}
          </div>
          {!role.est_systeme && (
            <>
              <div style={{fontSize:10,color:'#94a3b8',marginBottom:6,textTransform:'uppercase',letterSpacing:.5}}>
                Voir la page · Modifier (créer/éditer/supprimer)
              </div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(230px,1fr))',gap:8,marginBottom:12}}>
                {PAGES_ASSIGNABLES.map(([path, lbl]) => {
                  const voitPage = role.menu_pages.includes(path)
                  const peutEcrire = voitPage && !role.pages_readonly.includes(path)
                  return (
                    <div key={path} style={{display:'flex',alignItems:'center',gap:10,fontSize:12.5,
                      color: isAdmin ? '#334155' : '#94a3b8', opacity: voitPage ? 1 : .55}}>
                      <label style={{display:'flex',alignItems:'center',gap:5,cursor: isAdmin ? 'pointer' : 'not-allowed'}} title="Voir cette page">
                        <input type="checkbox" disabled={!isAdmin} checked={voitPage}
                          onChange={()=>toggle(role, path)} style={{cursor: isAdmin ? 'pointer' : 'not-allowed'}}/>
                        {lbl}
                      </label>
                      <label style={{display:'flex',alignItems:'center',gap:4,cursor: (isAdmin&&voitPage) ? 'pointer' : 'not-allowed',
                        fontSize:11,color: peutEcrire ? '#16a34a' : '#94a3b8'}} title="Peut créer / modifier / supprimer sur cette page">
                        <input type="checkbox" disabled={!isAdmin||!voitPage} checked={peutEcrire}
                          onChange={()=>toggleEcriture(role, path)} style={{cursor: (isAdmin&&voitPage) ? 'pointer' : 'not-allowed'}}/>
                        ✏️
                      </label>
                    </div>
                  )
                })}
              </div>
              {isAdmin && (
                <button onClick={()=>enregistrerRole(role)} disabled={savingId===role.id}
                  style={{background:'var(--rzc-navy,#0F2A5C)',color:'#fff',border:'none',padding:'7px 16px',
                    borderRadius:8,cursor:savingId===role.id?'not-allowed':'pointer',fontSize:12,fontWeight:700}}>
                  {savingId===role.id ? '⏳...' : '💾 Enregistrer ce rôle'}
                </button>
              )}
            </>
          )}
        </div>
      ))}
    </div>
  )
}

const JOURS_SEMAINE_OPTS = [
  [0,'Lundi'],[1,'Mardi'],[2,'Mercredi'],[3,'Jeudi'],[4,'Vendredi'],[5,'Samedi'],[6,'Dimanche'],
]

function RapportsPlanifiesTab({ isAdmin }) {
  const [liste, setListe] = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ nom:'', frequence:'hebdomadaire', jour_semaine:0, jour_mois:1, heure:'07:00', destinataires:'' })
  const [creating, setCreating] = useState(false)

  const charger = () => {
    setLoading(true)
    rapportsPlanifiesAPI.list().then(r => setListe(r.data.results || r.data || [])).finally(()=>setLoading(false))
  }
  useEffect(charger, [])

  const creer = async () => {
    const destinataires = form.destinataires.split(',').map(e=>e.trim()).filter(Boolean)
    if (!form.nom.trim() || destinataires.length===0) { toast.error('Nom et au moins un destinataire requis.'); return }
    setCreating(true)
    try {
      await rapportsPlanifiesAPI.create({
        nom: form.nom.trim(), frequence: form.frequence, heure: form.heure, destinataires,
        jour_semaine: form.frequence==='hebdomadaire' ? form.jour_semaine : null,
        jour_mois: form.frequence==='mensuel' ? form.jour_mois : null,
      })
      toast.success('Rapport planifié créé.')
      setForm({ nom:'', frequence:'hebdomadaire', jour_semaine:0, jour_mois:1, heure:'07:00', destinataires:'' })
      charger()
    } catch(e) { toast.error(e.response?.data?.error || JSON.stringify(e.response?.data||{}) || 'Erreur') }
    setCreating(false)
  }
  const toggleActif = async (r) => {
    try {
      await rapportsPlanifiesAPI.update(r.id, { actif: !r.actif })
      charger()
    } catch(e) { toast.error('Erreur') }
  }
  const supprimer = async (r) => {
    if (!await confirmDialog(`Supprimer le rapport planifié "${r.nom}" ?`)) return
    try { await rapportsPlanifiesAPI.delete(r.id); toast.success('Supprimé.'); charger() }
    catch(e) { toast.error('Erreur') }
  }

  if (loading) return <div style={{padding:20,textAlign:'center',color:'#94a3b8'}}>⏳ Chargement...</div>

  return (
    <div style={{display:'flex',flexDirection:'column',gap:20}}>
      <div style={{background:'#eff6ff',border:'1px solid #bfdbfe',borderRadius:10,padding:'12px 16px',fontSize:12.5,color:'#1e40af'}}>
        ℹ️ Un résumé (chambres occupées, incidents ouverts, départs du jour, stock critique) est envoyé automatiquement par email aux destinataires configurés, à l'heure choisie. Nécessite qu'une tâche planifiée (cron) tourne sur le serveur — voir la documentation de déploiement.
      </div>

      {isAdmin && (
        <div style={{border:'1px dashed #C9972B',borderRadius:12,padding:16,background:'#fffbeb'}}>
          <div style={{fontWeight:700,fontSize:14,color:'#92400e',marginBottom:10}}>➕ Nouveau rapport planifié</div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))',gap:10,marginBottom:10}}>
            <input value={form.nom} onChange={e=>setForm(f=>({...f,nom:e.target.value}))} placeholder="Nom (ex: Rapport direction)"
              style={{border:'1px solid #e2e8f0',borderRadius:8,padding:'8px 12px',fontSize:13}}/>
            <select value={form.frequence} onChange={e=>setForm(f=>({...f,frequence:e.target.value}))}
              style={{border:'1px solid #e2e8f0',borderRadius:8,padding:'8px 12px',fontSize:13}}>
              <option value="quotidien">Quotidien</option>
              <option value="hebdomadaire">Hebdomadaire</option>
              <option value="mensuel">Mensuel</option>
            </select>
            {form.frequence==='hebdomadaire' && (
              <select value={form.jour_semaine} onChange={e=>setForm(f=>({...f,jour_semaine:Number(e.target.value)}))}
                style={{border:'1px solid #e2e8f0',borderRadius:8,padding:'8px 12px',fontSize:13}}>
                {JOURS_SEMAINE_OPTS.map(([v,l])=><option key={v} value={v}>{l}</option>)}
              </select>
            )}
            {form.frequence==='mensuel' && (
              <input type="number" min={1} max={28} value={form.jour_mois} onChange={e=>setForm(f=>({...f,jour_mois:Number(e.target.value)}))}
                placeholder="Jour du mois (1-28)" style={{border:'1px solid #e2e8f0',borderRadius:8,padding:'8px 12px',fontSize:13}}/>
            )}
            <input type="time" value={form.heure} onChange={e=>setForm(f=>({...f,heure:e.target.value}))}
              style={{border:'1px solid #e2e8f0',borderRadius:8,padding:'8px 12px',fontSize:13}}/>
          </div>
          <input value={form.destinataires} onChange={e=>setForm(f=>({...f,destinataires:e.target.value}))}
            placeholder="Emails séparés par virgules (ex: direction@roxgold.com, rh@roxgold.com)"
            style={{width:'100%',boxSizing:'border-box',border:'1px solid #e2e8f0',borderRadius:8,padding:'8px 12px',fontSize:13,marginBottom:10}}/>
          <button onClick={creer} disabled={creating}
            style={{background:'#C9972B',color:'#fff',border:'none',padding:'9px 18px',borderRadius:8,
              cursor:creating?'not-allowed':'pointer',fontSize:13,fontWeight:700}}>
            {creating ? '⏳...' : 'Créer'}
          </button>
        </div>
      )}

      {liste.length === 0 && <div style={{color:'#94a3b8',fontSize:13,textAlign:'center',padding:20}}>Aucun rapport planifié pour l'instant.</div>}

      {liste.map(r => (
        <div key={r.id} style={{border:'1px solid #e2e8f0',borderRadius:12,padding:16,display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:10}}>
          <div>
            <div style={{fontWeight:700,fontSize:14,color:'#0f172a'}}>{r.nom}</div>
            <div style={{fontSize:12,color:'#64748b',marginTop:3}}>
              {r.frequence_label} à {r.heure?.slice(0,5)}
              {r.frequence==='hebdomadaire' && r.jour_semaine!=null && ` · ${JOURS_SEMAINE_OPTS.find(j=>j[0]===r.jour_semaine)?.[1]}`}
              {r.frequence==='mensuel' && r.jour_mois && ` · le ${r.jour_mois}`}
            </div>
            <div style={{fontSize:11.5,color:'#94a3b8',marginTop:3}}>📧 {r.destinataires?.join(', ')}</div>
            {r.derniere_execution && <div style={{fontSize:11,color:'#94a3b8',marginTop:2}}>Dernier envoi : {new Date(r.derniere_execution).toLocaleString('fr-FR')}</div>}
          </div>
          {isAdmin && (
            <div style={{display:'flex',gap:8,alignItems:'center'}}>
              <label style={{display:'flex',alignItems:'center',gap:6,fontSize:12,fontWeight:600,color:r.actif?'#16a34a':'#94a3b8',cursor:'pointer'}}>
                <input type="checkbox" checked={r.actif} onChange={()=>toggleActif(r)}/>
                Actif
              </label>
              <button onClick={()=>supprimer(r)}
                style={{background:'#fef2f2',color:'#dc2626',border:'1px solid #fecaca',padding:'5px 10px',borderRadius:7,cursor:'pointer',fontSize:11,fontWeight:700}}>
                🗑️
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function GroupesDiffusionTab({ isAdmin }) {
  const [liste, setListe] = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ nom:'', description:'', uniquement_residents_actifs:false, filtre_societe:'', filtre_type_personnel:'', est_defaut:false })
  const [creating, setCreating] = useState(false)

  const charger = () => {
    setLoading(true)
    groupesDiffusionAPI.list().then(r => setListe(r.data.results || r.data || [])).finally(()=>setLoading(false))
  }
  useEffect(charger, [])

  const creer = async () => {
    if (!form.nom.trim()) { toast.error('Nom requis.'); return }
    setCreating(true)
    try {
      await groupesDiffusionAPI.create(form)
      toast.success('Groupe de diffusion créé.')
      setForm({ nom:'', description:'', uniquement_residents_actifs:false, filtre_societe:'', filtre_type_personnel:'', est_defaut:false })
      charger()
    } catch(e) { toast.error(e.response?.data?.error || JSON.stringify(e.response?.data||{}) || 'Erreur') }
    setCreating(false)
  }
  const supprimer = async (g) => {
    if (!await confirmDialog(`Supprimer le groupe "${g.nom}" ? Les évènements qui l'utilisaient repasseront au comportement par défaut.`)) return
    try { await groupesDiffusionAPI.delete(g.id); toast.success('Supprimé.'); charger() }
    catch(e) { toast.error('Erreur') }
  }
  const definirDefaut = async (g) => {
    try { await groupesDiffusionAPI.update(g.id, { est_defaut: true }); charger() }
    catch(e) { toast.error('Erreur') }
  }

  if (loading) return <div style={{padding:20,textAlign:'center',color:'#94a3b8'}}>⏳ Chargement...</div>

  return (
    <div style={{display:'flex',flexDirection:'column',gap:20}}>
      <div style={{background:'#eff6ff',border:'1px solid #bfdbfe',borderRadius:10,padding:'12px 16px',fontSize:12.5,color:'#1e40af'}}>
        ℹ️ Détermine qui reçoit la notification d'un évènement (ex: "Résidents actifs", "Employés Roxgold uniquement", "Tout le personnel"). Choisi ensuite lors de la création de chaque évènement, dans Événements.
      </div>

      {isAdmin && (
        <div style={{border:'1px dashed #C9972B',borderRadius:12,padding:16,background:'#fffbeb'}}>
          <div style={{fontWeight:700,fontSize:14,color:'#92400e',marginBottom:10}}>➕ Nouveau groupe de diffusion</div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))',gap:10,marginBottom:10}}>
            <input value={form.nom} onChange={e=>setForm(f=>({...f,nom:e.target.value}))} placeholder="Nom (ex: Employés Roxgold)"
              style={{border:'1px solid #e2e8f0',borderRadius:8,padding:'8px 12px',fontSize:13}}/>
            <input value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))} placeholder="Description (optionnel)"
              style={{border:'1px solid #e2e8f0',borderRadius:8,padding:'8px 12px',fontSize:13}}/>
            <input value={form.filtre_societe} onChange={e=>setForm(f=>({...f,filtre_societe:e.target.value}))} placeholder="Filtrer par société (ex: ROXGOLD)"
              style={{border:'1px solid #e2e8f0',borderRadius:8,padding:'8px 12px',fontSize:13}}/>
            <select value={form.filtre_type_personnel} onChange={e=>setForm(f=>({...f,filtre_type_personnel:e.target.value}))}
              style={{border:'1px solid #e2e8f0',borderRadius:8,padding:'8px 12px',fontSize:13}}>
              <option value="">Tous types de personnel</option>
              <option value="roxgold">Employé Roxgold</option>
              <option value="sous_traitant">Sous-traitant</option>
              <option value="visiteur">Visiteur</option>
            </select>
          </div>
          <label style={{display:'flex',alignItems:'center',gap:7,fontSize:12.5,marginBottom:10,cursor:'pointer'}}>
            <input type="checkbox" checked={form.uniquement_residents_actifs} onChange={e=>setForm(f=>({...f,uniquement_residents_actifs:e.target.checked}))}/>
            Seulement les personnes actuellement logées dans une chambre occupée
          </label>
          <button onClick={creer} disabled={creating}
            style={{background:'#C9972B',color:'#fff',border:'none',padding:'9px 18px',borderRadius:8,
              cursor:creating?'not-allowed':'pointer',fontSize:13,fontWeight:700}}>
            {creating ? '⏳...' : 'Créer'}
          </button>
        </div>
      )}

      {liste.map(g => (
        <div key={g.id} style={{border:'1px solid #e2e8f0',borderRadius:12,padding:16,display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:10}}>
          <div>
            <div style={{fontWeight:700,fontSize:14,color:'#0f172a',display:'flex',alignItems:'center',gap:8}}>
              {g.nom}
              {g.est_defaut && <span style={{fontSize:10,background:'#dcfce7',color:'#15803d',padding:'2px 8px',borderRadius:20,fontWeight:700}}>PAR DÉFAUT</span>}
            </div>
            {g.description && <div style={{fontSize:12,color:'#64748b',marginTop:2}}>{g.description}</div>}
            <div style={{fontSize:11,color:'#94a3b8',marginTop:4}}>
              👥 {g.nb_personnes} personne(s) actuellement ciblée(s)
              {g.filtre_societe && ` · Société: ${g.filtre_societe}`}
              {g.filtre_type_personnel && ` · Type: ${g.filtre_type_personnel}`}
              {g.uniquement_residents_actifs && ` · Résidents actifs uniquement`}
            </div>
          </div>
          {isAdmin && (
            <div style={{display:'flex',gap:8}}>
              {!g.est_defaut && (
                <button onClick={()=>definirDefaut(g)} style={{background:'#f8fafc',color:'#475569',border:'1px solid #e2e8f0',padding:'6px 12px',borderRadius:7,cursor:'pointer',fontSize:11,fontWeight:700}}>
                  Définir par défaut
                </button>
              )}
              <button onClick={()=>supprimer(g)} style={{background:'#fef2f2',color:'#dc2626',border:'1px solid #fecaca',padding:'6px 12px',borderRadius:7,cursor:'pointer',fontSize:11,fontWeight:700}}>
                🗑️ Supprimer
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function ApparenceTab({ isAdmin, valeurs, sauvegarder, saving }) {
  const setLogoUrl = useStore(s => s.setLogoUrl)
  const [primaire, setPrimaire] = useState(valeurs.theme_primaire || '#0F2A5C')
  const [accent,   setAccent]   = useState(valeurs.theme_accent   || '#C9972B')
  const [succes,   setSucces]   = useState(valeurs.theme_succes   || '#16A34A')
  const [danger,   setDanger]   = useState(valeurs.theme_danger   || '#DC2626')
  const [info,     setInfo]     = useState(valeurs.theme_info     || '#2563EB')
  const [police,   setPolice]   = useState(valeurs.theme_police   || 'IBM Plex Sans')
  const [fondInduction, setFondInduction] = useState(valeurs.theme_fond_induction || '#0F2A5C')
  const [fondApp, setFondApp] = useState(valeurs.theme_fond_app || '#f1f5f9')
  const [logoPreview, setLogoPreview] = useState(
    valeurs.logo_base64 ? `data:${valeurs.logo_mime||'image/png'};base64,${valeurs.logo_base64}` : null
  )
  const [logoBase64, setLogoBase64] = useState(valeurs.logo_base64 || '')
  const [logoMime, setLogoMime] = useState(valeurs.logo_mime || '')
  const [jmpLogoPreview, setJmpLogoPreview] = useState(
    valeurs.jmp_logo_base64 ? `data:${valeurs.jmp_logo_mime||'image/jpeg'};base64,${valeurs.jmp_logo_base64}` : null
  )
  const [jmpLogoBase64, setJmpLogoBase64] = useState('')
  const [jmpLogoMime, setJmpLogoMime] = useState('')
  const fileRef = useRef(null)

  const onLogoChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 1.5 * 1024 * 1024) {
      toast.success('Le logo doit faire moins de 1,5 Mo. Compressez l\'image avant de l\'importer.')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result
      const base64 = dataUrl.split(',')[1]
      setLogoPreview(dataUrl)
      setLogoBase64(base64)
      setLogoMime(file.type)
    }
    reader.readAsDataURL(file)
  }

  const appliquerCouleurs = async () => {
    await sauvegarder({
      theme_primaire: primaire, theme_accent: accent,
      theme_succes: succes, theme_danger: danger, theme_info: info,
      theme_police: police, theme_fond_induction: fondInduction, theme_fond_app: fondApp,
    })
    // Application immédiate (pas besoin de recharger la page pour voir le résultat)
    const root = document.documentElement.style
    root.setProperty('--rzc-navy', primaire)
    root.setProperty('--rzc-ore-gold', accent)
    root.setProperty('--rzc-green', succes)
    root.setProperty('--rzc-red', danger)
    root.setProperty('--rzc-blue', info)
    root.setProperty('--rzc-font', `'${police}', system-ui, sans-serif`)
    root.setProperty('--rzc-fond-induction', fondInduction)
    root.setProperty('--rzc-fond-app', fondApp)
  }

  const appliquerLogo = async () => {
    await sauvegarder({ logo_base64: logoBase64, logo_mime: logoMime })
    if (logoBase64) setLogoUrl(`data:${logoMime};base64,${logoBase64}`)
  }

  const reinitialiserLogo = async () => {
    setLogoPreview(null); setLogoBase64(''); setLogoMime('')
    await sauvegarder({ logo_base64: '', logo_mime: '' })
    setLogoUrl(null)
  }

  const onJmpLogoChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 1.5 * 1024 * 1024) {
      toast.success('Le logo doit faire moins de 1,5 Mo. Compressez l\'image avant de l\'importer.')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result
      setJmpLogoPreview(dataUrl)
      setJmpLogoBase64(dataUrl.split(',')[1])
      setJmpLogoMime(file.type)
    }
    reader.readAsDataURL(file)
  }
  const appliquerJmpLogo = async () => {
    await sauvegarder({ jmp_logo_base64: jmpLogoBase64, jmp_logo_mime: jmpLogoMime })
  }

  return (
    <>
      <div style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:12, padding:18, marginBottom:16 }}>
        <div style={{ fontSize:13, fontWeight:700, color:'#1e293b', marginBottom:4 }}>🎨 Couleurs de l'application</div>
        <div style={{ fontSize:12, color:'#64748b', marginBottom:14 }}>
          S'applique immédiatement à toutes les pages (headers, boutons, accents actifs).
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))', gap:20 }}>
          <div>
            <label style={{ display:'block', fontSize:11, fontWeight:700, color:'#64748b', marginBottom:6 }}>COULEUR PRIMAIRE</label>
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <input type="color" value={primaire} disabled={!isAdmin}
                onChange={e=>setPrimaire(e.target.value)}
                style={{ width:44, height:36, border:'1px solid #e2e8f0', borderRadius:8, cursor: isAdmin?'pointer':'default', padding:2 }}/>
              <input type="text" value={primaire} disabled={!isAdmin}
                onChange={e=>setPrimaire(e.target.value)} style={{...inputStyle(isAdmin), fontFamily:'monospace'}}/>
            </div>
          </div>
          <div>
            <label style={{ display:'block', fontSize:11, fontWeight:700, color:'#64748b', marginBottom:6 }}>COULEUR ACCENT</label>
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <input type="color" value={accent} disabled={!isAdmin}
                onChange={e=>setAccent(e.target.value)}
                style={{ width:44, height:36, border:'1px solid #e2e8f0', borderRadius:8, cursor: isAdmin?'pointer':'default', padding:2 }}/>
              <input type="text" value={accent} disabled={!isAdmin}
                onChange={e=>setAccent(e.target.value)} style={{...inputStyle(isAdmin), fontFamily:'monospace'}}/>
            </div>
          </div>

          <div>
            <label style={{ display:'block', fontSize:11, fontWeight:700, color:'#64748b', marginBottom:6 }}>COULEUR SUCCÈS (statuts libre / OK)</label>
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <input type="color" value={succes} disabled={!isAdmin}
                onChange={e=>setSucces(e.target.value)}
                style={{ width:44, height:36, border:'1px solid #e2e8f0', borderRadius:8, cursor: isAdmin?'pointer':'default', padding:2 }}/>
              <input type="text" value={succes} disabled={!isAdmin}
                onChange={e=>setSucces(e.target.value)} style={{...inputStyle(isAdmin), fontFamily:'monospace'}}/>
            </div>
          </div>

          <div>
            <label style={{ display:'block', fontSize:11, fontWeight:700, color:'#64748b', marginBottom:6 }}>COULEUR DANGER (statuts occupé / critique)</label>
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <input type="color" value={danger} disabled={!isAdmin}
                onChange={e=>setDanger(e.target.value)}
                style={{ width:44, height:36, border:'1px solid #e2e8f0', borderRadius:8, cursor: isAdmin?'pointer':'default', padding:2 }}/>
              <input type="text" value={danger} disabled={!isAdmin}
                onChange={e=>setDanger(e.target.value)} style={{...inputStyle(isAdmin), fontFamily:'monospace'}}/>
            </div>
          </div>

          <div>
            <label style={{ display:'block', fontSize:11, fontWeight:700, color:'#64748b', marginBottom:6 }}>COULEUR INFO (statuts réservé)</label>
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <input type="color" value={info} disabled={!isAdmin}
                onChange={e=>setInfo(e.target.value)}
                style={{ width:44, height:36, border:'1px solid #e2e8f0', borderRadius:8, cursor: isAdmin?'pointer':'default', padding:2 }}/>
              <input type="text" value={info} disabled={!isAdmin}
                onChange={e=>setInfo(e.target.value)} style={{...inputStyle(isAdmin), fontFamily:'monospace'}}/>
            </div>
          </div>

          <div>
            <label style={{ display:'block', fontSize:11, fontWeight:700, color:'#64748b', marginBottom:6 }}>POLICE DE CARACTÈRES</label>
            <select value={police} disabled={!isAdmin} onChange={e=>setPolice(e.target.value)}
              style={{...inputStyle(isAdmin), fontFamily:police}}>
              <option value="IBM Plex Sans">IBM Plex Sans (par défaut)</option>
              <option value="Inter">Inter</option>
              <option value="Roboto">Roboto</option>
              <option value="Poppins">Poppins</option>
              <option value="system-ui">Système (par défaut de l'appareil)</option>
            </select>
          </div>

          <div>
            <label style={{ display:'block', fontSize:11, fontWeight:700, color:'#64748b', marginBottom:6 }}>FOND DES PAGES INDUCTION</label>
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <input type="color" value={fondInduction} disabled={!isAdmin}
                onChange={e=>setFondInduction(e.target.value)}
                style={{ width:44, height:36, border:'1px solid #e2e8f0', borderRadius:8, cursor: isAdmin?'pointer':'default', padding:2 }}/>
              <input type="text" value={fondInduction} disabled={!isAdmin}
                onChange={e=>setFondInduction(e.target.value)} style={{...inputStyle(isAdmin), fontFamily:'monospace'}}/>
            </div>
          </div>

          <div>
            <label style={{ display:'block', fontSize:11, fontWeight:700, color:'#64748b', marginBottom:6 }}>FOND DE TOUTES LES AUTRES PAGES</label>
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <input type="color" value={fondApp} disabled={!isAdmin}
                onChange={e=>setFondApp(e.target.value)}
                style={{ width:44, height:36, border:'1px solid #e2e8f0', borderRadius:8, cursor: isAdmin?'pointer':'default', padding:2 }}/>
              <input type="text" value={fondApp} disabled={!isAdmin}
                onChange={e=>setFondApp(e.target.value)} style={{...inputStyle(isAdmin), fontFamily:'monospace'}}/>
            </div>
          </div>
        </div>

        <div style={{ display:'flex', gap:10, marginTop:16, alignItems:'center', flexWrap:'wrap' }}>
          <div style={{ padding:'10px 16px', borderRadius:9, background:primaire, color:texteLisibleSur(primaire), fontSize:12, fontWeight:700 }}>Aperçu primaire</div>
          <div style={{ padding:'10px 16px', borderRadius:9, background:accent, color:texteLisibleSur(accent), fontSize:12, fontWeight:700 }}>Aperçu accent</div>
          <div style={{ padding:'10px 16px', borderRadius:9, background:succes, color:texteLisibleSur(succes), fontSize:12, fontWeight:700 }}>Succès</div>
          <div style={{ padding:'10px 16px', borderRadius:9, background:danger, color:texteLisibleSur(danger), fontSize:12, fontWeight:700 }}>Danger</div>
          <div style={{ padding:'10px 16px', borderRadius:9, background:info, color:texteLisibleSur(info), fontSize:12, fontWeight:700 }}>Info</div>
          <div style={{ padding:'10px 16px', borderRadius:9, background:`linear-gradient(135deg,${fondInduction},color-mix(in srgb, ${fondInduction} 65%, white))`, color:texteLisibleSur(fondInduction), fontSize:12, fontWeight:700 }}>Fond Induction</div>
          <div style={{ padding:'10px 16px', borderRadius:9, background:fondApp, color:texteLisibleSur(fondApp), border:'1px solid #e2e8f0', fontSize:12, fontWeight:700 }}>Fond des pages</div>
        </div>

        {isAdmin && (
          <button onClick={appliquerCouleurs} disabled={saving}
            style={{ marginTop:16, background:'var(--rzc-navy, #1E3A8A)', color:'#fff', border:'none',
              padding:'10px 20px', borderRadius:9, cursor: saving?'not-allowed':'pointer', fontSize:13, fontWeight:700, opacity: saving?.6:1 }}>
            {saving ? '⏳ Application...' : '🎨 Appliquer les couleurs'}
          </button>
        )}
      </div>

      <div style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:12, padding:18 }}>
        <div style={{ fontSize:13, fontWeight:700, color:'#1e293b', marginBottom:4 }}>🖼️ Logo</div>
        <div style={{ fontSize:12, color:'#64748b', marginBottom:14 }}>
          Remplace le logo affiché en haut à gauche de l'application. PNG/JPG recommandé, fond transparent, moins de 1,5 Mo.
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:20 }}>
          <div style={{ width:100, height:70, borderRadius:10, background:'#f8fafc', border:'1px dashed #cbd5e1', display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden' }}>
            {logoPreview
              ? <img src={logoPreview} alt="Logo" style={{ maxWidth:'90%', maxHeight:'90%', objectFit:'contain' }}/>
              : <img src="/roxgold-logo.png" alt="Logo par défaut" style={{ maxWidth:'80%', maxHeight:'80%', objectFit:'contain' }}/>}
          </div>
          {isAdmin && (
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              <input ref={fileRef} type="file" accept="image/*" onChange={onLogoChange} style={{ fontSize:12 }}/>
              <div style={{ display:'flex', gap:8 }}>
                <button onClick={appliquerLogo} disabled={saving || !logoBase64}
                  style={{ background:'var(--rzc-navy, #1E3A8A)', color:'#fff', border:'none', padding:'8px 16px',
                    borderRadius:9, cursor: (saving||!logoBase64)?'not-allowed':'pointer', fontSize:12, fontWeight:700, opacity: (saving||!logoBase64)?.5:1 }}>
                  💾 Utiliser ce logo
                </button>
                <button onClick={reinitialiserLogo} disabled={saving}
                  style={{ background:'#f1f5f9', color:'#64748b', border:'1px solid #e2e8f0', padding:'8px 16px',
                    borderRadius:9, cursor:'pointer', fontSize:12, fontWeight:700 }}>
                  ↺ Logo par défaut
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:12, padding:18, marginTop:16 }}>
        <div style={{ fontSize:13, fontWeight:700, color:'#1e293b', marginBottom:4 }}>🛡️ Logo du document JMP</div>
        <div style={{ fontSize:12, color:'#64748b', marginBottom:14 }}>
          En-tête imprimé sur chaque Plan de gestion de voyage (JMP) généré depuis Centre de Mobilité. Pré-rempli avec le logo Fortuna Mining / Roxgold Sango fourni.
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:20 }}>
          <div style={{ width:160, height:60, borderRadius:10, background:'#f8fafc', border:'1px dashed #cbd5e1', display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden' }}>
            {jmpLogoPreview
              ? <img src={jmpLogoPreview} alt="Logo JMP" style={{ maxWidth:'90%', maxHeight:'90%', objectFit:'contain' }}/>
              : <span style={{fontSize:11,color:'#94a3b8'}}>Aucun logo</span>}
          </div>
          {isAdmin && (
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              <input type="file" accept="image/*" onChange={onJmpLogoChange} style={{ fontSize:12 }}/>
              <button onClick={appliquerJmpLogo} disabled={saving || !jmpLogoBase64}
                style={{ background:'var(--rzc-navy, #1E3A8A)', color:'#fff', border:'none', padding:'8px 16px',
                  borderRadius:9, cursor: (saving||!jmpLogoBase64)?'not-allowed':'pointer', fontSize:12, fontWeight:700, opacity: (saving||!jmpLogoBase64)?.5:1, alignSelf:'flex-start' }}>
                💾 Utiliser ce logo pour le JMP
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

function BadgesTab({ valeurs }) {
  const [liste, setListe] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selection, setSelection] = useState(new Set())

  useEffect(() => {
    personnelAPI.list({ page_size: 2000 })
      .then(r => setListe(r.data.results || r.data || []))
      .catch(() => setListe([]))
      .finally(() => setLoading(false))
  }, [])

  const filtres = liste.filter(p => {
    if (!search) return true
    const s = search.toLowerCase()
    return [p.nom, p.prenom, p.societe].some(v => (v||'').toLowerCase().includes(s))
  })

  const toggle = (id) => setSelection(s => {
    const n = new Set(s)
    n.has(id) ? n.delete(id) : n.add(id)
    return n
  })

  const toggleTout = () => {
    if (selection.size === filtres.length) setSelection(new Set())
    else setSelection(new Set(filtres.map(p => p.id)))
  }

  const genererBadges = () => {
    const gens = liste.filter(p => selection.has(p.id))
    if (!gens.length) return
    const primaire = valeurs.theme_primaire || '#0F2A5C'
    const accent    = valeurs.theme_accent   || '#C9972B'
    const logoSrc = valeurs.logo_base64 ? `data:${valeurs.logo_mime||'image/png'};base64,${valeurs.logo_base64}` : '/roxgold-logo.png'

    const badgeHtml = (p) => {
      // SECURITE : mêmes règles que le rapport d'intervention — un champ
      // personnel n'est pas garanti inoffensif, on échappe avant injection HTML.
      const esc = (v) => (v ?? '').toString().replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      return `
      <div class="badge">
        <div class="head" style="background:${primaire}">
          <img src="${logoSrc}" class="logo"/>
          <div class="camp">ROXGOLD SANGO</div>
        </div>
        <div class="corps">
          <div class="qr"><img src="data:image/png;base64,${p.qr_code_data||''}"/></div>
          <div class="infos">
            <div class="nom">${esc(p.prenom).toUpperCase()}</div>
            <div class="prenom">${esc(p.nom).toUpperCase()}</div>
            <div class="societe" style="color:${accent}">${esc(p.societe) || '—'}</div>
            <div class="type">${esc(p.type_label || p.type_personnel)}</div>
            <div class="matricule">N° ${esc(p.numero || p.matricule) || '—'}</div>
          </div>
        </div>
      </div>
    `}

    const w = window.open('', '_blank', 'width=900,height=700')
    if (!w) return
    w.document.write(`
      <!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><title>Badges Personnel — Roxgold SiteLife</title>
      <style>
        * { box-sizing:border-box; }
        body { font-family:Arial,sans-serif; margin:0; padding:20px; background:#f1f5f9; }
        .grid { display:grid; grid-template-columns:repeat(2,1fr); gap:14px; }
        .badge {
          width:340px; height:214px; border-radius:14px; overflow:hidden;
          border:1px solid #cbd5e1; background:#fff; page-break-inside:avoid;
        }
        .head { padding:10px 14px; display:flex; align-items:center; gap:10px; }
        .head .logo { height:24px; background:#fff; border-radius:4px; padding:2px 6px; object-fit:contain; }
        .head .camp { color:#fff; font-size:11px; font-weight:700; letter-spacing:.5px; }
        .corps { display:flex; padding:14px; gap:14px; align-items:center; }
        .qr img { width:100px; height:100px; }
        .infos { flex:1; }
        .nom { font-size:16px; font-weight:800; color:#1e293b; line-height:1.1; }
        .prenom { font-size:13px; font-weight:600; color:#475569; margin-bottom:6px; }
        .societe { font-size:12px; font-weight:700; margin-bottom:2px; }
        .type { font-size:11px; color:#64748b; margin-bottom:6px; }
        .matricule { font-size:11px; font-family:monospace; color:#94a3b8; }
        @media print { body{background:#fff;padding:0} .grid{gap:8px} }
      </style></head>
      <body>
        <div class="grid">${gens.map(badgeHtml).join('')}</div>
      </body></html>
    `)
    w.document.close()
    w.onload = () => { w.focus(); w.print() }
  }

  if (loading) return <div style={{padding:40,textAlign:'center',color:'#94a3b8'}}>⏳ Chargement du personnel...</div>

  return (
    <div style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:12, padding:18 }}>
      <div style={{ fontSize:13, fontWeight:700, color:'#1e293b', marginBottom:4 }}>🪪 Badges QR — Personnel (Restauration)</div>
      <div style={{ fontSize:12, color:'#64748b', marginBottom:14 }}>
        Génère un badge imprimable par personne, avec le QR code déjà utilisé pour le pointage au restaurant —
        aucune donnée supplémentaire à saisir. Sélectionnez le personnel puis imprimez ; découpez au format carte.
      </div>

      <div style={{ display:'flex', gap:8, marginBottom:12, flexWrap:'wrap', alignItems:'center' }}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 Nom, société..."
          style={{ ...inputStyle(true), maxWidth:220 }} />
        <button onClick={toggleTout}
          style={{ background:'#f1f5f9', color:'#475569', border:'1px solid #e2e8f0', padding:'9px 14px',
            borderRadius:9, cursor:'pointer', fontSize:12, fontWeight:700 }}>
          {selection.size === filtres.length && filtres.length>0 ? 'Tout désélectionner' : 'Tout sélectionner'}
        </button>
        <button onClick={genererBadges} disabled={!selection.size}
          style={{ background: selection.size ? 'var(--rzc-navy, #1E3A8A)' : '#cbd5e1', color:'#fff', border:'none',
            padding:'9px 16px', borderRadius:9, cursor: selection.size?'pointer':'not-allowed', fontSize:12, fontWeight:700 }}>
          🖨️ Générer & imprimer ({selection.size})
        </button>
      </div>

      <div style={{ maxHeight:420, overflowY:'auto', border:'1px solid #e2e8f0', borderRadius:9 }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12.5 }}>
          <thead>
            <tr style={{ background:'#f8fafc' }}>
              <th style={{ padding:'8px 12px', width:30 }}></th>
              <th style={{ padding:'8px 12px', textAlign:'left', fontSize:10, color:'#64748b' }}>NOM</th>
              <th style={{ padding:'8px 12px', textAlign:'left', fontSize:10, color:'#64748b' }}>SOCIÉTÉ</th>
              <th style={{ padding:'8px 12px', textAlign:'left', fontSize:10, color:'#64748b' }}>TYPE</th>
              <th style={{ padding:'8px 12px', textAlign:'left', fontSize:10, color:'#64748b' }}>QR</th>
            </tr>
          </thead>
          <tbody>
            {filtres.map((p,idx) => (
              <tr key={p.id} style={{ borderTop:'1px solid #e2e8f0', background: idx%2?'#f8fafc':'#fff' }}>
                <td style={{ padding:'7px 12px' }}>
                  <input type="checkbox" checked={selection.has(p.id)} onChange={()=>toggle(p.id)}
                    style={{ width:15, height:15, cursor:'pointer' }}/>
                </td>
                <td style={{ padding:'7px 12px', fontWeight:600 }}>{p.nom} {p.prenom}</td>
                <td style={{ padding:'7px 12px', color:'#64748b' }}>{p.societe||'—'}</td>
                <td style={{ padding:'7px 12px', color:'#64748b' }}>{p.type_label||p.type_personnel||'—'}</td>
                <td style={{ padding:'7px 12px' }}>{p.qr_code_data ? '✅' : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
