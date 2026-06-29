import ReportsRoute from './ReportsRoute'
import { getRequiredSession } from '@/lib/session'

export default async function ReportsRoutePage() {
  const session = await getRequiredSession()

  return <ReportsRoute role={session.user.role} />
}
