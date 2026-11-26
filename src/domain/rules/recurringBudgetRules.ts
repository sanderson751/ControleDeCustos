import type {
  BudgetLimit,
  BudgetMode,
  EffectiveBudget,
  MonthBudgetState,
  RecurringBudget,
} from "@/domain/entities/budget";
import {
  COST_CATEGORIES,
  type Competence,
  type CostCategory,
} from "@/domain/entities/cost";
import {
  type BudgetChangePlan,
  buildBudgetDocId,
} from "@/domain/rules/budgetRules";

function competenceIndex({ year, month }: Competence): number {
  return year * 12 + (month - 1);
}

/**
 * Vigencia recorrente ativa da categoria no mes: a mais recente com inicio
 * ate a competencia. Null quando nao ha vigencia ou a ultima foi encerrada.
 */
export function resolveRecurringFor(
  recurring: readonly RecurringBudget[],
  category: CostCategory,
  competence: Competence,
): (RecurringBudget & { limit: number }) | null {
  const target = competenceIndex(competence);
  let latest: RecurringBudget | null = null;

  for (const item of recurring) {
    if (item.category !== category) {
      continue;
    }

    const start = competenceIndex(item);

    if (start <= target && (!latest || start > competenceIndex(latest))) {
      latest = item;
    }
  }

  return latest && latest.limit !== null
    ? { ...latest, limit: latest.limit }
    : null;
}

/** Limites efetivos do mes: excecao mensal prevalece sobre a recorrencia. */
export function resolveEffectiveBudgets(
  monthLimits: readonly BudgetLimit[],
  recurring: readonly RecurringBudget[],
  competence: Competence,
): EffectiveBudget[] {
  const monthlyByCategory = new Map(
    monthLimits.map((item) => [item.category, item]),
  );

  return COST_CATEGORIES.flatMap<EffectiveBudget>((category) => {
    const active = resolveRecurringFor(recurring, category, competence);
    const recurringInfo = active
      ? {
          recurringFrom: { year: active.year, month: active.month },
          recurringLimit: active.limit,
        }
      : {};
    const monthly = monthlyByCategory.get(category);

    if (monthly) {
      return [{ ...monthly, source: "mensal", ...recurringInfo }];
    }

    if (active) {
      return [
        {
          id: buildBudgetDocId(competence.year, competence.month, category),
          category,
          year: competence.year,
          month: competence.month,
          limit: active.limit,
          source: "recorrente",
          ...recurringInfo,
        },
      ];
    }

    return [];
  });
}

export function buildMonthBudgetState(
  monthLimits: BudgetLimit[],
  recurring: RecurringBudget[],
  competence: Competence,
): MonthBudgetState {
  return {
    monthLimits,
    recurring,
    effective: resolveEffectiveBudgets(monthLimits, recurring, competence),
  };
}

/** Modo inicial do formulario: recorrente quando o limite efetivo vem da recorrencia. */
export function defaultBudgetMode(
  category: CostCategory,
  state: MonthBudgetState,
): BudgetMode {
  return state.effective.find((item) => item.category === category)?.source ===
    "recorrente"
    ? "recorrente"
    : "mensal";
}

export type RecurringChange = {
  category: CostCategory;
  /** null encerra a recorrencia a partir do mes. */
  limit: number | null;
  /**
   * create: nova vigencia no mes; update: vigencia ja iniciada no mes;
   * delete: vigencia futura substituida por "Este mes em diante".
   */
  operation: "create" | "update" | "delete";
  /** Mes de inicio da vigencia afetada. */
  start: Competence;
};

export type MonthBudgetChangePlan = {
  monthly: BudgetChangePlan;
  recurring: RecurringChange[];
  /**
   * Categorias em "So este mes" com valor vazio sobre uma recorrencia ativa:
   * nao ha como remover o limite de um unico mes (fora de escopo), entao nada
   * e gravado e a tela avisa o usuario.
   */
  ignored: CostCategory[];
};

export type DesiredBudget = { value: number | null; mode: BudgetMode };

export function hasMonthBudgetChanges(plan: MonthBudgetChangePlan): boolean {
  return (
    plan.monthly.creates.length +
      plan.monthly.updates.length +
      plan.monthly.removals.length +
      plan.recurring.length >
    0
  );
}

/** Vigencias da categoria que comecam depois da competencia. */
export function futureRecurringFor(
  recurring: readonly RecurringBudget[],
  category: CostCategory,
  competence: Competence,
): RecurringBudget[] {
  const target = competenceIndex(competence);
  return recurring
    .filter((item) => item.category === category && competenceIndex(item) > target)
    .sort((left, right) => competenceIndex(left) - competenceIndex(right));
}

/**
 * Traduz o formulario (valor + modo por categoria) nas gravacoes necessarias:
 * - "mensal": excecao somente neste mes (cria/atualiza/remove em budgetLimits).
 *   Um valor igual ao recorrente tambem cria a excecao (fixa o valor do mes).
 * - "recorrente": remove a excecao do mes e, quando o valor difere da
 *   recorrencia ativa, grava uma vigencia a partir do mes (vazio encerra) e
 *   remove as vigencias futuras da categoria ("este mes em diante").
 */
export function planMonthBudgetChanges(
  state: MonthBudgetState,
  competence: Competence,
  desired: Partial<Record<CostCategory, DesiredBudget>>,
): MonthBudgetChangePlan {
  const plan: MonthBudgetChangePlan = {
    monthly: { creates: [], updates: [], removals: [] },
    recurring: [],
    ignored: [],
  };
  const monthlyByCategory = new Map(
    state.monthLimits.map((item) => [item.category, item.limit]),
  );
  const target = competenceIndex(competence);

  for (const category of COST_CATEGORIES) {
    const wanted = desired[category];

    if (!wanted) {
      continue;
    }

    const monthly = monthlyByCategory.get(category);
    const active = resolveRecurringFor(state.recurring, category, competence);

    if (wanted.mode === "mensal") {
      if (wanted.value === null) {
        if (monthly !== undefined) {
          plan.monthly.removals.push(category);
        } else if (active) {
          plan.ignored.push(category);
        }
      } else if (monthly === undefined) {
        plan.monthly.creates.push({ category, limit: wanted.value });
      } else if (monthly !== wanted.value) {
        plan.monthly.updates.push({ category, limit: wanted.value });
      }
      continue;
    }

    // Modo recorrente: a vigencia passa a valer neste mes (sem excecao).
    if (monthly !== undefined) {
      plan.monthly.removals.push(category);
    }

    const activeLimit = active?.limit ?? null;
    const future = futureRecurringFor(state.recurring, category, competence);

    if (wanted.value === activeLimit && future.length === 0) {
      continue;
    }

    const startsThisMonth = state.recurring.some(
      (item) => item.category === category && competenceIndex(item) === target,
    );

    if (wanted.value !== activeLimit) {
      plan.recurring.push({
        category,
        limit: wanted.value,
        operation: startsThisMonth ? "update" : "create",
        start: competence,
      });
    }

    for (const item of future) {
      plan.recurring.push({
        category,
        limit: item.limit,
        operation: "delete",
        start: { year: item.year, month: item.month },
      });
    }
  }

  return plan;
}
