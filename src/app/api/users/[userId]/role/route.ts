import { NextResponse } from 'next/server'
import { forbiddenResponse, getApiSessionUser, unauthorizedResponse } from '@/lib/api-session'
import { getUserRole } from '@/services/server/userProfileService'

type RouteContext = {
  params: Promise<{ userId: string }>
}

export async function GET(_: Request, context: RouteContext) {
  const sessionUser = await getApiSessionUser()

  if (!sessionUser) {
    return unauthorizedResponse()
  }

  const { userId } = await context.params

  if (sessionUser.role !== 'admin' && sessionUser.uid !== userId) {
    return forbiddenResponse()
  }

  const role = await getUserRole(userId)
  return NextResponse.json({ role })
}