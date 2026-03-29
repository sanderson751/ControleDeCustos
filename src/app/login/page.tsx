import { redirect } from 'next/navigation'
import LoginPage from '@/views/LoginPage'
import { getOptionalSession } from '@/lib/session'

export default async function LoginRoute() {
  const session = await getOptionalSession()

  if (session?.user) {
    redirect('/home')
  }

  return <LoginPage />
}