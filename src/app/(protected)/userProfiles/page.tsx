import { redirect } from 'next/navigation'
import { UserProfileListPage } from '@/views/UserProfileListPage'
import { getRequiredSession } from '@/lib/session'

export default async function UserProfilesPage() {
  const session = await getRequiredSession()

  if (session.user.role !== 'admin') {
    redirect('/home')
  }

  return <UserProfileListPage />
}