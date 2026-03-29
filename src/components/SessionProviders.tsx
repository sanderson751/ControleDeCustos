'use client'

import type { Session } from 'next-auth'
import { SessionProvider } from 'next-auth/react'

type SessionProvidersProps = {
  children: React.ReactNode
  session: Session | null
}

export function SessionProviders({ children, session }: SessionProvidersProps) {
  return <SessionProvider session={session}>{children}</SessionProvider>
}