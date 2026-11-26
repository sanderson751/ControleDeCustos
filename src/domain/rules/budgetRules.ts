import type {
  BudgetLimit,
  BudgetStatus,
  CategoryBudgetSummary,
} from "@/domain/entities/budget";
import {
  type CostCategory,
  type CostEntry,
  DEFAULT_CATEGORIES,
} from "@/domain/entities/cost";
import {
  compareCategoryOrder,
  spentByCategory,
} from "@/domain/rules/costRules";

/** A partir de 80% do limite a categoria entra em atencao. */
export const BUDGET_WARNING_RATIO = 0.8;
export const MAX_BUDGET_LIMIT = 1_000_000_000;

const STATUS_SEVERITY: Record<BudgetStatus, number> = {
  "sem-orcamento": 0,
  ok: 1,
  atencao: 2,
  estourado: 3,
};

/** Valores monetarios em centavos inteiros (evita erro de ponto flutuante). */
function toCents(value: number): number {
  return Math.round(value * 100);
}

const WARNING_PERCENT = Math.round(BUDGET_WARNING_RATIO * 100);

export function getBudgetStatus(
  spent: number,
  limit: number | null | undefined,
): BudgetStatus {
  if (!limit || limit <= 0) {
    return "sem-orcamento";
  }

  const spentCents = toCents(spent);
  const limitCents = toCents(limit);

  if (spentCents >= limitCents) {
    return "estourado";
  }

  // spent/limit >= 80%  <=>  spent * 100 >= limit * 80 (aritmetica inteira)
  if (spentCents * 100 >= limitCents * WARNING_PERCENT) {
    return "atencao";
  }

  return "ok";
}

/**
 * Percentual consumido arredondado para baixo, coerente com o status:
 * 79,9% exibe 79% (ok) e 99,5% exibe 99% (atencao), nunca "100%" sem estouro.
 */
export function getConsumedPercent(spent: number, limit: number): number {
  return Math.floor((toCents(spent) * 100) / toCents(limit));
}

/**
 * Resumo de orcamento por categoria: as categorias informadas (padrao por
 * omissao) mais as que aparecem nos lancamentos ou limites. Ordenado por
 * gravidade (estourado > atencao > ok > sem orcamento) e depois pelo gasto.
 */
export function summarizeBudgets(
  entries: readonly CostEntry[],
  limits: readonly BudgetLimit[],
  categoryIds: readonly CostCategory[] = DEFAULT_CATEGORIES,
): CategoryBudgetSummary[] {
  const spent = spentByCategory(entries, categoryIds);
  const limitByCategory = new Map(
    limits.map((budget) => [budget.category, budget.limit]),
  );
  const categories = new Set<CostCategory>([
    ...Object.keys(spent),
    ...limitByCategory.keys(),
  ]);

  return [...categories].map((category) => {
    const limit = limitByCategory.get(category) ?? null;
    const categorySpent = spent[category] ?? 0;

    return {
      category,
      spent: categorySpent,
      limit,
      percent: limit ? getConsumedPercent(categorySpent, limit) : null,
      remaining: limit
        ? (toCents(limit) - toCents(categorySpent)) / 100
        : null,
      status: getBudgetStatus(categorySpent, limit),
    };
  }).sort(
    (left, right) =>
      STATUS_SEVERITY[right.status] - STATUS_SEVERITY[left.status] ||
      right.spent - left.spent ||
      compareCategoryOrder(left.category, right.category),
  );
}

export function getBudgetAlerts(
  summaries: readonly CategoryBudgetSummary[],
): CategoryBudgetSummary[] {
  return summaries.filter(
    (summary) => summary.status === "atencao" || summary.status === "estourado",
  );
}

/** Categorias cujo status piorou para atencao/estourado entre dois momentos. */
export function findWorsenedBudgets(
  before: readonly CategoryBudgetSummary[],
  after: readonly CategoryBudgetSummary[],
): CategoryBudgetSummary[] {
  const previous = new Map(before.map((item) => [item.category, item.status]));

  return getBudgetAlerts(after).filter(
    (summary) =>
      STATUS_SEVERITY[summary.status] >
      STATUS_SEVERITY[previous.get(summary.category) ?? "sem-orcamento"],
  );
}

export function buildBudgetDocId(
  year: number,
  month: number,
  category: CostCategory,
): string {
  return `${year}-${String(month).padStart(2, "0")}-${category}`;
}

export type BudgetInputValidation =
  | { ok: true; value: number | null }
  | { ok: false; message: string };

/** Valor vazio/NaN remove o orcamento; caso contrario deve ser > 0 e <= maximo. */
export function validateBudgetInput(
  value: number | null | undefined,
): BudgetInputValidation {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return { ok: true, value: null };
  }

  if (value <= 0) {
    return { ok: false, message: "O orçamento deve ser maior que zero." };
  }

  if (value > MAX_BUDGET_LIMIT) {
    return { ok: false, message: "O orçamento informado é muito alto." };
  }

  return { ok: true, value };
}

export type BudgetChangePlan = {
  creates: Array<{ category: CostCategory; limit: number }>;
  updates: Array<{ category: CostCategory; limit: number }>;
  removals: CostCategory[];
};

/** Diferenca entre os limites salvos e os desejados (somente o que mudou). */
export function planBudgetChanges(
  current: readonly BudgetLimit[],
  desired: Partial<Record<CostCategory, number | null>>,
): BudgetChangePlan {
  const currentByCategory = new Map(
    current.map((budget) => [budget.category, budget.limit]),
  );
  const plan: BudgetChangePlan = { creates: [], updates: [], removals: [] };
  const categories = [
    ...new Set<CostCategory>([
      ...currentByCategory.keys(),
      ...Object.keys(desired),
    ]),
  ].sort(compareCategoryOrder);

  for (const category of categories) {
    const existing = currentByCategory.get(category);
    const next = desired[category] ?? null;

    if (next === null) {
      if (existing !== undefined) {
        plan.removals.push(category);
      }
    } else if (existing === undefined) {
      plan.creates.push({ category, limit: next });
    } else if (existing !== next) {
      plan.updates.push({ category, limit: next });
    }
  }

  return plan;
}

export function hasBudgetChanges(plan: BudgetChangePlan): boolean {
  return (
    plan.creates.length + plan.updates.length + plan.removals.length > 0
  );
}
