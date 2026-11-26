import type { CostCategory } from "@/domain/entities/cost";

export type BudgetLimit = {
  /** Id deterministico: AAAA-MM-categoria */
  id: string;
  category: CostCategory;
  year: number;
  month: number;
  limit: number;
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
