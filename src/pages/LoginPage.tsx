import { FormEvent, useState } from 'react'
import Icon from '@mdi/react'
import {
  mdiAccountCheckOutline,
  mdiAccountPlusOutline,
  mdiGoogle,
  mdiLogin,
} from '@mdi/js'
import { User } from 'firebase/auth'
import {
  friendlyAuthErrorMessage,
  loginWithEmailAndPassword,
  loginWithGoogle,
  registerWithEmailAndPassword,
} from '../services/authService'

const BUTTON_ICON_SIZE = 0.9

type LoginPageProps = {
  onAuthenticated: (user: User) => void
}

function LoginPage({ onAuthenticated }: LoginPageProps) {
  const [isRegisterMode, setIsRegisterMode] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [isLoadingEmailLogin, setIsLoadingEmailLogin] = useState(false)
  const [isLoadingGoogleLogin, setIsLoadingGoogleLogin] = useState(false)

  async function handleEmailLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErrorMessage('')
    setIsLoadingEmailLogin(true)

    try {
      const credentials = isRegisterMode
        ? await registerWithEmailAndPassword(name, email.trim(), password)
        : await loginWithEmailAndPassword(email.trim(), password)
      onAuthenticated(credentials.user)
    } catch (error) {
      if (process.env.NODE_ENV !== 'test') {
        // Mantem detalhes tecnicos no console apenas para diagnostico local.
        console.error('Falha no fluxo de autenticacao/cadastro', error)
      }
      setErrorMessage(friendlyAuthErrorMessage(error))
    } finally {
      setIsLoadingEmailLogin(false)
    }
  }

  async function handleGoogleLogin() {
    setErrorMessage('')
    setIsLoadingGoogleLogin(true)

    try {
      const credentials = await loginWithGoogle()
      onAuthenticated(credentials.user)
    } catch (error) {
      if (process.env.NODE_ENV !== 'test') {
        console.error('Falha no login com Google', error)
      }
      setErrorMessage(friendlyAuthErrorMessage(error))
    } finally {
      setIsLoadingGoogleLogin(false)
    }
  }

  return (
    <main className="container py-5">
      <div className="row justify-content-center">
        <div className="col-12 col-sm-10 col-md-8 col-lg-5">
          <div className="card shadow-sm border-0">
            <div className="card-body p-4 p-md-5">
              <h1 className="h3 text-center mb-4">
                {isRegisterMode ? 'Criar conta no Controle de Custos' : 'Entrar no Controle de Custos'}
              </h1>

              <div className="d-flex justify-content-center gap-2 mb-4" role="tablist" aria-label="Modo de autenticacao">
                <button
                  type="button"
                  className={`btn ${isRegisterMode ? 'btn-outline-primary' : 'btn-primary'}`}
                  onClick={() => {
                    setIsRegisterMode(false)
                    setErrorMessage('')
                  }}
                  disabled={isLoadingEmailLogin || isLoadingGoogleLogin}
                >
                  <span className="btn-icon-label">
                    <Icon path={mdiAccountCheckOutline} size={BUTTON_ICON_SIZE} aria-hidden="true" />
                    Ja tenho conta
                  </span>
                </button>
                <button
                  type="button"
                  className={`btn ${isRegisterMode ? 'btn-primary' : 'btn-outline-primary'}`}
                  onClick={() => {
                    setIsRegisterMode(true)
                    setErrorMessage('')
                  }}
                  disabled={isLoadingEmailLogin || isLoadingGoogleLogin}
                >
                  <span className="btn-icon-label">
                    <Icon path={mdiAccountPlusOutline} size={BUTTON_ICON_SIZE} aria-hidden="true" />
                    Quero criar conta
                  </span>
                </button>
              </div>

              {errorMessage && (
                <div role="alert" aria-live="polite" className="alert alert-danger">
                  {errorMessage}
                </div>
              )}

              <form onSubmit={handleEmailLogin} noValidate>
                {isRegisterMode && (
                  <div className="mb-3">
                    <label htmlFor="name" className="form-label">
                      Nome
                    </label>
                    <input
                      id="name"
                      type="text"
                      className="form-control"
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      autoComplete="name"
                      disabled={isLoadingEmailLogin || isLoadingGoogleLogin}
                    />
                  </div>
                )}

                <div className="mb-3">
                  <label htmlFor="email" className="form-label">
                    Email
                  </label>
                  <input
                    id="email"
                    type="email"
                    className="form-control"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                    autoComplete="email"
                    disabled={isLoadingEmailLogin || isLoadingGoogleLogin}
                  />
                </div>

                <div className="mb-4">
                  <label htmlFor="password" className="form-label">
                    Senha
                  </label>
                  <input
                    id="password"
                    type="password"
                    className="form-control"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                    autoComplete="current-password"
                    disabled={isLoadingEmailLogin || isLoadingGoogleLogin}
                  />
                </div>

                <div className="d-grid gap-2">
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={isLoadingEmailLogin || isLoadingGoogleLogin}
                  >
                    <span className="btn-icon-label centered">
                      <Icon
                        path={isRegisterMode ? mdiAccountPlusOutline : mdiLogin}
                        size={BUTTON_ICON_SIZE}
                        aria-hidden="true"
                      />
                      {isLoadingEmailLogin
                        ? isRegisterMode
                          ? 'Criando conta...'
                          : 'Entrando...'
                        : isRegisterMode
                          ? 'Criar conta'
                          : 'Entrar'}
                    </span>
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline-secondary"
                    onClick={handleGoogleLogin}
                    disabled={isLoadingEmailLogin || isLoadingGoogleLogin}
                  >
                    <span className="btn-icon-label centered">
                      <Icon path={mdiGoogle} size={BUTTON_ICON_SIZE} aria-hidden="true" />
                      {isLoadingGoogleLogin ? 'Conectando com Google...' : 'Entrar com Google'}
                    </span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}

export default LoginPage
