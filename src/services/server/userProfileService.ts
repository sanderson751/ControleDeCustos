import 'server-only'

import { FieldValue } from 'firebase-admin/firestore'
import { adminDb } from '@/lib/firebase-admin'
import type { UserRole } from '@/types/rolePermission'

type ServerUserProfileInput = {
  uid: string
  email: string
  displayName: string
  photoURL?: string
  provider?: string
}

const usersCollection = 'users'
const settingsCollection = 'settings'
const profileDocId = 'profile'

function normalizeRole(role: unknown): UserRole {
  return role === 'admin' || role === 'standard' || role === 'guest' ? role : 'standard'
}

async function ensureUserSettings(userId: string) {
  await adminDb
    .collection(usersCollection)
    .doc(userId)
    .collection(settingsCollection)
    .doc(profileDocId)
    .set(
      {
        userId,
        currency: 'BRL',
        locale: 'pt-BR',
        ui: {
          sidebarCollapsed: false,
          theme: 'light',
        },
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    )
}

async function getDefaultRoleForNewUser(): Promise<UserRole> {
  const existingUsersSnapshot = await adminDb.collection(usersCollection).limit(1).get()
  return existingUsersSnapshot.empty ? 'admin' : 'standard'
}

export async function getUserRole(userId: string): Promise<UserRole> {
  const snapshot = await adminDb.collection(usersCollection).doc(userId).get()
  return normalizeRole(snapshot.data()?.role)
}

export async function upsertUserProfile(user: ServerUserProfileInput): Promise<UserRole> {
  const userRef = adminDb.collection(usersCollection).doc(user.uid)
  const existingSnapshot = await userRef.get()
  const role = existingSnapshot.exists
    ? normalizeRole(existingSnapshot.data()?.role)
    : await getDefaultRoleForNewUser()

  await userRef.set(
    {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      photoURL: user.photoURL ?? '',
      provider: user.provider ?? 'credentials',
      role,
      status: 'online',
      updatedAt: FieldValue.serverTimestamp(),
      lastLoginAt: FieldValue.serverTimestamp(),
      ...(existingSnapshot.exists ? {} : { createdAt: FieldValue.serverTimestamp() }),
    },
    { merge: true },
  )

  await ensureUserSettings(user.uid)

  return role
}