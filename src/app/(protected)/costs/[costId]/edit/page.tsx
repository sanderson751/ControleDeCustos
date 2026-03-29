import { redirect } from 'next/navigation'
import CostEditRoute from './CostEditRoute'
import { getRequiredSession } from '@/lib/session'

type PageProps = {
  params: Promise<{ costId: string }>
}

export default async function CostEditRoutePage({ params }: PageProps) {
  const session = await getRequiredSession()

  if (session.user.role === 'guest') {
    redirect('/costs')
  }

  const { costId } = await params

  return <CostEditRoute costId={costId} userId={session.user.uid} role={session.user.role} />
}