import WelcomeCenter from '@/components/WelcomeCenter'
import { getRequiredSession } from '@/lib/session'

export default async function HomePage() {
  const session = await getRequiredSession()

  return <WelcomeCenter user={session.user} />
}