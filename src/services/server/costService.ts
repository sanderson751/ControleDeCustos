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

export async function listCurrentMonthCosts(userId: string, year: number, month: number) {
  const snapshot = await getCostsCollection(userId)
    .where('competenceYear', '==', year)
    .where('competenceMonth', '==', month)
    .get()

  return snapshot.docs
    .map((docSnapshot) => toServerCostEntry(docSnapshot.id, docSnapshot.data() as Partial<CostEntryDoc>))
    .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
}

export async function createCostEntry(userId: string, input: NewCostInput) {
  const effectiveDate = input.createdAtManual ?? new Date()

  await getCostsCollection(userId).add({
    userId,
    accountName: input.accountName.trim(),
    amount: Number(input.amount),
    costType: input.costType,
    installmentsTotal: Math.max(1, Number(input.installmentsTotal ?? 1)),
    competenceYear: effectiveDate.getFullYear(),
    competenceMonth: effectiveDate.getMonth() + 1,
    createdAt: input.createdAtManual
      ? Timestamp.fromDate(effectiveDate)
      : FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  })
}

export async function getCostEntryById(userId: string, entryId: string) {
  const snapshot = await getCostsCollection(userId).doc(entryId).get()

  if (!snapshot.exists) {
    return null
  }

  return toServerCostEntry(snapshot.id, snapshot.data() as Partial<CostEntryDoc>)
}

export async function updateCostEntry(userId: string, entryId: string, updates: UpdateCostInput) {
  await getCostsCollection(userId)
    .doc(entryId)
    .set(
      {
        accountName: updates.accountName.trim(),
        amount: Number(updates.amount),
        costType: updates.costType,
        installmentsTotal: Math.max(1, Number(updates.installmentsTotal)),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    )
}

export async function deleteCostEntry(userId: string, entryId: string) {
  await getCostsCollection(userId).doc(entryId).delete()
}