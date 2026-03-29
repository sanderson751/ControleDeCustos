import { redirect } from 'next/navigation'
import type { Session } from 'next-auth'
import { auth } from '@/auth'

export type AuthenticatedSession = Session & {
  user: Session['user'] & {
    uid: string
    role: 'admin' | 'standard' | 'guest'
  }
}

export async function getRequiredSession(): Promise<AuthenticatedSession> {
  const session = await auth()

  if (!session?.user?.uid || !session.user.role) {
    redirect('/login')
  }

  return session as AuthenticatedSession
}

export async function getOptionalSession() {
  return auth()
}