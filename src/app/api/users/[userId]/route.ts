import { NextResponse } from 'next/server'
import { forbiddenResponse, getApiSessionUser, unauthorizedResponse } from '@/lib/api-session'
import { loadUser, updateUserProfile } from '@/services/server/userListService'

function serializeUserProfile(user: NonNullable<Awaited<ReturnType<typeof loadUser>>>) {
  return {
    ...user,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  }
}

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

  const user = await loadUser(userId)

  if (!user) {
    return NextResponse.json({ message: 'Usuario nao encontrado.' }, { status: 404 })
  }

  return NextResponse.json(serializeUserProfile(user))
}

export async function PATCH(request: Request, context: RouteContext) {
  const sessionUser = await getApiSessionUser()

  if (!sessionUser) {
    return unauthorizedResponse()
  }

  if (sessionUser.role !== 'admin') {
    return forbiddenResponse()
  }

  const { userId } = await context.params
  const body = (await request.json()) as { displayName?: string; role?: 'admin' | 'standard' | 'guest' }
  const updatedUser = await updateUserProfile(userId, {
    displayName: String(body.displayName ?? ''),
    role: body.role === 'admin' || body.role === 'standard' || body.role === 'guest' ? body.role : 'standard',
  })

  if (!updatedUser) {
    return NextResponse.json({ message: 'Usuario nao encontrado.' }, { status: 404 })
  }

  return NextResponse.json(serializeUserProfile(updatedUser))
}