
// Detection de chevauchement de dates cote frontend — pour retirer les
// ressources deja occupees (vehicule, conducteur, personnel) DIRECTEMENT
// des selecteurs a la creation d'une rotation, au lieu de laisser
// l'utilisateur les choisir puis echouer a la soumission avec un message
// d'erreur ("Ce vehicule est deja affecte...", "X ne peut pas etre a la
// fois conducteur principal et second chauffeur..."). Le backend GARDE ces
// controles (defense en profondeur, notamment pour la creation via API
// directe), mais l'utilisateur ne devrait plus jamais les voir en pratique
// dans ce formulaire.
export const STATUTS_ROTATION_ACTIFS = ['planifie', 'en_voyage']
export const datesChevauchent = (debutA, finA, debutB, finB) => {
  if (!debutA || !finA || !debutB || !finB) return false
  return debutA <= finB && finA >= debutB
}

// Rotations actives (statut derive cote backend) dont la periode croise
// celle demandee — sert de base commune aux 3 controles (vehicule,
// conducteur principal, second chauffeur). excludeRotationId permet
// d'ignorer la rotation en cours de modification, le cas echeant.
export const rotationsEnConflit = (rotations, dateDepart, dateRetour, excludeRotationId) =>
  (rotations||[]).filter(r =>
    r.rotation_id !== excludeRotationId &&
    STATUTS_ROTATION_ACTIFS.includes(r.statut) &&
    datesChevauchent(dateDepart, dateRetour, r.date_depart, r.date_retour_prevue)
  )

export const vehiculeOccupe = (matricule, rotations, dateDepart, dateRetour, excludeRotationId) => {
  if (!matricule) return null
  return rotationsEnConflit(rotations, dateDepart, dateRetour, excludeRotationId)
    .find(r => (r.vehicule_matricule||'').trim().toLowerCase() === matricule.trim().toLowerCase()) || null
}

export const conducteurOccupe = (nomComplet, rotations, dateDepart, dateRetour, excludeRotationId) => {
  if (!nomComplet) return null
  const cible = nomComplet.trim().toLowerCase()
  return rotationsEnConflit(rotations, dateDepart, dateRetour, excludeRotationId)
    .find(r => (r.conducteur||'').trim().toLowerCase()===cible || (r.conducteur_secondaire||'').trim().toLowerCase()===cible) || null
}

// Personnel deja engage sur un AUTRE voyage actif (planifie/en_voyage) qui
// chevauche la periode demandee — meme regle que la validation backend
// (VoyageSerializer.validate), appliquee ici en amont pour retirer la
// personne de la liste des passagers cochables plutot que de la laisser
// dans la liste "exclus" renvoyee apres coup par creer_rotation.
export const personnelOccupe = (personnelId, voyages, dateDepart, dateRetour) => {
  if (!personnelId || !dateDepart) return null
  return (voyages||[]).find(v =>
    v.personnel === personnelId &&
    ['planifie','en_voyage'].includes(v.statut) &&
    datesChevauchent(dateDepart, dateRetour||dateDepart, v.date_depart, v.date_retour_prevue||v.date_depart)
  ) || null
}

