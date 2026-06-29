import { requestJson } from './httpClient'
import { type CostEntry, type CostType } from './costService'

type SerializedCostEntry = Omit<CostEntry, 'createdAt' | 'updatedAt'> & {
  createdAt: string
  updatedAt: string
}

export type ReportsFilter = {
  startDate: string
  endDate: string
  costType: 'todos' | CostType
}

function toCostEntry(data: SerializedCostEntry): CostEntry {
  return {
    ...data,
    createdAt: new Date(data.createdAt),
    updatedAt: new Date(data.updatedAt),
  }
}

export async function listCostsForReport(filter: ReportsFilter): Promise<CostEntry[]> {
  const params = new URLSearchParams({
    startDate: filter.startDate,
    endDate: filter.endDate,
  })

  if (filter.costType !== 'todos') {
    params.set('costType', filter.costType)
  }

  const serializedEntries = await requestJson<SerializedCostEntry[]>(`/api/reports/costs?${params.toString()}`)

  return serializedEntries.map(toCostEntry)
}
