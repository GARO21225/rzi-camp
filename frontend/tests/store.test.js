import { describe, it, expect, beforeEach } from 'vitest'
import { useStore } from '../src/store'

describe('Store (zustand)', () => {
  beforeEach(() => {
    useStore.setState({ user: null, token: null, role: null })
  })

  it('initial state vide', () => {
    const s = useStore.getState()
    expect(s.user).toBeNull()
    expect(s.token).toBeNull()
  })

  it('setUser / setToken fonctionnent', () => {
    useStore.getState().setUser({ id: 1, username: 'admin', is_superuser: true })
    useStore.getState().setToken('fake-token')
    const s = useStore.getState()
    expect(s.user).toEqual({ id: 1, username: 'admin', is_superuser: true })
    expect(s.token).toBe('fake-token')
  })

  it('logout reset tout', () => {
    useStore.getState().setToken('abc')
    useStore.getState().setUser({ id: 1 })
    useStore.getState().logout()
    const s = useStore.getState()
    expect(s.token).toBeNull()
    expect(s.user).toBeNull()
  })

  it('role detecte pour superuser', () => {
    useStore.getState().setUser({ id: 1, is_superuser: true, profile: { role: 'admin' } })
    const s = useStore.getState()
    expect(s.role).toBe('admin')
  })
})
