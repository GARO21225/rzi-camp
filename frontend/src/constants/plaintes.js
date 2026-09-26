// Categories et sous-categories de Plainte (document dedie, section 24) -
// DOIT rester identique a Plainte.CATEGORIES cote backend
// (backend/residences/models.py) - un seul fichier partage ici pour que
// Plaintes.jsx et Residences.jsx (bouton "Signaler" sur Residents
// principaux) ne divergent jamais silencieusement.
export const PLAINTE_CATEGORIES = {
  Proprete: ["poubelle","sol","plafond","murs","fenetres","porte","mobilier","douche","wc","lavabo","miroir","autre"],
  Fournitures: ["couverture","drap","serviette","savon","gel_lave_mains","serpillere","insecticide","desodorisant","autre"],
  Electricite: ["lumiere","interrupteur","prise","autre"],
  Equipements: ["ordinateur","climatiseur","refrigerateur","television","autre"],
  Plomberie: ["douche","wc","lavabo","fuite","canalisation","autre"],
  Securite: ["serrure","poignee","porte","fenetre","cle","autre"],
  Etat_chambre: ["peinture","humidite","degradation","autre"],
  Autre: ["autre"],
}
