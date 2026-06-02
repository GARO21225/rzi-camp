import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import LoadingSpinner from '../src/components/LoadingSpinner'
import ConfirmModal from '../src/components/ConfirmModal'

describe('LoadingSpinner (V2 — composant V1)', () => {
  it('rend un loader', () => {
    const { container } = render(<LoadingSpinner />)
    expect(container.firstChild).toBeTruthy()
  })
})

describe('ConfirmModal (V2 — composant V1)', () => {
  it('rend rien si open=false', () => {
    const { container } = render(
      <ConfirmModal open={false} onConfirm={() => {}} onCancel={() => {}} title="X" message="Y" />
    )
    expect(container.firstChild).toBeNull()
  })
})
