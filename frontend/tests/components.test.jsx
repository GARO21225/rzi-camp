import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import ProgressBar from '../src/components/ProgressBar'
import KpiCard from '../src/components/KpiCard'
import BarChart from '../src/components/BarChart'

describe('ProgressBar', () => {
  it('rend un label et une valeur', () => {
    render(<ProgressBar value={50} max={100} showLabel label="Avancement" />)
    expect(screen.getByText('Avancement')).toBeDefined()
    expect(screen.getByText('50%')).toBeDefined()
  })

  it('plafonne la valeur à 100%', () => {
    render(<ProgressBar value={150} max={100} showLabel />)
    expect(screen.getByText('100%')).toBeDefined()
  })

  it('plafonne la valeur à 0% pour value < 0', () => {
    render(<ProgressBar value={-10} max={100} showLabel />)
    expect(screen.getByText('0%')).toBeDefined()
  })
})

describe('KpiCard', () => {
  it('affiche le label, la valeur et le delta', () => {
    render(
      <KpiCard
        label="Occupation"
        value="847 / 920"
        delta="2.4%"
        deltaDir="up"
      />
    )
    expect(screen.getByText('Occupation')).toBeDefined()
    expect(screen.getByText('847 / 920')).toBeDefined()
    expect(screen.getByText('2.4%')).toBeDefined()
  })

  it('rend la progress bar quand fournie', () => {
    const { container } = render(
      <KpiCard
        label="HSE"
        value="98.4%"
        progress={98.4}
        progressColor="emerald"
        progressLabel="Cible 95%"
      />
    )
    expect(container.querySelector('.progressbar')).toBeDefined()
  })
})

describe('BarChart', () => {
  it('rend une ligne par entrée de data', () => {
    const data = [
      { label: 'A', value: 100 },
      { label: 'B', value: 200 },
      { label: 'C', value: 50 },
    ]
    const { container } = render(<BarChart data={data} />)
    const rows = container.querySelectorAll('.barchart-row')
    expect(rows).toHaveLength(3)
  })

  it('calcule la largeur max proportionnellement', () => {
    const data = [
      { label: 'Max', value: 1000 },
      { label: 'Half', value: 500 },
    ]
    const { container } = render(<BarChart data={data} />)
    const fills = container.querySelectorAll('.progressbar-fill')
    // Premier = 100%, second = 50%
    expect(fills[0].style.width).toBe('100%')
    expect(fills[1].style.width).toBe('50%')
  })
})
