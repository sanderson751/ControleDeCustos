import { requestJson } from './httpClient'
import { type UserRole, type UserProfile } from '../types/rolePermission'

type SerializedUserProfile = Omit<UserProfile, 'createdAt' | 'updatedAt'> & {
  createdAt: string
  updatedAt: string
}

function toUserProfile(data: SerializedUserProfile): UserProfile {
  return {
    ...data,
    createdAt: new Date(data.createdAt),
    updatedAt: new Date(data.updatedAt),
  }
}

/**
 * Carrega todos os usuários do sistema (apenas para admin)
 * REQUER: Firestore Rules permitir leitura de 'users' para admin
 */
export async function loadAllUsers(): Promise<UserProfile[]> {
  const users = await requestJson<SerializedUserProfile[]>('/api/users')
  return users.map(toUserProfile)
}

/**
 * Carrega um usuário específico pelo ID
 */
export async function loadUser(userId: string): Promise<UserProfile | null> {
  try {
    const user = await requestJson<SerializedUserProfile>(`/api/users/${userId}`)
    return toUserProfile(user)
  } catch (error) {
    if (error instanceof Error && 'status' in error && (error as { status?: number }).status === 404) {
      return null
    }

    throw error
  }
}

/**
 * Carrega usuários por role (para análise/filtros)
 */
export async function loadUsersByRole(role: UserRole): Promise<UserProfile[]> {
  const users = await requestJson<SerializedUserProfile[]>(`/api/users?role=${role}`)
  return users.map(toUserProfile)
}

/**
 * Atualiza dados editáveis de um usuário (displayName e role)
 */
export async function updateUserProfile(
  userId: string,
  updates: { displayName: string; role: UserRole }
): Promise<void> {
  await requestJson(`/api/users/${userId}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  })
}
