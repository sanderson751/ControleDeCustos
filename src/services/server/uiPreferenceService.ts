import 'server-only'

import { FieldValue } from 'firebase-admin/firestore'
import { adminDb } from '@/lib/firebase-admin'
import type { ThemeMode } from '@/services/uiPreferenceService'

const usersCollection = 'users'
const settingsCollection = 'settings'
const profileDocId = 'profile'

type UiPreferences = {
  sidebarCollapsed: boolean
  theme: ThemeMode
}

function getProfileRef(userId: string) {
  return adminDb.collection(usersCollection).doc(userId).collection(settingsCollection).doc(profileDocId)
}

export async function getUiPreferences(userId: string): Promise<UiPreferences> {
  const snapshot = await getProfileRef(userId).get()
  const ui = snapshot.data()?.ui as { sidebarCollapsed?: boolean; theme?: ThemeMode } | undefined

  return {
    sidebarCollapsed: ui?.sidebarCollapsed ?? false,
    theme: ui?.theme === 'dark' ? 'dark' : 'light',
  }
}

export async function updateUiPreferences(
  userId: string,
  updates: Partial<UiPreferences>,
): Promise<UiPreferences> {
  const current = await getUiPreferences(userId)
  const nextValue = {
    sidebarCollapsed: updates.sidebarCollapsed ?? current.sidebarCollapsed,
    theme: updates.theme ?? current.theme,
  }

  await getProfileRef(userId).set(
    {
      userId,
      ui: nextValue,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  )

  return nextValue
}