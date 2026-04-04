import { User } from 'firebase/auth'
import { useState } from 'react'

type AppProps = {
  user: User
  onLogout: () => Promise<void>
}

function App({ user, onLogout }: AppProps) {
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [logoutError, setLogoutError] = useState('')

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
    <main className="container py-4" data-testid="main-app-screen">
      <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
        <h1 className="mb-0">Controle de Custos</h1>
        <button
          type="button"
          className="btn btn-outline-danger"
          onClick={handleLogout}
          disabled={isLoggingOut}
        >
          {isLoggingOut ? 'Saindo...' : 'Sair'}
        </button>
      </div>

      <div className="row justify-content-center">
        <div className="col-12 col-md-8">
          <div className="card shadow-sm border-0">
            <div className="card-body">
              <h2 className="h5 mb-3">Usuario autenticado</h2>
              <dl className="row mb-4">
                <dt className="col-sm-4">Nome</dt>
                <dd className="col-sm-8" data-testid="user-display-name">{user.displayName || 'Nao informado'}</dd>
                <dt className="col-sm-4">Email</dt>
                <dd className="col-sm-8" data-testid="user-email">{user.email || 'Nao informado'}</dd>
                <dt className="col-sm-4">UID</dt>
                <dd className="col-sm-8 text-break" data-testid="user-uid">{user.uid}</dd>
              </dl>

              <h2 className="h5">Tela principal</h2>
              <p className="mb-0 text-muted">
                Usuario autenticado com sucesso. Esta e a area principal da aplicacao.
              </p>
              {logoutError && (
                <div role="alert" aria-live="polite" className="alert alert-danger mt-3 mb-0">
                  {logoutError}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}

export default App
