'use client'

import { useCallback, useEffect, useState, useTransition } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import AppShellSkeleton from './AppShellSkeleton'
import GlobalAppBar from './GlobalAppBar'
import SidebarMenu from './SidebarMenu'
import Snackbar, { type SnackbarStatus } from './Snackbar'
import { logout } from '@/services/authService'
import { useSidebarState } from '@/hooks/useSidebarState'
import { useThemeState } from '@/hooks/useThemeState'
import type { UserRole } from '@/types/rolePermission'

type AuthenticatedShellProps = {
  user: {
    uid: string
    role: UserRole
    name?: string | null
    email?: string | null
    image?: string | null
  }
  children: React.ReactNode
}

export default function AuthenticatedShell({ user, children }: AuthenticatedShellProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [isRouteTransitionPending, startRouteTransition] = useTransition()
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [pendingRoutePath, setPendingRoutePath] = useState<string | null>(null)
  const [snackbar, setSnackbar] = useState<{
    open: boolean
    status: SnackbarStatus
    message: string
  }>({
    open: false,
    status: 'success',
    message: '',
  })
  const { isSidebarCollapsed, isLoadingSidebarPreference, toggleSidebar } = useSidebarState(user.uid)
  const { themeMode, isLoadingThemePreference, themePersistenceError, toggleTheme } =
    useThemeState(user.uid)

  const showSnackbar = useCallback((status: SnackbarStatus, message: string) => {
    setSnackbar({ open: true, status, message })
  }, [])

  useEffect(() => {
    if (themePersistenceError) {
      showSnackbar('warning', themePersistenceError)
    }
  }, [themePersistenceError, showSnackbar])

  useEffect(() => {
    if (pendingRoutePath && pathname === pendingRoutePath) {
      setPendingRoutePath(null)
    }
  }, [pathname, pendingRoutePath])

  const handleNavigate = useCallback(
    (path: string) => {
      if (path === pathname) {
        return
      }

      setPendingRoutePath(path)
      startRouteTransition(() => {
        router.push(path)
      })
    },
    [pathname, router],
  )

  const isContentLoading =
    isLoadingSidebarPreference ||
    isLoadingThemePreference ||
    isRouteTransitionPending ||
    Boolean(pendingRoutePath)

  async function handleLogout() {
    setIsLoggingOut(true)

    try {
      await logout()
    } catch {
      showSnackbar('error', 'Nao foi possivel sair da conta. Tente novamente.')
    } finally {
      setIsLoggingOut(false)
    }
  }

  return (
    <div className="app-shell" data-theme={themeMode} data-testid="app-shell-root">
      <GlobalAppBar
        user={user}
        isSidebarCollapsed={isSidebarCollapsed}
        themeMode={themeMode}
        isLoggingOut={isLoggingOut}
        onToggleSidebar={toggleSidebar}
        onToggleTheme={toggleTheme}
        onLogout={handleLogout}
      />

      <div className="app-shell-body">
        <SidebarMenu
          userId={user.uid}
          role={user.role}
          isCollapsed={isSidebarCollapsed}
          currentPath={pathname}
          onNavigate={handleNavigate}
        />
        <main className="app-shell-content">{isContentLoading ? <AppShellSkeleton /> : children}</main>
      </div>

      <Snackbar
        open={snackbar.open}
        status={snackbar.status}
        message={snackbar.message}
        onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
      />
    </div>
  )
}