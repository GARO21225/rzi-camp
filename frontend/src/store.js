import { create } from 'zustand'

export const useStore = create((set, get) => ({
  user:  null,
  role:  null,
  token: localStorage.getItem('access_token'),

  setUser: (user) => {
    // Extraire le rôle depuis plusieurs sources possibles
    const role = user?.profile?.role
      || user?.profile_role
      || user?.role
      || (user?.is_superuser || user?.is_staff ? 'admin' : null)
      || 'agent'
    set({ user, role })
  },

  setToken: (token) => {
    localStorage.setItem('access_token', token)
    set({ token })
  },

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
