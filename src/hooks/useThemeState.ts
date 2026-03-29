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
  const [themePersistenceError, setThemePersistenceError] = useState('')

  function persistThemePreference(nextTheme: ThemeMode, fallbackTheme: ThemeMode) {
    setThemePersistenceError('')

    void setThemePreference(userId, nextTheme)
      .then(() => {
        setThemePersistenceError('')
      })
      .catch(() => {
        setThemeMode(fallbackTheme)
        setThemePersistenceError('Nao foi possivel salvar sua preferencia de tema.')
      })
  }

  useEffect(() => {
    let isMounted = true

    async function loadThemePreference() {
      setThemePersistenceError('')

      try {
        const persistedTheme = await getThemePreference(userId)

        if (isMounted && persistedTheme) {
          setThemeMode(persistedTheme)
        } else if (isMounted) {
          // Garante que a preferencia padrao tambem fique registrada no banco.
          void setThemePreference(userId, DEFAULT_THEME).catch(() => {
            if (isMounted) {
              setThemePersistenceError('Nao foi possivel salvar sua preferencia de tema.')
            }
          })
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
      persistThemePreference(nextTheme, current)
      return nextTheme
    })
  }

  return {
    themeMode,
    isLoadingThemePreference,
    themePersistenceError,
    toggleTheme,
  }
}
