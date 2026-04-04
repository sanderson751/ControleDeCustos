import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AuthGate from './components/AuthGate'
import {
  loginWithEmailAndPassword,
  loginWithGoogle,
  logout,
  observeAuthState,
  registerWithEmailAndPassword,
} from './services/authService'

jest.mock('./services/authService', () => ({
  loginWithEmailAndPassword: jest.fn(),
  loginWithGoogle: jest.fn(),
  logout: jest.fn(),
  observeAuthState: jest.fn(),
  registerWithEmailAndPassword: jest.fn(),
  friendlyAuthErrorMessage: jest.fn(() => 'Email ou senha invalidos.'),
}))

const mockedObserveAuthState = jest.mocked(observeAuthState)
const mockedLoginWithEmailAndPassword = jest.mocked(loginWithEmailAndPassword)
const mockedLoginWithGoogle = jest.mocked(loginWithGoogle)
const mockedRegisterWithEmailAndPassword = jest.mocked(registerWithEmailAndPassword)
const mockedLogout = jest.mocked(logout)

function fakeUser(uid: string) {
  return {
    uid,
    displayName: 'Usuario de Teste',
    email: 'teste@exemplo.com',
    photoURL: null,
    providerData: [{ providerId: 'password' }],
  } as never
}

describe('App', () => {
  beforeEach(() => {
    mockedObserveAuthState.mockImplementation((callback) => {
      callback(null)
      return jest.fn()
    })
    mockedLoginWithEmailAndPassword.mockReset()
    mockedLoginWithGoogle.mockReset()
    mockedRegisterWithEmailAndPassword.mockReset()
    mockedLogout.mockReset()
  })

  it('autentica com email e senha e redireciona para tela principal', async () => {
    const user = userEvent.setup()
    mockedLoginWithEmailAndPassword.mockResolvedValue({ user: fakeUser('uid-email') } as never)

    render(<AuthGate />)

    await user.type(screen.getByLabelText(/email/i), 'teste@exemplo.com')
    await user.type(screen.getByLabelText(/senha/i), 'Senha@123')
    await user.click(screen.getByRole('button', { name: /^entrar$/i }))

    await waitFor(() => {
      expect(screen.getByTestId('main-app-screen')).toBeInTheDocument()
    })

    expect(mockedLoginWithEmailAndPassword).toHaveBeenCalledWith(
      'teste@exemplo.com',
      'Senha@123',
    )
  })

  it('autentica com Google e redireciona para tela principal', async () => {
    const user = userEvent.setup()
    mockedLoginWithGoogle.mockResolvedValue({ user: fakeUser('uid-google') } as never)

    render(<AuthGate />)

    await user.click(screen.getByRole('button', { name: /entrar com google/i }))

    await waitFor(() => {
      expect(screen.getByTestId('main-app-screen')).toBeInTheDocument()
    })

    expect(mockedLoginWithGoogle).toHaveBeenCalledTimes(1)
  })

  it('cadastra novo usuario com email e senha e redireciona para tela principal', async () => {
    const user = userEvent.setup()
    mockedRegisterWithEmailAndPassword.mockResolvedValue({
      user: fakeUser('uid-register'),
    } as never)

    render(<AuthGate />)

    await user.click(screen.getByRole('button', { name: /criar conta/i }))
    await user.type(screen.getByLabelText(/nome/i), 'Novo Usuario')
    await user.type(screen.getByLabelText(/email/i), 'novo@exemplo.com')
    await user.type(screen.getByLabelText(/senha/i), 'Senha@123')
    await user.click(screen.getByRole('button', { name: /^criar conta$/i }))

    expect(mockedRegisterWithEmailAndPassword).toHaveBeenCalledWith(
      'Novo Usuario',
      'novo@exemplo.com',
      'Senha@123',
    )

    expect(await screen.findByTestId('main-app-screen')).toBeInTheDocument()
  })

  it('exibe mensagem amigavel em falha de autenticacao sem redirecionar', async () => {
    const user = userEvent.setup()
    mockedLoginWithEmailAndPassword.mockRejectedValue(new Error('invalid credentials'))

    render(<AuthGate />)

    await user.type(screen.getByLabelText(/email/i), 'invalido@exemplo.com')
    await user.type(screen.getByLabelText(/senha/i), 'errada')
    await user.click(screen.getByRole('button', { name: /^entrar$/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Email ou senha invalidos.')
    expect(screen.queryByTestId('main-app-screen')).not.toBeInTheDocument()
  })

  it('mantem usuario autenticado no carregamento inicial', async () => {
    mockedObserveAuthState.mockImplementation((callback) => {
      callback(fakeUser('uid-existing'))
      return jest.fn()
    })

    render(<AuthGate />)

    expect(await screen.findByTestId('main-app-screen')).toBeInTheDocument()
  })

  it('permite logout e volta para tela de login', async () => {
    const user = userEvent.setup()
    mockedObserveAuthState.mockImplementation((callback) => {
      callback(fakeUser('uid-existing'))
      return jest.fn()
    })
    mockedLogout.mockResolvedValue(undefined)

    render(<AuthGate />)

    await user.click(await screen.findByRole('button', { name: /^sair$/i }))

    expect(mockedLogout).toHaveBeenCalledTimes(1)
    expect(await screen.findByRole('button', { name: /^entrar$/i })).toBeInTheDocument()
  })
})
