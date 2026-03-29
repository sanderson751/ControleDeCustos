import { requestJson } from './httpClient'

export type CostType = 'fixo' | 'variavel'

export type CostEntry = {
  id: string
  accountName: string
  amount: number
  costType: CostType
  installmentsTotal: number
  competenceYear: number
  competenceMonth: number
  createdAt: Date
  updatedAt: Date
}

type SerializedCostEntry = Omit<CostEntry, 'createdAt' | 'updatedAt'> & {
  createdAt: string
  updatedAt: string
}

export type NewCostInput = {
  accountName: string
  amount: number
  costType: CostType
  installmentsTotal?: number
  createdAtManual?: Date
}

export type UpdateCostInput = {
  accountName: string
  amount: number
  costType: CostType
  installmentsTotal: number
}

function toCostEntry(data: SerializedCostEntry): CostEntry {
  return {
    ...data,
    createdAt: new Date(data.createdAt),
    updatedAt: new Date(data.updatedAt),
  }
}

function sortByCreatedAtDesc(entries: CostEntry[]) {
  return [...entries].sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
}

export async function listCurrentMonthCosts(
  userId: string,
  year: number,
  month: number,
) {
  void userId

  const entries = await requestJson<SerializedCostEntry[]>(
    `/api/costs?year=${year}&month=${month}`,
  )

  return sortByCreatedAtDesc(entries.map(toCostEntry))
}

export function subscribeToCurrentMonthCosts(
  userId: string,
  year: number,
  month: number,
  onData: (entries: CostEntry[]) => void,
  onError: (error: Error) => void,
) {
  let isActive = true

  void listCurrentMonthCosts(userId, year, month)
    .then((entries) => {
      if (isActive) {
        onData(entries)
      }
    })
    .catch((error) => {
      if (isActive) {
        onError(error instanceof Error ? error : new Error(String(error)))
      }
    })

  return () => {
    isActive = false
  }
}

export async function createCostEntry(userId: string, input: NewCostInput): Promise<void> {
  void userId

  await requestJson<{ ok: true }>('/api/costs', {
    method: 'POST',
    body: JSON.stringify({
      ...input,
      createdAtManual: input.createdAtManual?.toISOString(),
    }),
  })
}

export async function getCostEntryById(userId: string, entryId: string): Promise<CostEntry | null> {
  void userId

  try {
    const entry = await requestJson<SerializedCostEntry>(`/api/costs/${entryId}`)
    return toCostEntry(entry)
  } catch (error) {
    if (error instanceof Error && 'status' in error && (error as { status?: number }).status === 404) {
      return null
    }

    throw error
  }
}

export async function updateCostEntry(
  userId: string,
  entryId: string,
  updates: UpdateCostInput,
): Promise<void> {
  void userId

  await requestJson<{ ok: true }>(`/api/costs/${entryId}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  })
}

export async function deleteCostEntry(userId: string, entryId: string): Promise<void> {
  void userId

  await requestJson<{ ok: true }>(`/api/costs/${entryId}`, {
    method: 'DELETE',
  })
}