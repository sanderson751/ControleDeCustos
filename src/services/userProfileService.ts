import { User } from 'firebase/auth'
import { doc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore'
import { db } from '../firebase'

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
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  )
}

export async function upsertUserProfile(user: User): Promise<void> {
  const userRef = doc(db, usersCollection, user.uid)

  const baseFields = {
    uid: user.uid,
    displayName: user.displayName ?? '',
    email: user.email ?? '',
    photoURL: user.photoURL ?? '',
    provider: resolveProvider(user),
    status: 'online',
    updatedAt: serverTimestamp(),
    lastLoginAt: serverTimestamp(),
  }

  try {
    await updateDoc(userRef, baseFields)
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
