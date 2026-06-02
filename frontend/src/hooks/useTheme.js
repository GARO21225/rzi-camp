import { useEffect } from 'react'
import { useStore } from '../store/useStore'

export function useTheme() {
  const { theme, setTheme } = useStore()
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])
  return { theme, setTheme, toggle: () => setTheme(theme === 'light' ? 'dark' : 'light') }
}
