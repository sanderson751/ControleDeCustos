import { useEffect, useState } from 'react'
import {
  ThemeMode,
  getThemePreference,
  setThemePreference,
} from '../services/uiPreferenceService'

const DEFAULT_THEME: ThemeMode = 'light'

export function useThemeState(userId: string) {
  const [themeMode, setThemeMode] = useState<ThemeMode>(DEFAULT_THEME)
  const [isLoadingThemePreference, setIsLoadingThemePreference] = useState(true)

  useEffect(() => {
    let isMounted = true

    async function loadThemePreference() {
      try {
        const persistedTheme = await getThemePreference(userId)

        if (isMounted && persistedTheme) {
          setThemeMode(persistedTheme)
        }
      } catch {
        // Falha de leitura nao deve bloquear renderizacao.
      } finally {
        if (isMounted) {
          setIsLoadingThemePreference(false)
        }
      }
    }

    void loadThemePreference()

    return () => {
      isMounted = false
    }
  }, [userId])

  function toggleTheme() {
    setThemeMode((current) => {
      const nextTheme: ThemeMode = current === 'light' ? 'dark' : 'light'
      void setThemePreference(userId, nextTheme)
      return nextTheme
    })
  }

  return {
    themeMode,
    isLoadingThemePreference,
    toggleTheme,
  }
}
