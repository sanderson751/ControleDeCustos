import { NextResponse } from 'next/server'
import { forbiddenResponse, getApiSessionUser, unauthorizedResponse } from '@/lib/api-session'
import {
  deleteCostEntry,
  getCostEntryById,
  updateCostEntry,
} from '@/services/server/costService'

function serializeCostEntry(entry: NonNullable<Awaited<ReturnType<typeof getCostEntryById>>>) {
  return {
    ...entry,
    createdAt: entry.createdAt.toISOString(),
    updatedAt: entry.updatedAt.toISOString(),
  }
}

type RouteContext = {
  params: Promise<{ costId: string }>
}

export async function GET(_: Request, context: RouteContext) {
  const sessionUser = await getApiSessionUser()

  if (!sessionUser) {
    return unauthorizedResponse()
  }

  const { costId } = await context.params
  const entry = await getCostEntryById(sessionUser.uid, costId)

  if (!entry) {
    return NextResponse.json({ message: 'Custo nao encontrado.' }, { status: 404 })
  }

  return NextResponse.json(serializeCostEntry(entry))
}

export async function PATCH(request: Request, context: RouteContext) {
  const sessionUser = await getApiSessionUser()

  if (!sessionUser) {
    return unauthorizedResponse()
  }

  if (sessionUser.role === 'guest') {
    return forbiddenResponse()
  }

  const { costId } = await context.params
  const body = await request.json()
  await updateCostEntry(sessionUser.uid, costId, {
    accountName: String(body.accountName ?? ''),
    amount: Number(body.amount ?? 0),
    costType: body.costType === 'fixo' ? 'fixo' : 'variavel',
    installmentsTotal: Number(body.installmentsTotal ?? 1),
  })

  return NextResponse.json({ ok: true })
}

export async function DELETE(_: Request, context: RouteContext) {
  const sessionUser = await getApiSessionUser()

  if (!sessionUser) {
    return unauthorizedResponse()
  }

  if (sessionUser.role === 'guest') {
    return forbiddenResponse()
  }

  const { costId } = await context.params
  await deleteCostEntry(sessionUser.uid, costId)

  return NextResponse.json({ ok: true })
}