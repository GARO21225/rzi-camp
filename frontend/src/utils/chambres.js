// Libellé « résidence principale » d'une chambre dans les listes déroulantes.
// Chambre ordinaire : « (déjà résidence principale de X) » ; chambre partagée : « (2/3 résidents : A, B) ».
export function libelleResidentsPrincipaux(b, exclurePersonnelId) {
  const partage = !!b.groupe_chambre || (b.residents_principaux_max || 1) > 1
  if (partage) {
    const liste = (b.residents_principaux || []).filter(r => r.personnel_id !== exclurePersonnelId)
    const noms = liste.map(r => r.personnel_nom).join(', ')
    return `(chambre partagée ${b.groupe_chambre || ''} · ${liste.length}/${b.residents_principaux_max || 1} résidents${noms ? ` : ${noms}` : ''})`
  }
  const rp = b.resident_principal
  return rp && rp.personnel_id !== exclurePersonnelId ? `(déjà résidence principale de ${rp.personnel_nom})` : ''
}
