import {
  getDocs,
  query,
  serverTimestamp,
  where,
  writeBatch,
} from "firebase/firestore";
import type {
  BudgetLimit,
  MonthBudgetState,
  RecurringBudget,
} from "@/domain/entities/budget";
import type { Competence, CostCategory } from "@/domain/entities/cost";
import { buildBudgetDocId } from "@/domain/rules/budgetRules";
import {
  buildMonthBudgetState,
  hasMonthBudgetChanges,
  type MonthBudgetChangePlan,
} from "@/domain/rules/recurringBudgetRules";
import { db } from "@/lib/firebase";
import { toBudgetLimit, toRecurringBudget } from "@/services/converters";
import {
  budgetLimitDocRef,
  budgetLimitsCollectionRef,
  recurringBudgetDocRef,
  recurringBudgetsCollectionRef,
} from "@/services/firestorePaths";

/** Orcamentos definidos somente para a competencia (excecoes mensais). */
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

/** Todas as vigencias recorrentes do usuario (volume pequeno). */
export async function listRecurringBudgets(
  userId: string,
): Promise<RecurringBudget[]> {
  const snapshot = await getDocs(recurringBudgetsCollectionRef(userId));

  return snapshot.docs.map((docSnapshot) =>
    toRecurringBudget(docSnapshot.id, docSnapshot.data()),
  );
}

/** Excecoes do mes + vigencias recorrentes + limites efetivos resolvidos. */
export async function loadMonthBudgetState(
  userId: string,
  competence: Competence,
): Promise<MonthBudgetState> {
  const [monthLimits, recurring] = await Promise.all([
    listMonthBudgets(userId, competence),
    listRecurringBudgets(userId),
  ]);

  return buildMonthBudgetState(monthLimits, recurring, competence);
}

/** Aplica excecoes mensais e vigencias recorrentes em um unico batch atomico. */
export async function applyMonthBudgetChanges(
  userId: string,
  { year, month }: Competence,
  plan: MonthBudgetChangePlan,
): Promise<void> {
  if (!hasMonthBudgetChanges(plan)) {
    return;
  }

  const batch = writeBatch(db);
  const idFor = (category: CostCategory) =>
    buildBudgetDocId(year, month, category);

  for (const { category, limit } of plan.monthly.creates) {
    batch.set(budgetLimitDocRef(userId, idFor(category)), {
      userId,
      year,
      month,
      category,
      limit,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  for (const { category, limit } of plan.monthly.updates) {
    batch.update(budgetLimitDocRef(userId, idFor(category)), {
      limit,
      updatedAt: serverTimestamp(),
    });
  }

  for (const category of plan.monthly.removals) {
    batch.delete(budgetLimitDocRef(userId, idFor(category)));
  }

  for (const { category, limit, operation, start } of plan.recurring) {
    const ref = recurringBudgetDocRef(
      userId,
      buildBudgetDocId(start.year, start.month, category),
    );

    if (operation === "delete") {
      batch.delete(ref);
    } else if (operation === "update") {
      batch.update(ref, { limit, updatedAt: serverTimestamp() });
    } else {
      batch.set(ref, {
        userId,
        year,
        month,
        category,
        limit,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  }

  await batch.commit();
}
