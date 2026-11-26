import type { Competence, CostCategory } from "@/domain/entities/cost";

export type BudgetLimit = {
  /** Id deterministico: AAAA-MM-categoria */
  id: string;
  category: CostCategory;
  year: number;
  month: number;
  limit: number;
};

/**
 * Vigencia de orcamento recorrente: vale a partir de year/month ate a proxima
 * vigencia da mesma categoria. `limit: null` encerra a recorrencia.
 */
export type RecurringBudget = {
  /** Id deterministico: AAAA-MM-categoria (mes de inicio) */
  id: string;
  category: CostCategory;
  year: number;
  month: number;
  limit: number | null;
};

/** Origem do limite efetivo de uma categoria em um mes. */
export type BudgetSource = "mensal" | "recorrente";

/** Modo de aplicacao escolhido no formulario de orcamentos. */
export type BudgetMode = "mensal" | "recorrente";

export const BUDGET_MODE_LABELS: Record<BudgetMode, string> = {
  mensal: "Só este mês",
  recorrente: "Este mês em diante",
};

/** Limite que vale no mes (excecao mensal ou vigencia recorrente). */
export type EffectiveBudget = BudgetLimit & {
  source: BudgetSource;
  /** Inicio da vigencia recorrente ativa no mes (quando houver). */
  recurringFrom?: Competence;
  /** Valor recorrente ativo no mes, mesmo quando sobrescrito por excecao. */
  recurringLimit?: number;
};

/** Estado completo de orcamentos de uma competencia. */
export type MonthBudgetState = {
  monthLimits: BudgetLimit[];
  recurring: RecurringBudget[];
  effective: EffectiveBudget[];
};

export const EMPTY_MONTH_BUDGET_STATE: MonthBudgetState = {
  monthLimits: [],
  recurring: [],
  effective: [],
};

export type BudgetStatus = "sem-orcamento" | "ok" | "atencao" | "estourado";

export const BUDGET_STATUS_LABELS: Record<BudgetStatus, string> = {
  "sem-orcamento": "Sem orçamento",
  ok: "Dentro do orçamento",
  atencao: "Atenção",
  estourado: "Estourado",
};

export type CategoryBudgetSummary = {
  category: CostCategory;
  spent: number;
  limit: number | null;
  /** Percentual consumido (0-100+), null sem orcamento. */
  percent: number | null;
  /** Valor restante (negativo quando estourado), null sem orcamento. */
  remaining: number | null;
  status: BudgetStatus;
};
