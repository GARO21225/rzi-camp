import { create } from 'zustand'

// Dernier profil connu, mémorisé sur l'appareil : l'interface s'affiche
// immédiatement au lancement au lieu d'attendre /api/auth/me/ (qui le
// rafraîchit ensuite). Effacé par logout() (localStorage.clear()).
const userMemorise = (() => {
  try { return localStorage.getItem('access_token') ? JSON.parse(localStorage.getItem('rzc_user') || 'null') : null } catch { return null }
})()

export const useStore = create((set, get) => ({
  user:  userMemorise,
  role:  null,
  token: localStorage.getItem('access_token'),
  logoUrl: null, // data URI du logo custom (Paramétrage), null = logo par défaut

  setUser: (user) => {
    // Extraire le rôle depuis plusieurs sources possibles
    const role = user?.profile?.role
      || user?.profile_role
      || user?.role
      || (user?.is_superuser || user?.is_staff ? 'admin' : null)
      || 'agent'
    try { user ? localStorage.setItem('rzc_user', JSON.stringify(user)) : localStorage.removeItem('rzc_user') } catch {}
    set({ user, role })
  },

  setToken: (token) => {
    localStorage.setItem('access_token', token)
    set({ token })
  },

  setLogoUrl: (logoUrl) => set({ logoUrl }),

  logout: () => {
    localStorage.clear()
    sessionStorage.clear()
    set({ user: null, token: null, role: null })
  },

  // Helper: vérifier si l'user courant est admin
  isAdmin: () => {
    const { user, role } = get()
    return user?.is_staff === true
      || user?.is_superuser === true
      || role === 'admin'
  },
}))
