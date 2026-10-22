import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import SelectRecherche from './SelectRecherche'

// Vérifie le vrai bug remonté ("les listes déroulantes ne prennent pas") :
// l'ancienne implémentation reposait sur <input list> + <datalist>, non
// fonctionnel dans les WebView natives Android/iOS. Le nouveau dropdown est
// du HTML/CSS/JS ordinaire — ces tests vérifient le COMPORTEMENT (ouverture
// au focus, sélection au tap, pas de datalist) plutôt que l'implémentation.
describe('SelectRecherche', () => {
  const options = (
    <>
      <option value="">— Choisir —</option>
      <option value="a">Abidjan</option>
      <option value="y">Yamoussoukro</option>
    </>
  )

  it("n'utilise plus <datalist> (non supporté en WebView native)", () => {
    const { container } = render(<SelectRecherche value="" onChange={() => {}}>{options}</SelectRecherche>)
    expect(container.querySelector('datalist')).toBeNull()
  })

  it('ouvre la liste au focus et sélectionne une option au clic (le mousedown annule la fermeture différée du blur)', () => {
    const onChange = vi.fn()
    render(<SelectRecherche value="" onChange={onChange}>{options}</SelectRecherche>)
    const input = screen.getByPlaceholderText('— Choisir —')
    fireEvent.focus(input)
    const option = screen.getByText('Yamoussoukro')
    // Reproduit l'ordre réel des événements sur mobile : le blur du champ
    // (fermeture du clavier) survient AVANT le click sur l'option. Le
    // mousedown doit annuler la fermeture différée programmée par le blur,
    // sinon la liste se referme et le tap est ignoré ("ne prend pas").
    fireEvent.mouseDown(option)
    fireEvent.blur(input)
    fireEvent.click(option)
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ target: expect.objectContaining({ value: 'y' }) }))
  })

  it('filtre les options en tapant', () => {
    render(<SelectRecherche value="" onChange={() => {}}>{options}</SelectRecherche>)
    const input = screen.getByPlaceholderText('— Choisir —')
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'Yamo' } })
    expect(screen.getByText('Yamoussoukro')).toBeTruthy()
    expect(screen.queryByText('Abidjan')).toBeNull()
  })

  it('affiche le libellé correspondant à la value contrôlée', () => {
    render(<SelectRecherche value="a" onChange={() => {}}>{options}</SelectRecherche>)
    expect(screen.getByDisplayValue('Abidjan')).toBeTruthy()
  })
})
