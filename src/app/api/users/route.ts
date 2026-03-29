import { NextResponse } from 'next/server'
import { forbiddenResponse, getApiSessionUser, unauthorizedResponse } from '@/lib/api-session'
import { loadAllUsers } from '@/services/server/userListService'

function serializeUserProfile(user: Awaited<ReturnType<typeof loadAllUsers>>[number]) {
  return {
    ...user,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  }
}

export async function GET(request: Request) {
  const sessionUser = await getApiSessionUser()

  if (!sessionUser) {
    return unauthorizedResponse()
  }

  if (sessionUser.role !== 'admin') {
    return forbiddenResponse()
  }

  const { searchParams } = new URL(request.url)
  const roleParam = searchParams.get('role')
  const role = roleParam === 'admin' || roleParam === 'standard' || roleParam === 'guest' ? roleParam : undefined
  const users = await loadAllUsers(role)

  return NextResponse.json(users.map(serializeUserProfile))
}