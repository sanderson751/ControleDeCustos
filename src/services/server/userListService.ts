import 'server-only'

import { FieldValue } from 'firebase-admin/firestore'
import { adminDb } from '@/lib/firebase-admin'
import type { UserProfile, UserRole } from '@/types/rolePermission'

function toUserProfile(userId: string, data: Record<string, unknown>): UserProfile {
  const createdAtValue = data.createdAt as { toDate?: () => Date } | undefined
  const updatedAtValue = data.updatedAt as { toDate?: () => Date } | undefined

  return {
    userId,
    email: String(data.email ?? ''),
    displayName: String(data.displayName ?? ''),
    role:
      data.role === 'admin' || data.role === 'standard' || data.role === 'guest'
        ? data.role
        : 'standard',
    createdAt: createdAtValue?.toDate?.() ?? new Date(),
    updatedAt: updatedAtValue?.toDate?.() ?? new Date(),
  }
}

export async function loadAllUsers(role?: UserRole): Promise<UserProfile[]> {
  const usersCollection = adminDb.collection('users')
  const snapshot = role
    ? await usersCollection.where('role', '==', role).get()
    : await usersCollection.get()

  return snapshot.docs.map((docSnapshot) => toUserProfile(docSnapshot.id, docSnapshot.data()))
}

export async function loadUser(userId: string): Promise<UserProfile | null> {
  const snapshot = await adminDb.collection('users').doc(userId).get()

  if (!snapshot.exists) {
    return null
  }

  return toUserProfile(snapshot.id, snapshot.data() ?? {})
}

export async function updateUserProfile(
  userId: string,
  updates: { displayName: string; role: UserRole },
) {
  await adminDb
    .collection('users')
    .doc(userId)
    .set(
      {
        displayName: updates.displayName.trim(),
        role: updates.role,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    )

  return loadUser(userId)
}