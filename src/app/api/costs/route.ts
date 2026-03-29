import { NextResponse } from 'next/server'
import { forbiddenResponse, getApiSessionUser, unauthorizedResponse } from '@/lib/api-session'
import {
  createCostEntry,
  listCurrentMonthCosts,
} from '@/services/server/costService'

function serializeCostEntry(entry: Awaited<ReturnType<typeof listCurrentMonthCosts>>[number]) {
  return {
    ...entry,
    createdAt: entry.createdAt.toISOString(),
    updatedAt: entry.updatedAt.toISOString(),
  }
}

export async function GET(request: Request) {
  const sessionUser = await getApiSessionUser()

  if (!sessionUser) {
    return unauthorizedResponse()
  }

  const { searchParams } = new URL(request.url)
  const year = Number(searchParams.get('year'))
  const month = Number(searchParams.get('month'))

  if (!Number.isInteger(year) || !Number.isInteger(month)) {
    return NextResponse.json({ message: 'Ano e mes sao obrigatorios.' }, { status: 400 })
  }

  const entries = await listCurrentMonthCosts(sessionUser.uid, year, month)
  return NextResponse.json(entries.map(serializeCostEntry))
}

export async function POST(request: Request) {
  const sessionUser = await getApiSessionUser()

  if (!sessionUser) {
    return unauthorizedResponse()
  }

  if (sessionUser.role === 'guest') {
    return forbiddenResponse()
  }

  const body = await request.json()
  await createCostEntry(sessionUser.uid, {
    accountName: String(body.accountName ?? ''),
    amount: Number(body.amount ?? 0),
    costType: body.costType === 'fixo' ? 'fixo' : 'variavel',
    installmentsTotal: Number(body.installmentsTotal ?? 1),
    createdAtManual: body.createdAtManual ? new Date(String(body.createdAtManual)) : undefined,
  })

  return NextResponse.json({ ok: true }, { status: 201 })
}