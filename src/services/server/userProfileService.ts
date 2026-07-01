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

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

type UserByEmailResult = {
  uid: string
  email: string
} | null

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

export async function findUserByEmail(email: string): Promise<UserByEmailResult> {
  const normalizedEmail = normalizeEmail(email)

  const normalizedSnapshot = await adminDb
    .collection(usersCollection)
    .where('emailNormalized', '==', normalizedEmail)
    .limit(1)
    .get()

  if (!normalizedSnapshot.empty) {
    const document = normalizedSnapshot.docs[0]
    const data = document.data()

    return {
      uid: String(data.uid ?? document.id),
      email: String(data.email ?? normalizedEmail),
    }
  }

  const exactSnapshot = await adminDb
    .collection(usersCollection)
    .where('email', '==', email.trim())
    .limit(1)
    .get()

  if (exactSnapshot.empty) {
    return null
  }

  const document = exactSnapshot.docs[0]
  const data = document.data()

  return {
    uid: String(data.uid ?? document.id),
    email: String(data.email ?? email.trim()),
  }
}

export async function isEmailRegistered(email: string): Promise<boolean> {
  const user = await findUserByEmail(email)
  return Boolean(user)
}

export async function upsertUserProfile(user: ServerUserProfileInput): Promise<UserRole> {
  const normalizedEmail = normalizeEmail(user.email)
  const emailOwner = await findUserByEmail(user.email)

  if (emailOwner && emailOwner.uid !== user.uid) {
    const error = new Error('EMAIL_ALREADY_IN_USE')
    Object.assign(error, { code: 'EMAIL_ALREADY_IN_USE' })
    throw error
  }

  const userRef = adminDb.collection(usersCollection).doc(user.uid)
  const existingSnapshot = await userRef.get()
  const role = existingSnapshot.exists
    ? normalizeRole(existingSnapshot.data()?.role)
    : await getDefaultRoleForNewUser()

  await userRef.set(
    {
      uid: user.uid,
      email: user.email.trim(),
      emailNormalized: normalizedEmail,
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