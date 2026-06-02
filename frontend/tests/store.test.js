import { describe, it, expect, beforeEach } from 'vitest'
import { useStore } from '../src/store/useStore'

describe('store/useStore', () => {
  beforeEach(() => {
    // Reset store
    useStore.setState({
      user: null,
      role: null,
      token: null,
      theme: 'light',
      lang: 'fr',
    })
  })

  describe('setUser', () => {
    it('extrait le rôle depuis profile.role', () => {
      useStore.getState().setUser({ username: 'a', profile: { role: 'admin' } })
      expect(useStore.getState().role).toBe('admin')
    })

    it('fallback sur agent si pas de rôle', () => {
      useStore.getState().setUser({ username: 'a' })
      expect(useStore.getState().role).toBe('agent')
    })

    it('détecte admin via is_staff', () => {
      useStore.getState().setUser({ username: 'a', is_staff: true })
      expect(useStore.getState().role).toBe('admin')
    })

    it('détecte admin via is_superuser', () => {
      useStore.getState().setUser({ username: 'a', is_superuser: true })
      expect(useStore.getState().role).toBe('admin')
    })
  })

  describe('setToken', () => {
    it('met à jour le token', () => {
      useStore.getState().setToken('abc123')
      expect(useStore.getState().token).toBe('abc123')
    })
  })

  describe('isAdmin', () => {
    it('retourne true pour admin', () => {
      useStore.getState().setUser({ username: 'a', is_staff: true })
      expect(useStore.getState().isAdmin()).toBe(true)
    })

    it('retourne false pour agent', () => {
      useStore.getState().setUser({ username: 'a', profile: { role: 'agent' } })
      expect(useStore.getState().isAdmin()).toBe(false)
    })
  })

  describe('logout', () => {
    it('reset le user, role et token', () => {
      useStore.getState().setUser({ username: 'a', is_staff: true })
      useStore.getState().setToken('xyz')
      useStore.getState().logout()
      expect(useStore.getState().user).toBeNull()
      expect(useStore.getState().role).toBeNull()
      expect(useStore.getState().token).toBeNull()
    })
  })
})
