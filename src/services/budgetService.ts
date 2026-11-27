import {
  getDocs,
  query,
  serverTimestamp,
  where,
  type WriteBatch,
  writeBatch,
} from "firebase/firestore";
import type {
  BudgetLimit,
  MonthBudgetState,
  RecurringBudget,
} from "@/domain/entities/budget";
import type { Competence, CostCategory } from "@/domain/entities/cost";
import { buildBudgetDocId } from "@/domain/rules/budgetRules";
import { isDefaultCategory } from "@/domain/rules/categoryRules";
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

type BudgetWrite = {
  category: CostCategory;
  write: (batch: WriteBatch) => void;
};

/**
 * Cada gravacao com categoria personalizada custa um exists() nas regras, e uma
 * requisicao admite poucos acessos a documentos. Limita as personalizadas
 * distintas por batch (padrao nao consomem acesso).
 */
export const MAX_CUSTOM_CATEGORIES_PER_BATCH = 10;

async function commitInChunks(operations: readonly BudgetWrite[]) {
  const chunks: BudgetWrite[][] = [];
  let current: BudgetWrite[] = [];
  let customs = new Set<CostCategory>();

  for (const operation of operations) {
    const isNewCustom =
      !isDefaultCategory(operation.category) && !customs.has(operation.category);

    if (isNewCustom && customs.size >= MAX_CUSTOM_CATEGORIES_PER_BATCH) {
      chunks.push(current);
      current = [];
      customs = new Set();
    }

    if (!isDefaultCategory(operation.category)) {
      customs.add(operation.category);
    }
    current.push(operation);
  }

  chunks.push(current);

  for (const chunk of chunks) {
    const batch = writeBatch(db);
    chunk.forEach((operation) => operation.write(batch));
    await batch.commit();
  }
}

/**
 * Aplica excecoes mensais e vigencias recorrentes. Em um unico batch atomico
 * no caso comum; com muitas categorias personalizadas, em lotes sequenciais.
 */
export async function applyMonthBudgetChanges(
  userId: string,
  { year, month }: Competence,
  plan: MonthBudgetChangePlan,
): Promise<void> {
  if (!hasMonthBudgetChanges(plan)) {
    return;
  }

  const operations: BudgetWrite[] = [];
  const idFor = (category: CostCategory) =>
    buildBudgetDocId(year, month, category);

  for (const { category, limit } of plan.monthly.creates) {
    operations.push({
      category,
      write: (batch) =>
        batch.set(budgetLimitDocRef(userId, idFor(category)), {
          userId,
          year,
          month,
          category,
          limit,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }),
    });
  }

  for (const { category, limit } of plan.monthly.updates) {
    operations.push({
      category,
      write: (batch) =>
        batch.update(budgetLimitDocRef(userId, idFor(category)), {
          limit,
          updatedAt: serverTimestamp(),
        }),
    });
  }

  for (const category of plan.monthly.removals) {
    operations.push({
      category,
      write: (batch) => batch.delete(budgetLimitDocRef(userId, idFor(category))),
    });
  }

  for (const { category, limit, operation, start } of plan.recurring) {
    const ref = recurringBudgetDocRef(
      userId,
      buildBudgetDocId(start.year, start.month, category),
    );

    operations.push({
      category,
      write: (batch) => {
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
      },
    });
  }

  await commitInChunks(operations);
}

/** Excecoes mensais de um ou mais anos (para series historicas). */
export async function listBudgetLimitsByYears(
  userId: string,
  years: readonly number[],
): Promise<BudgetLimit[]> {
  const snapshot = await getDocs(
    query(budgetLimitsCollectionRef(userId), where("year", "in", [...years])),
  );

  return snapshot.docs.map((docSnapshot) =>
    toBudgetLimit(docSnapshot.id, docSnapshot.data()),
  );
}
