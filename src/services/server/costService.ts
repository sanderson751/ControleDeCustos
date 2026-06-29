import 'server-only'

import { FieldValue, Timestamp } from 'firebase-admin/firestore'
import { adminDb } from '@/lib/firebase-admin'
import type { CostType, NewCostInput, UpdateCostInput } from '@/services/costService'

type CostEntryDoc = {
  userId: string
  accountName: string
  amount: number
  costType: CostType
  installmentsTotal: number
  competenceYear: number
  competenceMonth: number
  createdAt: Timestamp
  updatedAt?: Timestamp
}

export type ServerCostEntry = {
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

function toServerCostEntry(id: string, data: Partial<CostEntryDoc>): ServerCostEntry {
  const now = new Date()

  return {
    id,
    accountName: data.accountName ?? '',
    amount: Number(data.amount ?? 0),
    costType: data.costType ?? 'variavel',
    installmentsTotal: Number(data.installmentsTotal ?? 1),
    competenceYear: Number(data.competenceYear ?? now.getFullYear()),
    competenceMonth: Number(data.competenceMonth ?? now.getMonth() + 1),
    createdAt: data.createdAt?.toDate() ?? now,
    updatedAt: data.updatedAt?.toDate() ?? now,
  }
}

function getCostsCollection(userId: string) {
  return adminDb.collection('users').doc(userId).collection('costEntries')
}

function addMonths(baseDate: Date, monthsToAdd: number) {
  const nextDate = new Date(baseDate)
  nextDate.setMonth(nextDate.getMonth() + monthsToAdd)
  return nextDate
}

export async function listCurrentMonthCosts(userId: string, year: number, month: number) {
  const snapshot = await getCostsCollection(userId)
    .where('competenceYear', '==', year)
    .where('competenceMonth', '==', month)
    .get()

  return snapshot.docs
    .map((docSnapshot) => toServerCostEntry(docSnapshot.id, docSnapshot.data() as Partial<CostEntryDoc>))
    .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
}

export async function listCostsByDateRange(
  userId: string,
  startDate: Date,
  endDate: Date,
  costType?: CostType,
) {
  let query = getCostsCollection(userId)
    .where('createdAt', '>=', Timestamp.fromDate(startDate))
    .where('createdAt', '<=', Timestamp.fromDate(endDate))
    .orderBy('createdAt', 'desc')

  if (costType) {
    query = query.where('costType', '==', costType)
  }

  const snapshot = await query.get()

  return snapshot.docs.map((docSnapshot) =>
    toServerCostEntry(docSnapshot.id, docSnapshot.data() as Partial<CostEntryDoc>),
  )
}

export async function createCostEntry(userId: string, input: NewCostInput) {
  const baseDate = input.createdAtManual ?? new Date()
  const installmentsTotal =
    input.costType === 'fixo' ? Math.max(1, Number(input.installmentsTotal ?? 1)) : 1
  const amount = Number(input.amount)
  const accountName = input.accountName.trim()
  const costsCollection = getCostsCollection(userId)

  const writeBatch = adminDb.batch()

  for (let installmentIndex = 0; installmentIndex < installmentsTotal; installmentIndex += 1) {
    const installmentDate = addMonths(baseDate, installmentIndex)
    const costDocRef = costsCollection.doc()

    writeBatch.set(costDocRef, {
      userId,
      accountName,
      amount,
      costType: input.costType,
      installmentsTotal,
      competenceYear: installmentDate.getFullYear(),
      competenceMonth: installmentDate.getMonth() + 1,
      createdAt: input.createdAtManual
        ? Timestamp.fromDate(installmentDate)
        : FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    })
  }

  await writeBatch.commit()
}

export async function getCostEntryById(userId: string, entryId: string) {
  const snapshot = await getCostsCollection(userId).doc(entryId).get()

  if (!snapshot.exists) {
    return null
  }

  return toServerCostEntry(snapshot.id, snapshot.data() as Partial<CostEntryDoc>)
}

export async function updateCostEntry(userId: string, entryId: string, updates: UpdateCostInput) {
  const installmentsTotal =
    updates.costType === 'fixo' ? Math.max(1, Number(updates.installmentsTotal)) : 1

  await getCostsCollection(userId)
    .doc(entryId)
    .set(
      {
        accountName: updates.accountName.trim(),
        amount: Number(updates.amount),
        costType: updates.costType,
        installmentsTotal,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    )
}

export async function deleteCostEntry(userId: string, entryId: string) {
  await getCostsCollection(userId).doc(entryId).delete()
}