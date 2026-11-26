import type { BudgetLimit, RecurringBudget } from "@/domain/entities/budget";
import type { Competence, CostEntry } from "@/domain/entities/cost";
import { listCompetences, yearsOf } from "@/domain/rules/evolutionRules";
import {
  listBudgetLimitsByYears,
  listRecurringBudgets,
} from "@/services/budgetService";
import { listCostsByCompetenceRange } from "@/services/costService";

export type EvolutionData = {
  competences: Competence[];
  entries: CostEntry[];
  monthLimits: BudgetLimit[];
  recurring: RecurringBudget[];
};

/** Dados brutos da evolucao: `months` competencias terminando em `end`. */
export async function loadEvolutionData(
  userId: string,
  end: Competence,
  months: number,
): Promise<EvolutionData> {
  const competences = listCompetences(end, months);
  const from = competences[0];
  const [entries, monthLimits, recurring] = await Promise.all([
    listCostsByCompetenceRange(userId, from, end),
    listBudgetLimitsByYears(userId, yearsOf(competences)),
    listRecurringBudgets(userId),
  ]);

  return { competences, entries, monthLimits, recurring };
}
