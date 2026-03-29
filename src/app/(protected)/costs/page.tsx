import CostsRoute from './CostsRoute'
import { getRequiredSession } from '@/lib/session'

export default async function CostsRoutePage() {
  const session = await getRequiredSession()

  return <CostsRoute userId={session.user.uid} role={session.user.role} />
}