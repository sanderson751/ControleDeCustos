import {
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import type {
  Competence,
  CostEntry,
  NewCostInput,
  UpdateCostInput,
} from "@/domain/entities/cost";
import {
  buildInstallmentPlan,
  normalizeInstallments,
  sortByCreatedAtDesc,
} from "@/domain/rules/costRules";
import { db } from "@/lib/firebase";
import { toCostEntry } from "@/services/converters";
import {
  costEntriesCollectionRef,
  costEntryDocRef,
} from "@/services/firestorePaths";

/** Lista os custos de uma competencia (mes/ano), do mais recente para o mais antigo. */
export async function listMonthCosts(
  userId: string,
  year: number,
  month: number,
): Promise<CostEntry[]> {
  const snapshot = await getDocs(
    query(
      costEntriesCollectionRef(userId),
      where("competenceYear", "==", year),
      where("competenceMonth", "==", month),
    ),
  );

  return sortByCreatedAtDesc(
    snapshot.docs.map((docSnapshot) =>
      toCostEntry(docSnapshot.id, docSnapshot.data()),
    ),
  );
}

export async function getCostEntryById(
  userId: string,
  entryId: string,
): Promise<CostEntry | null> {
  const snapshot = await getDoc(costEntryDocRef(userId, entryId));

  if (!snapshot.exists()) {
    return null;
  }

  return toCostEntry(snapshot.id, snapshot.data());
}

/**
 * Cria o custo. Custos fixos parcelados geram um documento por parcela,
 * gravados atomicamente em um unico batch.
 */
export async function createCostEntry(
  userId: string,
  input: NewCostInput,
): Promise<void> {
  const plan = buildInstallmentPlan(input);
  const installmentsTotal = plan.length;
  const batch = writeBatch(db);
  const collectionRef = costEntriesCollectionRef(userId);

  for (const installment of plan) {
    batch.set(doc(collectionRef), {
      userId,
      accountName: input.accountName.trim(),
      amount: Number(input.amount),
      costType: input.costType,
      category: input.category,
      installmentsTotal,
      competenceYear: installment.competenceYear,
      competenceMonth: installment.competenceMonth,
      createdAt: installment.createdAt
        ? Timestamp.fromDate(installment.createdAt)
        : serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  await batch.commit();
}

export async function updateCostEntry(
  userId: string,
  entryId: string,
  updates: UpdateCostInput,
): Promise<void> {
  await updateDoc(costEntryDocRef(userId, entryId), {
    accountName: updates.accountName.trim(),
    amount: Number(updates.amount),
    costType: updates.costType,
    category: updates.category,
    installmentsTotal: normalizeInstallments(
      updates.costType,
      updates.installmentsTotal,
    ),
    updatedAt: serverTimestamp(),
  });
}

export async function deleteCostEntry(
  userId: string,
  entryId: string,
): Promise<void> {
  await deleteDoc(costEntryDocRef(userId, entryId));
}

/**
 * Custos de um intervalo de competencias (inclusive). Uma consulta `in` por
 * ano de competencia; meses fora do intervalo sao descartados no client.
 */
export async function listCostsByCompetenceRange(
  userId: string,
  from: Competence,
  to: Competence,
): Promise<CostEntry[]> {
  const fromIndex = from.year * 12 + from.month;
  const toIndex = to.year * 12 + to.month;
  const years = Array.from(
    { length: to.year - from.year + 1 },
    (_, index) => from.year + index,
  );

  const snapshot = await getDocs(
    query(costEntriesCollectionRef(userId), where("competenceYear", "in", years)),
  );

  return snapshot.docs
    .map((docSnapshot) => toCostEntry(docSnapshot.id, docSnapshot.data()))
    .filter((entry) => {
      const index = entry.competenceYear * 12 + entry.competenceMonth;
      return index >= fromIndex && index <= toIndex;
    });
}
