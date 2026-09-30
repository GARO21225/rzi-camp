// Categories et sous-categories de Plainte (document dedie, section 24).
//
// Depuis Parametrage > Gestion des plaintes, l'admin gere desormais ces
// categories en base (modele PlainteCategorie, backend/residences/models.py)
// au lieu d'un dict fige ici. Ce dict reste UNIQUEMENT comme filet de
// secours (API indisponible / hors-ligne) - toujours utiliser
// usePlainteCategories() ci-dessous plutot que cette constante directement,
// pour que Plaintes.jsx et Residences.jsx (bouton "Signaler" sur Residents
// principaux) reflètent toujours les categories reellement configurees.
export const PLAINTE_CATEGORIES_FALLBACK = {
  Proprete: ["poubelle","sol","plafond","murs","fenetres","porte","mobilier","douche","wc","lavabo","miroir","autre"],
  Fournitures: ["couverture","drap","serviette","savon","gel_lave_mains","serpillere","insecticide","desodorisant","autre"],
  Electricite: ["lumiere","interrupteur","prise","autre"],
  Equipements: ["ordinateur","climatiseur","refrigerateur","television","autre"],
  Plomberie: ["douche","wc","lavabo","fuite","canalisation","autre"],
  Securite: ["serrure","poignee","porte","fenetre","cle","autre"],
  Etat_chambre: ["peinture","humidite","degradation","autre"],
  Autre: ["autre"],
}
// Alias conservé pour compatibilité avec du code existant qui importait
// encore le nom précédent.
export const PLAINTE_CATEGORIES = PLAINTE_CATEGORIES_FALLBACK

import { useEffect, useState } from 'react'
import { plaintesCategories } from '../api'

// Hook partagé : charge les catégories ACTIVES configurées depuis
// Paramétrage, sous la même forme {NomCategorie: [sous_categories...]}
// qu'avant (pour ne rien casser dans Plaintes.jsx / Residences.jsx), avec
// repli sur PLAINTE_CATEGORIES_FALLBACK si l'API échoue ou ne renvoie rien.
export function usePlainteCategories() {
  const [categories, setCategories] = useState(PLAINTE_CATEGORIES_FALLBACK)
  useEffect(() => {
    plaintesCategories.list().then(r => {
      const items = (r.data.results || r.data || []).filter(c => c.actif)
      if (items.length === 0) return
      const dict = {}
      items.forEach(c => { dict[c.nom] = (c.sous_categories && c.sous_categories.length) ? c.sous_categories : ['autre'] })
      setCategories(dict)
    }).catch(() => {})
  }, [])
  return categories
}
