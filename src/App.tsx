import { User } from 'firebase/auth'
import { useState } from 'react'
import GlobalAppBar from './components/GlobalAppBar'
import AppShellSkeleton from './components/AppShellSkeleton'
import SidebarMenu from './components/SidebarMenu'
import WelcomeCenter from './components/WelcomeCenter'
import { UserProfileListPage } from './pages/UserProfileListPage'
import { useSidebarState } from './hooks/useSidebarState'
import { useThemeState } from './hooks/useThemeState'
import './styles/app-shell.css'
import './pages/UserProfileListPage.css'

type AppProps = {
  user: User
  onLogout: () => Promise<void>
}

function App({ user, onLogout }: AppProps) {
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [logoutError, setLogoutError] = useState('')
  const [isUserProfileListOpen, setIsUserProfileListOpen] = useState(false)
  const { isSidebarCollapsed, isLoadingSidebarPreference, toggleSidebar } = useSidebarState(user.uid)
  const { themeMode, isLoadingThemePreference, toggleTheme } = useThemeState(user.uid)

  if (isLoadingSidebarPreference || isLoadingThemePreference) {
    return <AppShellSkeleton />
  }

  async function handleLogout() {
    setLogoutError('')
    setIsLoggingOut(true)

    try {
      await onLogout()
    } catch {
      setLogoutError('Nao foi possivel sair da conta. Tente novamente.')
    } finally {
      setIsLoggingOut(false)
    }
  }

  return (
    <div className="app-shell" data-theme={themeMode} data-testid="app-shell-root">
      <GlobalAppBar
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
          isCollapsed={isSidebarCollapsed}
          onUserProfilesClick={() => setIsUserProfileListOpen(true)}
        />
        <main className="app-shell-content">
          {!isUserProfileListOpen ? (
            <>
              <WelcomeCenter user={user} />
              {logoutError && (
                <div className="container pb-4">
                  <div role="alert" aria-live="polite" className="alert alert-danger mb-0">
                    {logoutError}
                  </div>
                </div>
              )}
            </>
          ) : (
            <UserProfileListPage onClose={() => setIsUserProfileListOpen(false)} />
          )}
        </main>
      </div>
    </div>
  )
}

export default App
