import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signOut,
  User,
  UserCredential,
  updateProfile,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
} from 'firebase/auth'
import { auth } from '../firebase'
import { markUserLogout, upsertUserProfile } from './userProfileService'

const googleProvider = new GoogleAuthProvider()

export async function loginWithEmailAndPassword(
  email: string,
  password: string,
): Promise<UserCredential> {
  const credentials = await signInWithEmailAndPassword(auth, email, password)
  await upsertUserProfile(credentials.user)
  return credentials
}

export async function loginWithGoogle(): Promise<UserCredential> {
  const credentials = await signInWithPopup(auth, googleProvider)
  await upsertUserProfile(credentials.user)
  return credentials
}

export async function registerWithEmailAndPassword(
  name: string,
  email: string,
  password: string,
): Promise<UserCredential> {
  const credentials = await createUserWithEmailAndPassword(auth, email, password)

  if (name.trim()) {
    await updateProfile(credentials.user, { displayName: name.trim() })
  }

  await upsertUserProfile(credentials.user)
  return credentials
}

export async function logout(): Promise<void> {
  if (auth.currentUser) {
    await markUserLogout(auth.currentUser)
  }
  await signOut(auth)
}

export function observeAuthState(callback: (user: User | null) => void): () => void {
  return onAuthStateChanged(auth, callback)
}

export function friendlyAuthErrorMessage(error: unknown): string {
  const code =
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof (error as { code?: string }).code === 'string'
      ? (error as { code: string }).code
      : ''

  const message =
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof (error as { message?: string }).message === 'string'
      ? (error as { message: string }).message
      : ''

  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/user-not-found':
    case 'auth/wrong-password':
      return 'Email ou senha invalidos.'
    case 'auth/too-many-requests':
      return 'Muitas tentativas. Aguarde alguns minutos e tente novamente.'
    case 'auth/popup-closed-by-user':
      return 'A autenticacao com Google foi cancelada.'
    case 'auth/network-request-failed':
      return 'Falha de conexao. Verifique sua internet e tente novamente.'
    case 'auth/email-already-in-use':
      return 'Este email ja esta em uso. Tente entrar ou use outro email.'
    case 'auth/invalid-email':
      return 'Informe um email valido.'
    case 'auth/weak-password':
      return 'A senha deve ter pelo menos 6 caracteres.'
    case 'auth/configuration-not-found':
      return 'Configuracao de autenticacao nao encontrada no Firebase. Ative Authentication e configure o app Web no projeto.'
    case 'auth/operation-not-allowed':
      return 'Cadastro por email/senha nao esta habilitado no Firebase Authentication.'
    case 'auth/unauthorized-domain':
      return 'Dominio nao autorizado no Firebase Auth. Adicione localhost nos dominios autorizados.'
    case 'auth/invalid-api-key':
      return 'Configuracao invalida do Firebase (API Key). Verifique o arquivo .env.'
    case 'permission-denied':
      return 'Sem permissao para gravar no Firestore. Verifique as regras de seguranca.'
    case 'failed-precondition':
      return 'Firestore nao esta pronto no projeto. Crie o banco no Firebase Console.'
    default:
      if (message.includes('CONFIGURATION_NOT_FOUND')) {
        return 'Configuracao do Firebase Auth nao encontrada. Verifique se o Authentication esta habilitado e se a API key pertence ao mesmo projeto.'
      }
      return 'Nao foi possivel autenticar. Tente novamente.'
  }
}
