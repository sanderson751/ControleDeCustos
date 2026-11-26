import type {
  BudgetStatus,
  CategoryBudgetSummary,
} from "@/domain/entities/budget";
import { COST_CATEGORY_LABELS } from "@/domain/entities/cost";
import { formatCurrencyBRL } from "@/lib/currency";

/** Classes de cor por status (tokens semanticos com contraste AA). */
export const BUDGET_STATUS_TONE: Record<
  BudgetStatus,
  { badge: string; bar: string }
> = {
  "sem-orcamento": {
    badge: "border text-muted-foreground",
    bar: "bg-muted-foreground/40",
  },
  ok: { badge: "bg-success text-success-foreground", bar: "bg-success" },
  atencao: { badge: "bg-warning text-warning-foreground", bar: "bg-warning" },
  estourado: { badge: "bg-danger text-danger-foreground", bar: "bg-danger" },
};

/** Texto do alerta de orcamento (usado no Inicio e no snackbar pos-cadastro). */
export function describeBudgetAlert(summary: CategoryBudgetSummary): string {
  const label = COST_CATEGORY_LABELS[summary.category];
  const limit = formatCurrencyBRL(summary.limit ?? 0);
  const spent = formatCurrencyBRL(summary.spent);

  return summary.status === "estourado"
    ? `${label} estourou o orçamento: ${spent} de ${limit} (${summary.percent}%).`
    : `${label} atingiu ${summary.percent}% do orçamento: ${spent} de ${limit}.`;
}
