import type { BudgetLimit, RecurringBudget } from "@/domain/entities/budget";
import type { Competence } from "@/domain/entities/cost";
import { buildMonthBudgetState } from "@/domain/rules/recurringBudgetRules";

/**
 * Mock de `@/services/budgetService` para testes de pagina.
 * `loadMonthBudgetState` delega para `listMonthBudgets` e `listRecurringBudgets`
 * (mockaveis por teste) e resolve os limites efetivos com a regra real.
 *
 * Uso: vi.mock("@/services/budgetService", async () =>
 *   (await import("@/test/budgetServiceMock")).createBudgetServiceMock());
 */
export function createBudgetServiceMock() {
  const listMonthBudgets = vi.fn<
    (userId: string, competence: Competence) => Promise<BudgetLimit[]>
  >(async () => []);
  const listRecurringBudgets = vi.fn<
    (userId: string) => Promise<RecurringBudget[]>
  >(async () => []);

  return {
    listMonthBudgets,
    listRecurringBudgets,
    applyMonthBudgetChanges: vi.fn(async () => undefined),
    loadMonthBudgetState: vi.fn(async (userId: string, competence: Competence) =>
      buildMonthBudgetState(
        await listMonthBudgets(userId, competence),
        await listRecurringBudgets(userId),
        competence,
      ),
    ),
  };
}
