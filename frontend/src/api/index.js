import axios from 'axios'
import { useStore } from '../store'
import { toast } from '../toast'
// URL auto-détectée: VITE_API_URL → hostname replace → localhost
const BASE = (() => {
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL.replace(/\/+$/, '')
  const h = window.location.hostname
  if (h.includes('onrender.com') && h.includes('frontend'))
    return 'https://' + h.replace('frontend','backend')
  if (h !== 'localhost' && h !== '127.0.0.1')
    return window.location.origin
  return 'http://localhost:8000'
})()
const api = axios.create({
  baseURL: BASE,
  timeout: 30000,
  withCredentials: false,   // Évite les preflight complexes
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  }
})

// Construit une URL de téléchargement de fichier en y ajoutant le token JWT courant,
// nécessaire car <a href> et window.open() ne peuvent pas attacher de header HTTP.
const withToken = (url) => {
  const t = localStorage.getItem('access_token')
  return t ? `${url}${url.includes('?') ? '&' : '?'}token=${encodeURIComponent(t)}` : url
}
api.interceptors.request.use(cfg => {
  const token = localStorage.getItem('access_token')
  if (token) cfg.headers.Authorization = `Bearer ${token}`
  return cfg
})
// Garde partagee : evite que PLUSIEURS requetes paralleles en echec 401
// (une page comme Demandes charge 4 sources a la fois) ne declenchent
// chacune leur propre tentative de rafraichissement.
let _refreshPromise = null

api.interceptors.response.use(r => r, async err => {
  const url = err.config?.url || ''
  // Ne pas intercepter les appels d'auth eux-mêmes
  const isAuthCall = url.includes('/auth/login/') || url.includes('/auth/refresh/')
  if (err.response?.status === 401 && !isAuthCall) {
    const refresh = localStorage.getItem('refresh_token')
    if (refresh && !err.config._retry) {
      err.config._retry = true
      try {
        // Un seul rafraichissement en vol a la fois : les requetes
        // paralleles qui arrivent ici pendant qu'un rafraichissement est
        // deja en cours attendent CE MEME appel au lieu d'en relancer un.
        if (!_refreshPromise) {
          _refreshPromise = axios.post(`${BASE}/api/auth/refresh/`, { refresh })
            .finally(() => { _refreshPromise = null })
        }
        const { data } = await _refreshPromise
        localStorage.setItem('access_token', data.access)
        err.config.headers.Authorization = `Bearer ${data.access}`
        return api(err.config)
      } catch {
        // Session definitivement invalide. IMPORTANT : on ne fait PAS de
        // window.location.href ici (rechargement complet du navigateur) -
        // ca avait cree un risque reel de boucle de rechargement quand
        // plusieurs requetes paralleles echouaient en meme temps, chacune
        // relancant sa propre navigation en pleine page.
        //
        // A la place, on utilise le mecanisme REACTIF deja en place :
        // logout() vide le store Zustand + localStorage, et PrivateRoute
        // (dans App.jsx) reagit instantanement au token devenu null en
        // affichant /login via react-router - une simple transition
        // d'etat React, jamais un rechargement navigateur, donc jamais de
        // boucle possible meme si plusieurs requetes echouent ensemble.
        useStore.getState().logout()
        toast.error('Votre session a expiré — merci de vous reconnecter.')
      }
    } else if (localStorage.getItem('access_token') || localStorage.getItem('refresh_token')) {
      // Pas de refresh_token disponible (deja consomme, jamais eu, ou deja
      // retente et toujours 401) : la session est definitivement invalide.
      // Meme logique reactive que ci-dessus, pas de rechargement force.
      useStore.getState().logout()
      toast.error('Votre session a expiré — merci de vous reconnecter.')
    }
  }
  return Promise.reject(err)
})
export default api
export const auth = {
  login: (u,p) => api.post('/api/auth/login/', {username:u,password:p}),
  me: () => api.get('/api/auth/me/'),
  demanderOtp: (telephone) => api.post('/api/auth/otp/demander/', {telephone}),
  verifierOtp: (telephone, code) => api.post('/api/auth/otp/verifier/', {telephone, code}),
}
export const batiments = {
  list: (p) => api.get('/api/batiments/', {params:p}),
  geojson: (p) => api.get('/api/batiments/geojson/', {params:p}),
  stats: () => api.get('/api/batiments/stats/'),
  update: (id,d,confirm=false) => api.patch(`/api/batiments/${id}/`, {...d, confirm}),
  updateDraft: (id,d) => api.patch(`/api/batiments/${id}/`, {...d, confirm:false}),
  exportCsv: (p) => withToken(`${BASE}/api/batiments/export_csv/?${new URLSearchParams(p)}`),
  exportBlocs: () => withToken(`${BASE}/api/batiments/export_par_bloc/`),
  history: (residence) => api.get('/api/occupation-history/', {params:{batiment:residence}}),
  chambresDisponibles: (date_debut, date_fin) => api.get('/api/batiments/chambres_disponibles/', {params:{date_debut, date_fin}}),
}

// ── Points d'intérêt carte (restaurant, sport, rampe, etc.) ──────────
export const pointsInteret = {
  list:   ()      => api.get('/api/points-interet/'),
  create: (d)     => api.post('/api/points-interet/', d),
  importMasse: (geojsonOrList) => api.post('/api/points-interet/import_masse/', geojsonOrList),
  update: (id, d) => api.patch(`/api/points-interet/${id}/`, d),
  delete: (id)    => api.delete(`/api/points-interet/${id}/`),
}

// ── Réseau de circulation piéton (rampes, galeries, dallettes) ──────
export const cheminsCirculation = {
  list:   ()      => api.get('/api/chemins-circulation/'),
  create: (d)     => api.post('/api/chemins-circulation/', d),
  delete: (id)    => api.delete(`/api/chemins-circulation/${id}/`),
  itineraire: (depart, arrivee) => api.post('/api/chemins-circulation/itineraire/', {depart, arrivee}),
}
// ── Contenu éditable Induction Camp ──────────────────────────────────
export const inductionConfig = {
  actuelle: () => api.get('/api/induction-config/actuelle/'),
  list:     () => api.get('/api/induction-config/'),
  create:   (d) => api.post('/api/induction-config/', d),
  update:   (id, d) => api.patch(`/api/induction-config/${id}/`, d),
  importerDonneesOriginales: () => api.post('/api/induction-config/importer_donnees_originales/'),
}
export const inductionInfras = {
  list:   (p) => api.get('/api/induction-infras/', { params: p }),
  create: (d) => api.post('/api/induction-infras/', d),
  update: (id, d) => api.patch(`/api/induction-infras/${id}/`, d),
  delete: (id) => api.delete(`/api/induction-infras/${id}/`),
  // Upload de fichier video : necessite multipart/form-data, contrairement
  // aux autres champs (texte/JSON) geres par update() ci-dessus.
  uploadVideo: (id, file) => {
    const fd = new FormData()
    fd.append('video', file)
    return api.patch(`/api/induction-infras/${id}/`, fd, { headers: { 'Content-Type': 'multipart/form-data' } })
  },
}
export const inductionRegles = {
  list:   (p) => api.get('/api/induction-regles/', { params: p }),
  create: (d) => api.post('/api/induction-regles/', d),
  update: (id, d) => api.patch(`/api/induction-regles/${id}/`, d),
  delete: (id) => api.delete(`/api/induction-regles/${id}/`),
}
export const inductionQuiz = {
  list:     (p) => api.get('/api/induction-quiz/', { params: p }),
  create:   (d) => api.post('/api/induction-quiz/', d),
  update:   (id, d) => api.patch(`/api/induction-quiz/${id}/`, d),
  delete:   (id) => api.delete(`/api/induction-quiz/${id}/`),
  verifier: (reponses) => api.post('/api/induction-quiz/verifier/', { reponses }),
}
export const residentsPrincipaux = {
  list: (params) => api.get('/api/residents-principaux/', {params}),
  declarer: (personnel, batiment) => api.post('/api/residents-principaux/declarer/', {personnel, batiment}),
  changerChambre: (id, batiment) => api.post(`/api/residents-principaux/${id}/changer_chambre/`, {batiment}),
  mettreFin: (id, motif) => api.post(`/api/residents-principaux/${id}/mettre_fin/`, {motif}),
  supprimer: (id) => api.delete(`/api/residents-principaux/${id}/`),
  importerMasse: (lignes) => api.post('/api/residents-principaux/importer_masse/', {lignes}),
}
export const personnel = {
  declarerMasse: (d) => api.post('/api/declarer-soustraitants/', d),
  list: (p) => api.get('/api/personnel/', {params:p}),
  exportCsv: (p) => withToken(`${BASE}/api/personnel/export_csv/?${new URLSearchParams(p||{})}`),
  monProfil: () => api.get('/api/personnel/mon_profil/'),
  create: (d) => api.post('/api/personnel/', d),
  update: (id,d) => api.patch(`/api/personnel/${id}/`, d),
  delete: (id) => api.delete(`/api/personnel/${id}/`),
  regenererQr: (id) => api.post(`/api/personnel/${id}/regenerer_qr/`),
  regenererCompte: (id) => api.post(`/api/personnel/${id}/regenerer_compte/`),
  historiqueVoyages: (id) => api.get(`/api/personnel/${id}/historique_voyages/`),
  historiqueChambre: (id, p) => api.get(`/api/personnel/${id}/historique_chambres/`, {params:p}),
  assigRole: (id, role) => api.patch(`/api/personnel/${id}/assigner_role/`, {role}),
  toggleActive: (id) => api.post(`/api/personnel/${id}/toggle_active/`),
}
// ── Induction Records ───────────────────────────────────
export const inductionAPI = {
  list:         (p)    => api.get('/api/induction-records/', {params:p}),
  getByPersonnel:(id)  => api.get('/api/induction-records/', {params:{personnel:id}}),
  updateEtape:  (d)    => api.post('/api/induction-records/update_etape/', d),
  valider:      (id)   => api.post(`/api/induction-records/${id}/valider/`),
  refuser:      (id,motif) => api.post(`/api/induction-records/${id}/refuser/`, {motif}),
}

// ── Équipements EPI ──
export const epiAPI = {
  list:    (p) => api.get('/api/epi/', {params:p}),
  create:  (d) => api.post('/api/epi/', d),
  update:  (id,d) => api.patch(`/api/epi/${id}/`, d),
  delete:  (id) => api.delete(`/api/epi/${id}/`),
  alertes: ()  => api.get('/api/epi/alertes/'),
}

// ── Menu Restaurant  ─────────────────────────────────────
export const menu = {
  list:   (p) => api.get('/api/menu/', {params:p}),
  create: (d) => api.post('/api/menu/', d),
  update: (id,d) => api.patch(`/api/menu/${id}/`, d),
  delete: (id) => api.delete(`/api/menu/${id}/`),
  today:  () => api.get('/api/menu/today/'),
}

export const incidents = {
  list:         (p) => api.get('/api/incidents/liste/', {params:p}),
  create:       (d) => api.post('/api/incidents/', d),
  declarer:     (d) => api.post('/api/incidents/declarer/', d),
  detail:       (id) => api.get(`/api/incidents/${id}/detail/`),
  modifier:     (id,d) => api.patch(`/api/incidents/${id}/`, d),
  supprimer:    (id) => api.delete(`/api/incidents/${id}/`),
  update:       (id,d) => api.patch(`/api/incidents/${id}/`, d),
  delete:       (id) => api.delete(`/api/incidents/${id}/`),
  stats:        () => api.get('/api/incidents/stats-sql/'),
  techniciens:  () => api.get('/api/incidents/techniciens/'),
  verifierSLA:  () => api.post('/api/incidents/verifier_sla/'),
  // Workflow
  assigner:     (id,d) => api.post(`/api/incidents/${id}/assigner/`, d),
  commencer:    (id,d) => api.post(`/api/incidents/${id}/commencer/`, d),
  resoudre:     (id,d) => api.post(`/api/incidents/${id}/resoudre/`, d),
  cloturer:     (id,d) => api.post(`/api/incidents/${id}/cloturer/`, d),
  escalader:    (id,d) => api.post(`/api/incidents/${id}/escalader/`, d),
  commenter:    (id,d) => api.post(`/api/incidents/${id}/commenter/`, d),
  addComment:   (id,d) => api.post(`/api/incidents/${id}/commenter/`, d),
  annuler:      (id,d) => api.post(`/api/incidents/${id}/annuler/`, d),
}
export const qr = {
  generer: (d) => api.post('/api/qr/generer/', d),
  scan: (d) => api.post('/api/qr/scan/', d),
  scannerPersonnel: (d) => api.post('/api/qr/scan/', d),
  validerParPersonnel: (d) => api.post('/api/qr/valider_par_personnel/', d),
  repas:            (p) => api.get('/api/repas/', { params: p }),
  historiqueScans:  (p) => api.get('/api/repas/', { params: p }),
  viderHistorique: (type_repas) => api.delete(`/api/qr/vider_historique/?type_repas=${type_repas}`),
  validerParNumero: (d) => api.post('/api/qr/valider_par_numero/', d),
  repas: (p) => api.get('/api/repas/', {params:p}),
  historiqueScans: (p) => api.get('/api/repas/', {params:p}),
}

// ── Avis restauration — amélioration continue ──
export const avisRestauration = {
  create: (d) => api.post('/api/avis/', d),
  list:   (p) => api.get('/api/avis/', {params:p}),
  stats:  (periode) => api.get('/api/avis/stats/', {params:{periode}}),
  evolution: (periode) => api.get('/api/avis/evolution/', {params:{periode}}),
  exportCsv: (periode) => withToken(`${BASE}/api/avis/export_csv/?periode=${periode||'30j'}`),
}
export const questionsAvis = {
  list:        (actifSeulement) => api.get('/api/questions-avis/', {params: actifSeulement ? {actif_seulement:'1'} : {}}),
  create:      (d)     => api.post('/api/questions-avis/', d),
  update:      (id, d) => api.patch(`/api/questions-avis/${id}/`, d),
  delete:      (id)    => api.delete(`/api/questions-avis/${id}/`),
}
export const occupationHistoryAdmin = {
  delete: (id) => api.delete(`/api/occupation-history-admin/${id}/`),
  update: (id,d) => api.patch(`/api/occupation-history-admin/${id}/`, d),
}
export const occupationHistory = {
  recherche: (p) => api.get('/api/occupation-history/recherche/', {params:p}),
  list: (p) => api.get('/api/occupation-history/', {params:p}),
  exportCsv: (p) => withToken(`${BASE}/api/occupation-history/export_csv/?${new URLSearchParams(p||{})}`),
}
export const voyages = {
  list: (p) => api.get('/api/voyages/', {params:p}),
  create: (d) => api.post('/api/voyages/', d),
  update: (id, d) => api.patch(`/api/voyages/${id}/`, d),
  partir: (id) => api.post(`/api/voyages/${id}/partir/`),
  revenir: (id,d) => api.post(`/api/voyages/${id}/revenir/`, d),
  stats: () => api.get('/api/voyages/stats/'),
  rappelsRotation: () => api.get('/api/voyages/rappels_rotation/'),
  vueEnsemble: (p) => api.get('/api/voyages/vue_ensemble/', {params:p}),
  exportCsv: (p) => withToken(`${BASE}/api/voyages/export_csv/?${new URLSearchParams(p||{})}`),
  annuler: (id) => api.post(`/api/voyages/${id}/annuler/`),
  supprimer: (id) => api.delete(`/api/voyages/${id}/supprimer_planifie/`),
  valider: (id) => api.post(`/api/voyages/${id}/valider/`),
  refuser: (id, motif) => api.post(`/api/voyages/${id}/refuser/`, {motif}),
  billetUrl: (id) => withToken(`${BASE}/api/voyages/${id}/billet/`),
  rotationsDisponibles: () => api.get('/api/voyages/rotations/'),
  rejoindreRotation: (rotation_id, personnel_id) => api.post('/api/voyages/rejoindre_rotation/', {rotation_id, personnel_id}),
  retoursAnticipes: () => api.get('/api/voyages/retours_anticipes/'),
}
export const etapesVoyage = {
  list: (voyageId) => api.get('/api/etapes-voyage/', {params:{voyage:voyageId}}),
  create: (d) => api.post('/api/etapes-voyage/', d),
  update: (id, d) => api.patch(`/api/etapes-voyage/${id}/`, d),
  delete: (id) => api.delete(`/api/etapes-voyage/${id}/`),
}
export const vehiculesFlotte = {
  list: () => api.get('/api/vehicules-flotte/'),
}
export const audit = {
  list: (p) => api.get('/api/audit/', {params:p}),
}

export const evenements = {
  list: (p) => api.get('/api/evenements/', {params:p}),
  create: (d) => api.post('/api/evenements/', d),
  update: (id,d) => api.patch(`/api/evenements/${id}/`, d),
  delete: (id) => api.delete(`/api/evenements/${id}/`),
  notifier: (id) => api.post(`/api/evenements/${id}/notifier/`),
  agenda: () => api.get('/api/evenements/agenda/'),
  changerStatut: (id,statut) => api.patch(`/api/evenements/${id}/changer_statut/`, {statut}),
  genererQr: (id, preference_boisson, personnel_id) => api.post(`/api/evenements/${id}/generer_qr/`, {preference_boisson, personnel_id}),
  scannerQr: (id, token) => api.post(`/api/evenements/${id}/scanner_qr/`, {token}),
}
export const groupesDiffusion = {
  list: () => api.get('/api/groupes-diffusion/'),
  create: (d) => api.post('/api/groupes-diffusion/', d),
  update: (id,d) => api.patch(`/api/groupes-diffusion/${id}/`, d),
  delete: (id) => api.delete(`/api/groupes-diffusion/${id}/`),
}
export const notifications = {
  list: (p) => api.get('/api/notifications/', {params:p}),
  compteur: () => api.get('/api/notifications/compteur/'),
  marquerLu: (id) => api.post(`/api/notifications/${id}/marquer_lu/`),
  toutLire: () => api.post('/api/notifications/tout_lire/'),
}
export const alertes = {
  list: () => api.get('/api/alertes/'),
  create: (d) => api.post('/api/alertes/', d),
  desactiver: (id) => api.post(`/api/alertes/${id}/desactiver/`),
}

export const demandes = {
  list: (p) => api.get('/api/demandes/', {params:p}),
  create: (d) => api.post('/api/demandes/', d),
  delete: (id) => api.delete(`/api/demandes/${id}/`),
  stats: () => api.get('/api/demandes/stats/'),
  valider: (id, d) => api.post(`/api/demandes/${id}/valider/`, d),
  rejeter: (id, d) => api.post(`/api/demandes/${id}/rejeter/`, d),
  proposer: (id, d) => api.post(`/api/demandes/${id}/proposer/`, d),
  accepterProposition: (id) => api.post(`/api/demandes/${id}/accepter_proposition/`),
  refuserProposition: (id) => api.post(`/api/demandes/${id}/refuser_proposition/`),
  annuler: (id) => api.post(`/api/demandes/${id}/annuler/`),
}

export const adminApi = {
  users: () => api.get('/api/admin/users/'),
  toggleActive: (id) => api.post(`/api/admin/users/${id}/toggle-active/`),
  deleteUser: (id) => api.delete(`/api/admin/users/${id}/delete/`),
  assignRole: (id, role) => api.post(`/api/admin/users/${id}/role/`, {role}),
}

// ── Paramétrage ──
export const parametres = {
  list: () => api.get('/api/parametres/'),
  save: (parametres) => api.post('/api/parametres/sauver/', { parametres }),
}

export const rolesAPI = {
  list:   ()      => api.get('/api/roles/'),
  create: (d)     => api.post('/api/roles/', d),
  update: (id, d) => api.patch(`/api/roles/${id}/`, d),
  delete: (id)    => api.delete(`/api/roles/${id}/`),
}

export const rapportsPlanifiesAPI = {
  list:   ()      => api.get('/api/rapports-planifies/'),
  create: (d)     => api.post('/api/rapports-planifies/', d),
  update: (id, d) => api.patch(`/api/rapports-planifies/${id}/`, d),
  delete: (id)    => api.delete(`/api/rapports-planifies/${id}/`),
}

// ── Mot de passe ──
export const password = {
  change: (d) => api.post('/api/change-password/', d),
  resetUser: (id, pwd) => api.post(`/api/reset-password/${id}/`, { mot_de_passe: pwd }),
}

// ── Import CSV Personnel ──
export const importCSV = (file) => {
  const fd = new FormData()
  fd.append('file', file)
  return api.post('/api/personnel/import_csv/', fd, {
    headers: { 'Content-Type': 'multipart/form-data' }
  })
}
export const boutique = {
  articles:        (p)        => api.get('/api/boutique/articles/', {params:p}),
  createArticle:   (d)        => api.post('/api/boutique/articles/', d),
  updateArticle:   (id,d)     => api.patch(`/api/boutique/articles/${id}/`, d),
  deleteArticle:   (id)       => api.delete(`/api/boutique/articles/${id}/`),
  consommations:   (p)        => api.get('/api/boutique/consommations/', {params:p}),
  addConso:        (d)        => api.post('/api/boutique/consommations/', d),
  statsJour:       ()         => api.get('/api/boutique/consommations/stats_jour/'),
  // Bons de caisse
  bons:            (p)        => api.get('/api/boutique/bons/', {params:p}),
  soldePersonnel:  (pid)      => api.get('/api/boutique/bons/solde_personnel/', {params:{personnel_id:pid}}),
  crediterPersonnel:(d)       => api.post('/api/boutique/bons/crediter/', d),
  crediterTous:    (d)        => api.post('/api/boutique/bons/crediter_tous/', d),
  rembourserBon:   (id, d)    => api.post(`/api/boutique/bons/${id}/rembourser/`, d),
  historiqueRemboursements: (id) => api.get(`/api/boutique/bons/${id}/remboursements/`),
  // Stock management
  updateStock:     (id,d)     => api.post(`/api/boutique/articles/${id}/ajuster_stock/`, d),
  alertesStock:    (p)        => api.get('/api/boutique/articles/alertes_stock/', {params:p}),
  // Analyses
  analyses:        (p)        => api.get('/api/boutique/consommations/analyses/', {params:p}),
}
