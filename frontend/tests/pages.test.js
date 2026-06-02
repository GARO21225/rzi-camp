import { describe, it, expect } from 'vitest'
import { readdirSync } from 'fs'
import { join } from 'path'

// Test que toutes les pages V1 sont bien présentes (fidélité à la V1)
const PAGES_V1 = [
  'Dashboard.jsx',
  'Login.jsx',
  'Boutique.jsx',
  'BoutiquePOS.jsx',
  'MapPage.jsx',
  'Maintenance.jsx',
  'Personnel.jsx',
  'Evenements.jsx',
  'Voyages.jsx',
  'RotationsPage.jsx',
  'Residences.jsx',
  'Restauration.jsx',
  'InductionPage.jsx',
  'AssistantIA.jsx',
  'AnnuairePage.jsx',
  'AuditPage.jsx',
  'CentreOperationnel.jsx',
  'Demandes.jsx',
  'Historique.jsx',
  'MonCompte.jsx',
  'Presences.jsx',
  'RapportPage.jsx',
  'ReservationsPage.jsx',
  'StatusPage.jsx',
  'WorkflowHub.jsx',
  'Analytics.jsx',
]

const COMPONENTS_V1 = [
  'ConfirmModal.jsx',
  'EventNotifBanner.jsx',
  'GlobalSearch.jsx',
  'Layout.jsx',
  'LoadingSpinner.jsx',
  'MassActionBar.jsx',
  'OfflineBanner.jsx',
  'PWAInstall.jsx',
]

describe('Fidelite a la V1 (V2 ne supprime rien)', () => {
  it('toutes les 26 pages V1 sont presentes', () => {
    const files = readdirSync(join(process.cwd(), 'src/pages'))
    PAGES_V1.forEach((p) => {
      expect(files, `Page V1 manquante: ${p}`).toContain(p)
    })
  })

  it('tous les 8 composants V1 sont presents', () => {
    const files = readdirSync(join(process.cwd(), 'src/components'))
    COMPONENTS_V1.forEach((c) => {
      expect(files, `Composant V1 manquant: ${c}`).toContain(c)
    })
  })

  it('MobileNav V2 est ajoute (pas de remplacement)', () => {
    const files = readdirSync(join(process.cwd(), 'src/components'))
    expect(files).toContain('MobileNav.jsx')
  })
})
