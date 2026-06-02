import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

// Test que la V2 n'a SUPPRIMÉ aucune page V1
const V1_PAGES = [
  // OPÉRATIONS
  '/', '/carte', '/operations',
  // PERSONNES
  '/personnel', '/annuaire', '/induction',
  // HÉBERGEMENT & MOBILITÉ
  '/residences', '/voyages', '/rotations',
  // SERVICES AUX RÉSIDENTS
  '/restauration', '/boutique', '/boutique-pos', '/reservations',
  // EXPLOITATION
  '/maintenance', '/evenements', '/demandes', '/presences', '/workflows',
  // PILOTAGE & ANALYSE
  '/analytics', '/rapports', '/historique', '/audit', '/assistant', '/status',
  // COMPTE
  '/mon-compte',
]

describe('V2 Sidebar — fidelite a la V1', () => {
  const sidebar = readFileSync(
    join(process.cwd(), 'src/components/Sidebar.jsx'),
    'utf-8'
  )

  it('contient TOUTES les 25 pages V1 (aucune suppression)', () => {
    V1_PAGES.forEach((p) => {
      expect(sidebar, `Page V1 manquante dans Sidebar: ${p}`).toContain(`'${p}'`)
    })
  })

  it('contient les groupes (sidebar groupe)', () => {
    expect(sidebar).toContain("label: 'OPÉRATIONS'")
    expect(sidebar).toContain("label: 'PERSONNES'")
    expect(sidebar).toContain("label: 'HÉBERGEMENT & MOBILITÉ'")
    expect(sidebar).toContain("label: 'SERVICES AUX RÉSIDENTS'")
    expect(sidebar).toContain("label: 'EXPLOITATION'")
    expect(sidebar).toContain("label: 'PILOTAGE & ANALYSE'")
    expect(sidebar).toContain("label: 'COMPTE'")
  })

  it('a des couleurs avec contraste eleve (texte BLANC)', () => {
    expect(sidebar).toContain("text:      '#ffffff'")
  })

  it('utilise les VRAIS noms V1 (pas de renommage)', () => {
    expect(sidebar).toContain("Bar & Boutique")
    expect(sidebar).toContain("Boutique POS")
    expect(sidebar).toContain("Réservations")
    expect(sidebar).toContain("Induction QHSE")
    expect(sidebar).toContain("Centre Opérationnel")
    expect(sidebar).toContain("Workflow Hub")
  })

  it('n\'a PAS invente de pages (pas de DigitalTwin, QRScan, CopiloteIA)', () => {
    expect(sidebar).not.toContain('DigitalTwin')
    expect(sidebar).not.toContain('QRScan')
    expect(sidebar).not.toContain('Copilote')
    expect(sidebar).not.toContain('QR Anti-Fraude')
  })

  it('utilise le logo Roxgold (pas d\'avatar genere)', () => {
    expect(sidebar).toContain('roxgold-logo.png')
  })

  it('affiche le contexte Cote d\'Ivoire', () => {
    expect(sidebar).toContain('Côte d\'Ivoire')
  })
})
