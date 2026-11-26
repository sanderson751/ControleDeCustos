import {
  EMPTY_MONTH_BUDGET_STATE,
  type MonthBudgetState,
} from "@/domain/entities/budget";
import type { Competence } from "@/domain/entities/cost";
import { useCompetenceResource } from "@/hooks/useCompetenceResource";
import { loadMonthBudgetState } from "@/services/budgetService";

/**
 * Orcamentos de uma competencia. `limits` sao os limites efetivos
 * (excecao mensal ou recorrente); `state` traz os dados brutos para edicao.
 */
export function useMonthBudgets(userId: string, competence: Competence) {
  const { data, ...rest } = useCompetenceResource<MonthBudgetState>(
    userId,
    competence,
    loadMonthBudgetState,
    "Não foi possível carregar os orçamentos do mês.",
    EMPTY_MONTH_BUDGET_STATE,
  );

  return { limits: data.effective, state: data, ...rest };
}
