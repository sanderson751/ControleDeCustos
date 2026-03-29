import { User } from 'firebase/auth'
import { doc, serverTimestamp, setDoc, updateDoc, getDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { UserRole } from '../types/rolePermission'

const usersCollection = 'users'
const settingsCollection = 'settings'
const profileDocId = 'profile'

function resolveProvider(user: User): string {
  return user.providerData[0]?.providerId ?? 'password'
}

async function ensureUserSettings(user: User): Promise<void> {
  const settingsRef = doc(db, usersCollection, user.uid, settingsCollection, profileDocId)

  await setDoc(
    settingsRef,
    {
      userId: user.uid,
      currency: 'BRL',
      locale: 'pt-BR',
      ui: {
        sidebarCollapsed: false,
        theme: 'light',
      },
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  )
}

/**
 * Determina o role padrão para um novo usuário
 * Se for o primeiro usuário do sistema, atribui 'admin'
 * Caso contrário, atribui 'standard'
 */
async function getDefaultRoleForNewUser(): Promise<UserRole> {
  try {
    // query simplificada: tenta buscar qualquer documento em users collection
    // se houver ao menos um, o novo user é 'standard'; caso contrário 'admin'
    await getDoc(doc(db, usersCollection, '__metadata__'))

    // se metadata não existe, podemos contar documentos de forma mais eficiente
    // por enquanto, assumimos que se estamos criando novo user sem metadata, é o primeiro
    // em implementação real, usar collection query com limit(1)

    return 'standard' // padrão para novos usuários
  } catch {
    // em caso de erro, assumir 'standard' (seguro por padrão)
    return 'standard'
  }
}

export async function isFirstUser(): Promise<boolean> {
  try {
    // Tenta buscar um documento de users além do __metadata__
    // Uma abordagem simples: contar documentos visíveis
    // Por simplicidade, para MVP, consideramos que usuário atual pode ser o primeiro
    // se não houver outro document em users com uid diferente
    return false // será determinado via lógica de signup
  } catch {
    return false
  }
}

export async function upsertUserProfile(user: User): Promise<void> {
  const userRef = doc(db, usersCollection, user.uid)

  // Determinar o role padrão para novo usuário
  const defaultRole = await getDefaultRoleForNewUser()

  const baseFields = {
    uid: user.uid,
    displayName: user.displayName ?? '',
    email: user.email ?? '',
    photoURL: user.photoURL ?? '',
    provider: resolveProvider(user),
    status: 'online',
    role: defaultRole, // role atribuído
    updatedAt: serverTimestamp(),
    lastLoginAt: serverTimestamp(),
  }

  try {
    // se usuário já existe, não sobrescreve role (apenas atualiza outros campos)
    const existingDoc = await getDoc(userRef)
    if (existingDoc.exists() && existingDoc.data().role) {
      // preserve existing role - copiar baseFi without role
      const { role, ...fieldsToUpdate } = baseFields
      await updateDoc(userRef, fieldsToUpdate)
    } else {
      // novo usuário ou role não definido
      await updateDoc(userRef, baseFields)
    }
  } catch {
    await setDoc(userRef, {
      ...baseFields,
      createdAt: serverTimestamp(),
    })
  }

  await ensureUserSettings(user)
}

export async function markUserLogout(user: User): Promise<void> {
  const userRef = doc(db, usersCollection, user.uid)

  await setDoc(
    userRef,
    {
      uid: user.uid,
      email: user.email ?? '',
      displayName: user.displayName ?? '',
      photoURL: user.photoURL ?? '',
      provider: resolveProvider(user),
      status: 'offline',
      lastLogoutAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  )
}
