import {
  getDocs,
  query,
  serverTimestamp,
  where,
  writeBatch,
} from "firebase/firestore";
import type { BudgetLimit } from "@/domain/entities/budget";
import type { Competence } from "@/domain/entities/cost";
import {
  type BudgetChangePlan,
  buildBudgetDocId,
  hasBudgetChanges,
} from "@/domain/rules/budgetRules";
import { db } from "@/lib/firebase";
import { toBudgetLimit } from "@/services/converters";
import {
  budgetLimitDocRef,
  budgetLimitsCollectionRef,
} from "@/services/firestorePaths";

/** Orcamentos da competencia (um documento por categoria). */
export async function listMonthBudgets(
  userId: string,
  { year, month }: Competence,
): Promise<BudgetLimit[]> {
  const snapshot = await getDocs(
    query(
      budgetLimitsCollectionRef(userId),
      where("year", "==", year),
      where("month", "==", month),
    ),
  );

  return snapshot.docs.map((docSnapshot) =>
    toBudgetLimit(docSnapshot.id, docSnapshot.data()),
  );
}

/** Aplica o plano de alteracoes em um unico batch atomico. */
export async function applyBudgetChanges(
  userId: string,
  { year, month }: Competence,
  plan: BudgetChangePlan,
): Promise<void> {
  if (!hasBudgetChanges(plan)) {
    return;
  }

  const batch = writeBatch(db);
  const refFor = (category: BudgetLimit["category"]) =>
    budgetLimitDocRef(userId, buildBudgetDocId(year, month, category));

  for (const { category, limit } of plan.creates) {
    batch.set(refFor(category), {
      userId,
      year,
      month,
      category,
      limit,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  for (const { category, limit } of plan.updates) {
    batch.update(refFor(category), { limit, updatedAt: serverTimestamp() });
  }

  for (const category of plan.removals) {
    batch.delete(refFor(category));
  }

  await batch.commit();
}
