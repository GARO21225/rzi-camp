import { create } from 'zustand'

export const useStore = create((set, get) => ({
  user: null,
  role: null,
  token: localStorage.getItem('access_token'),
  theme: localStorage.getItem('theme') || 'light',
  lang: localStorage.getItem('lang') || 'fr',

  setUser: (user) => {
    const role = user?.profile?.role
      || user?.profile_role
      || user?.role
      || (user?.is_superuser || user?.is_staff ? 'admin' : null)
      || 'agent'
    set({ user, role })
  },
  setToken: (token) => {
    if (token) localStorage.setItem('access_token', token)
    set({ token })
  },
  logout: () => {
    localStorage.clear()
    sessionStorage.clear()
    set({ user: null, token: null, role: null })
  },
  setTheme: (theme) => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('theme', theme)
    set({ theme })
  },
  setLang: (lang) => {
    localStorage.setItem('lang', lang)
    set({ lang })
  },

  isAdmin: () => {
    const { user, role } = get()
    return user?.is_staff === true || user?.is_superuser === true || role === 'admin'
  },
}))
