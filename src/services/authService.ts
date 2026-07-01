import { signIn, signOut } from 'next-auth/react'
import { HttpError, requestJson } from './httpClient'

type CredentialsResult = {
  ok: boolean
  error?: string
}

export async function loginWithEmailAndPassword(email: string, password: string) {
  const result = (await signIn('credentials', {
    email,
    password,
    redirect: false,
  })) as CredentialsResult | undefined

  if (!result?.ok) {
    throw new Error(result?.error ?? 'CredentialsSignin')
  }

  return result
}

export async function loginWithGoogle(callbackUrl = '/home') {
  await signIn('google', { callbackUrl })
}

export async function registerWithEmailAndPassword(name: string, email: string, password: string) {
  await requestJson<{ ok: true }>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ name, email, password }),
  })
}

export async function logout(): Promise<void> {
  await signOut({ callbackUrl: '/login' })
}

export function friendlyAuthErrorMessage(error: unknown): string {
  if (error instanceof HttpError) {
    switch (error.code) {
      case 'EMAIL_EXISTS':
        return 'Este email ja esta em uso. Tente entrar ou use outro email.'
      case 'INVALID_EMAIL':
        return 'Informe um email valido.'
      case 'WEAK_PASSWORD':
        return 'A senha deve ter pelo menos 6 caracteres.'
      case 'FIREBASE_API_KEY_MISSING':
        return 'Configuracao invalida do Firebase (API Key). Verifique o arquivo .env.'
      default:
        return error.message
    }
  }

  const message = error instanceof Error ? error.message : String(error ?? '')

  switch (message) {
    case 'CredentialsSignin':
      return 'Email ou senha invalidos.'
    case 'USER_NOT_FOUND':
      return 'Usuario nao existe.'
    case 'INVALID_CREDENTIALS':
      return 'As informacoes estao incorretas.'
    case 'EMAIL_EXISTS':
    case 'EMAIL_ALREADY_IN_USE':
      return 'Este email ja esta em uso. Tente entrar ou use outro email.'
    case 'AccessDenied':
      return 'Nao foi possivel autenticar neste momento.'
    case 'FIREBASE_API_KEY_MISSING':
      return 'Configuracao invalida do Firebase (API Key). Verifique o arquivo .env.'
    default:
      return 'Nao foi possivel autenticar. Tente novamente.'
  }
}
