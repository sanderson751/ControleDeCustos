import { NextResponse } from 'next/server'
import { getApiSessionUser, unauthorizedResponse } from '@/lib/api-session'
import { type CostType } from '@/services/costService'
import { listCostsByDateRange } from '@/services/server/costService'

function serializeCostEntry(entry: Awaited<ReturnType<typeof listCostsByDateRange>>[number]) {
  return {
    ...entry,
    createdAt: entry.createdAt.toISOString(),
    updatedAt: entry.updatedAt.toISOString(),
  }
}

function parseDateRange(startDateRaw: string | null, endDateRaw: string | null) {
  if (!startDateRaw || !endDateRaw) {
    return null
  }

  const startDate = new Date(`${startDateRaw}T00:00:00.000`)
  const endDate = new Date(`${endDateRaw}T23:59:59.999`)

  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return null
  }

  if (startDate.getTime() > endDate.getTime()) {
    return null
  }

  return { startDate, endDate }
}

function parseCostType(typeRaw: string | null): CostType | undefined {
  if (typeRaw === 'fixo' || typeRaw === 'variavel') {
    return typeRaw
  }

  return undefined
}

export async function GET(request: Request) {
  const sessionUser = await getApiSessionUser()

  if (!sessionUser) {
    return unauthorizedResponse()
  }

  const { searchParams } = new URL(request.url)
  const parsedRange = parseDateRange(searchParams.get('startDate'), searchParams.get('endDate'))

  if (!parsedRange) {
    return NextResponse.json(
      { message: 'Intervalo de datas invalido. Informe data inicial e final validas.' },
      { status: 400 },
    )
  }

  const entries = await listCostsByDateRange(
    sessionUser.uid,
    parsedRange.startDate,
    parsedRange.endDate,
    parseCostType(searchParams.get('costType')),
  )

  return NextResponse.json(entries.map(serializeCostEntry))
}
