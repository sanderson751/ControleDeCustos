import type { BudgetLimit, RecurringBudget } from "@/domain/entities/budget";
import type {
  CategoryFilter,
  Competence,
  CostEntry,
  CostFilter,
} from "@/domain/entities/cost";
import { getBudgetStatus } from "@/domain/rules/budgetRules";
import { isSameCompetence, shiftCompetence } from "@/domain/rules/competence";
import { resolveEffectiveBudgets } from "@/domain/rules/recurringBudgetRules";

export const EVOLUTION_PERIODS = [6, 12] as const;
export type EvolutionPeriod = (typeof EVOLUTION_PERIODS)[number];

export type MonthlyPoint = {
  competence: Competence;
  spent: number;
  /** Orcamento efetivo do mes; null sem orcamento ou com filtro de frente. */
  budget: number | null;
  isOverBudget: boolean;
};

/** `count` competencias terminando em `end`, em ordem cronologica. */
export function listCompetences(end: Competence, count: number): Competence[] {
  return Array.from({ length: count }, (_, index) =>
    shiftCompetence(end, index - (count - 1)),
  );
}

/** Anos (distintos, crescentes) cobertos por uma lista de competencias. */
export function yearsOf(competences: readonly Competence[]): number[] {
  return [...new Set(competences.map((item) => item.year))].sort(
    (left, right) => left - right,
  );
}

function roundCurrency(value: number) {
  return Math.round(value * 100) / 100;
}

type EvolutionInput = {
  entries: readonly CostEntry[];
  monthLimits: readonly BudgetLimit[];
  recurring: readonly RecurringBudget[];
  competences: readonly Competence[];
  category: CategoryFilter;
  costType: CostFilter;
};

/**
 * Gasto por competencia (com filtros) e orcamento efetivo do mes:
 * - categoria "todas": soma dos limites efetivos das categorias;
 * - uma categoria: limite efetivo daquela categoria;
 * - frente fixo/variavel: sem orcamento (orcamentos nao sao por frente).
 */
export function buildMonthlyEvolution({
  entries,
  monthLimits,
  recurring,
  competences,
  category,
  costType,
}: EvolutionInput): MonthlyPoint[] {
  return competences.map((competence) => {
    const spent = roundCurrency(
      entries
        .filter(
          (entry) =>
            entry.competenceYear === competence.year &&
            entry.competenceMonth === competence.month &&
            (category === "todas" || entry.category === category) &&
            (costType === "todos" || entry.costType === costType),
        )
        .reduce((sum, entry) => sum + entry.amount, 0),
    );

    let budget: number | null = null;

    if (costType === "todos") {
      const effective = resolveEffectiveBudgets(
        monthLimits.filter((item) => isSameCompetence(item, competence)),
        recurring,
        competence,
      ).filter((item) => category === "todas" || item.category === category);

      budget = effective.length
        ? roundCurrency(effective.reduce((sum, item) => sum + item.limit, 0))
        : null;
    }

    return {
      competence,
      spent,
      budget,
      isOverBudget:
        budget !== null && getBudgetStatus(spent, budget) === "estourado",
    };
  });
}

export type EvolutionSummary = {
  average: number;
  peak: MonthlyPoint | null;
  /** Variacao do ultimo mes sobre o anterior (fracao); null se indefinida. */
  lastChange: number | null;
  monthsOverBudget: number;
  monthsWithBudget: number;
};

export function summarizeEvolution(
  points: readonly MonthlyPoint[],
): EvolutionSummary {
  const total = points.reduce((sum, point) => sum + point.spent, 0);
  const peak = points.reduce<MonthlyPoint | null>(
    (best, point) =>
      point.spent > 0 && (!best || point.spent > best.spent) ? point : best,
    null,
  );
  const last = points.at(-1);
  const previous = points.at(-2);

  return {
    average: points.length ? roundCurrency(total / points.length) : 0,
    peak,
    lastChange:
      last && previous && previous.spent > 0
        ? (last.spent - previous.spent) / previous.spent
        : null,
    monthsOverBudget: points.filter((point) => point.isOverBudget).length,
    monthsWithBudget: points.filter((point) => point.budget !== null).length,
  };
}

const NICE_STEPS = [1, 2, 2.5, 5, 10];

/** Passo "redondo" para dividir `max` em ~`intervals` intervalos. */
export function niceStep(max: number, intervals = 4): number {
  if (!Number.isFinite(max) || max <= 0) {
    return 1;
  }

  const raw = max / intervals;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const step = NICE_STEPS.find((candidate) => candidate * magnitude >= raw) ?? 10;

  return step * magnitude;
}

/** Ticks do eixo Y: 0, passo, 2*passo... ate cobrir `max` (minimo 1 intervalo). */
/** Eixo minimo: evita passos abaixo do centavo e ticks duplicados com valores pequenos. */
export const MIN_AXIS_MAX = 10;

export function buildAxisTicks(max: number, intervals = 4): number[] {
  const target = Math.max(Number.isFinite(max) ? max : 0, MIN_AXIS_MAX);
  const step = niceStep(target, intervals);
  const count = Math.max(1, Math.ceil(target / step));

  return Array.from({ length: count + 1 }, (_, index) =>
    roundCurrency(index * step),
  );
}
