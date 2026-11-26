import type { BudgetLimit } from "@/domain/entities/budget";
import type { Competence } from "@/domain/entities/cost";
import { useCompetenceResource } from "@/hooks/useCompetenceResource";
import { listMonthBudgets } from "@/services/budgetService";

/** Orcamentos por categoria de uma competencia. */
export function useMonthBudgets(userId: string, competence: Competence) {
  const { data, ...rest } = useCompetenceResource<BudgetLimit>(
    userId,
    competence,
    listMonthBudgets,
    "Não foi possível carregar os orçamentos do mês.",
  );

  return { limits: data, ...rest };
}
