import { useEffect, useState } from 'react'
import {
  getSidebarCollapsedPreference,
  setSidebarCollapsedPreference,
} from '../services/uiPreferenceService'

const DESKTOP_BREAKPOINT = 992

function getInitialCollapsedState(): boolean {
  if (typeof window === 'undefined') {
    return false
  }

  return window.innerWidth < DESKTOP_BREAKPOINT
}

export function useSidebarState(userId: string) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(getInitialCollapsedState)
  const [isLoadingSidebarPreference, setIsLoadingSidebarPreference] = useState(true)

  useEffect(() => {
    let isMounted = true

    async function loadPreference() {
      try {
        const persistedPreference = await getSidebarCollapsedPreference(userId)

        if (isMounted && typeof persistedPreference === 'boolean') {
          setIsSidebarCollapsed(persistedPreference)
        }
      } catch {
        // Falha de leitura nao deve bloquear a renderizacao.
      } finally {
        if (isMounted) {
          setIsLoadingSidebarPreference(false)
        }
      }
    }

    void loadPreference()

    return () => {
      isMounted = false
    }
  }, [userId])

  useEffect(() => {
    function handleResize() {
      if (window.innerWidth < DESKTOP_BREAKPOINT) {
        setIsSidebarCollapsed(true)
      }
    }

    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
    }
  }, [])

  function toggleSidebar() {
    setIsSidebarCollapsed((current) => {
      const nextValue = !current
      void setSidebarCollapsedPreference(userId, nextValue)
      return nextValue
    })
  }

  return {
    isSidebarCollapsed,
    isLoadingSidebarPreference,
    toggleSidebar,
  }
}
