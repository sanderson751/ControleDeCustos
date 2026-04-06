import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore'
import { db } from '../firebase'

const usersCollection = 'users'
const settingsCollection = 'settings'
const profileDocId = 'profile'

export type ThemeMode = 'light' | 'dark'

function getProfileSettingsRef(userId: string) {
  return doc(db, usersCollection, userId, settingsCollection, profileDocId)
}

export async function getSidebarCollapsedPreference(userId: string): Promise<boolean | null> {
  const settingsRef = getProfileSettingsRef(userId)
  const snapshot = await getDoc(settingsRef)

  if (!snapshot.exists()) {
    return null
  }

  const data = snapshot.data() as { ui?: { sidebarCollapsed?: unknown } }
  const collapsedValue = data.ui?.sidebarCollapsed

  return typeof collapsedValue === 'boolean' ? collapsedValue : null
}

export async function setSidebarCollapsedPreference(
  userId: string,
  isCollapsed: boolean,
): Promise<void> {
  const settingsRef = getProfileSettingsRef(userId)

  await setDoc(
    settingsRef,
    {
      userId,
      'ui.sidebarCollapsed': isCollapsed,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  )
}

export async function getThemePreference(userId: string): Promise<ThemeMode | null> {
  const settingsRef = getProfileSettingsRef(userId)
  const snapshot = await getDoc(settingsRef)

  if (!snapshot.exists()) {
    return null
  }

  const data = snapshot.data() as { ui?: { theme?: unknown } }
  const themeValue = data.ui?.theme

  return themeValue === 'light' || themeValue === 'dark' ? themeValue : null
}

export async function setThemePreference(userId: string, theme: ThemeMode): Promise<void> {
  const settingsRef = getProfileSettingsRef(userId)

  await setDoc(
    settingsRef,
    {
      userId,
      'ui.theme': theme,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  )
}
