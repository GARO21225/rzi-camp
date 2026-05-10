import { create } from 'zustand'
export const useStore = create((set) => ({
  user: null, role: null, token: localStorage.getItem('access_token'),
  setUser: (user) => set({ user, role: user?.profile?.role }),
  setToken: (token) => { localStorage.setItem('access_token', token); set({ token }) },
  logout: () => { localStorage.clear(); set({ user:null, token:null, role:null }) },
}))
