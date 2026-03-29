import AuthenticatedShell from '@/components/AuthenticatedShell'
import { getRequiredSession } from '@/lib/session'

type ProtectedLayoutProps = {
  children: React.ReactNode
}

export default async function ProtectedLayout({ children }: ProtectedLayoutProps) {
  const session = await getRequiredSession()

  return <AuthenticatedShell user={session.user}>{children}</AuthenticatedShell>
}