type CredentialsAuthorize = (credentials: {
  email?: string
  password?: string
}) => Promise<unknown>

type SignInCallback = (params: {
  user: {
    id?: string | null
    email?: string | null
    name?: string | null
    image?: string | null
  }
  account?: {
    provider?: string
  } | null
}) => Promise<boolean | string>

type AuthConfigShape = {
  providers: Array<{
    id?: string
    authorize?: CredentialsAuthorize
  }>
  callbacks: {
    signIn: SignInCallback
  }
}

const mockNextAuth = jest.fn()

jest.mock('next-auth', () => ({
  __esModule: true,
  default: (...args: unknown[]) => mockNextAuth(...args),
}))

jest.mock('next-auth/providers/credentials', () => ({
  __esModule: true,
  default: (options: object) => ({
    id: 'credentials',
    ...options,
  }),
}))

jest.mock('next-auth/providers/google', () => ({
  __esModule: true,
  default: (options: object) => ({
    id: 'google',
    ...options,
  }),
}))

const cookiesGetMock = jest.fn()

jest.mock('next/headers', () => ({
  cookies: () => ({
    get: cookiesGetMock,
  }),
}))

jest.mock('@/services/server/userProfileService', () => ({
  findUserByEmail: jest.fn(),
  getUserRole: jest.fn(),
  upsertUserProfile: jest.fn(),
}))

import { findUserByEmail, upsertUserProfile } from '@/services/server/userProfileService'

const mockedFindUserByEmail = jest.mocked(findUserByEmail)
const mockedUpsertUserProfile = jest.mocked(upsertUserProfile)

const fetchMock = jest.fn()
Object.defineProperty(global, 'fetch', {
  value: fetchMock,
  writable: true,
})

let capturedConfig: AuthConfigShape

function getCredentialsAuthorize(): CredentialsAuthorize {
  const credentialsProvider = capturedConfig.providers.find((provider) => provider.id === 'credentials')

  if (!credentialsProvider?.authorize) {
    throw new Error('Credentials provider nao encontrado no auth config.')
  }

  return credentialsProvider.authorize
}

describe('auth configuration', () => {
  beforeAll(async () => {
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY = 'test-key'

    mockNextAuth.mockImplementation((config: AuthConfigShape) => {
      capturedConfig = config

      return {
        handlers: {
          GET: jest.fn(),
          POST: jest.fn(),
        },
        auth: jest.fn(),
        signIn: jest.fn(),
        signOut: jest.fn(),
      }
    })

    await import('./auth')
  })

  beforeEach(() => {
    jest.clearAllMocks()
    cookiesGetMock.mockReturnValue({ value: 'login' })
  })

  it('retorna USER_NOT_FOUND quando email nao existe no login por credenciais', async () => {
    const authorize = getCredentialsAuthorize()

    fetchMock.mockResolvedValue({
      ok: false,
      json: async () => ({
        error: {
          message: 'EMAIL_NOT_FOUND',
        },
      }),
    })

    await expect(
      authorize({
        email: 'nao-existe@empresa.com',
        password: '123456',
      }),
    ).rejects.toThrow('USER_NOT_FOUND')

    expect(mockedFindUserByEmail).not.toHaveBeenCalled()
  })

  it('retorna INVALID_CREDENTIALS quando email existe e senha esta incorreta', async () => {
    const authorize = getCredentialsAuthorize()

    fetchMock.mockResolvedValue({
      ok: false,
      json: async () => ({
        error: {
          message: 'INVALID_PASSWORD',
        },
      }),
    })

    mockedFindUserByEmail.mockResolvedValue({
      uid: 'uid-existente',
      email: 'existente@empresa.com',
    })

    await expect(
      authorize({
        email: 'existente@empresa.com',
        password: 'senha-errada',
      }),
    ).rejects.toThrow('INVALID_CREDENTIALS')
  })

  it('permite login Google no escopo de entrar quando email ja existe na base', async () => {
    mockedFindUserByEmail.mockResolvedValue({
      uid: 'uid-antigo',
      email: 'mesmo-email@empresa.com',
    })

    const result = await capturedConfig.callbacks.signIn({
      user: {
        id: 'uid-google-novo',
        email: 'mesmo-email@empresa.com',
      },
      account: {
        provider: 'google',
      },
    })

    expect(result).toBe(true)
    expect(mockedUpsertUserProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        uid: 'uid-antigo',
        email: 'mesmo-email@empresa.com',
        provider: 'google',
      }),
    )
  })

  it('bloqueia login Google no escopo de criar conta quando email ja existe na base', async () => {
    cookiesGetMock.mockReturnValue({ value: 'register' })

    mockedFindUserByEmail.mockResolvedValue({
      uid: 'uid-antigo',
      email: 'mesmo-email@empresa.com',
    })

    const result = await capturedConfig.callbacks.signIn({
      user: {
        id: 'uid-google-novo',
        email: 'mesmo-email@empresa.com',
      },
      account: {
        provider: 'google',
      },
    })

    expect(result).toBe('/login?error=EMAIL_EXISTS')
    expect(mockedUpsertUserProfile).not.toHaveBeenCalled()
  })

  it('permite login Google quando email pertence ao mesmo uid', async () => {
    mockedFindUserByEmail.mockResolvedValue({
      uid: 'uid-google-ok',
      email: 'ok@empresa.com',
    })

    const result = await capturedConfig.callbacks.signIn({
      user: {
        id: 'uid-google-ok',
        email: 'ok@empresa.com',
        name: 'Usuario Ok',
      },
      account: {
        provider: 'google',
      },
    })

    expect(result).toBe(true)
    expect(mockedUpsertUserProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        uid: 'uid-google-ok',
        email: 'ok@empresa.com',
        provider: 'google',
      }),
    )
  })
})
