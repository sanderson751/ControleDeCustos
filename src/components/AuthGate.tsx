import { useEffect, useState } from 'react'
import { User } from 'firebase/auth'
import App from '../App'
import LoginPage from '../pages/LoginPage'
import { logout, observeAuthState } from '../services/authService'

function AuthGate() {
  const [user, setUser] = useState<User | null>(null)
  const [isCheckingAuth, setIsCheckingAuth] = useState(true)

  useEffect(() => {
    const unsubscribe = observeAuthState((authenticatedUser) => {
      setUser(authenticatedUser)
      setIsCheckingAuth(false)
    })

    return unsubscribe
  }, [])

  if (isCheckingAuth) {
    return (
      <main className="container py-5" aria-live="polite">
        <p className="text-center text-muted mb-0">Validando autenticacao...</p>
      </main>
    )
  }

  if (!user) {
    return <LoginPage onAuthenticated={setUser} />
  }

  return (
    <App
      user={user}
      onLogout={async () => {
        await logout()
        setUser(null)
      }}
    />
  )
}

export default AuthGate
