import type {
  BudgetStatus,
  BudgetMode,
  RecurringBudget,
  CategoryBudgetSummary,
} from "@/domain/entities/budget";
import type { Competence, CostCategory } from "@/domain/entities/cost";
import { DEFAULT_CATALOG } from "@/domain/rules/categoryRules";
import { formatCompetenceShort } from "@/domain/rules/competence";
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
export function describeBudgetAlert(
  summary: CategoryBudgetSummary,
  labelOf: (id: CostCategory) => string = DEFAULT_CATALOG.labelOf,
): string {
  const label = labelOf(summary.category);
  const limit = formatCurrencyBRL(summary.limit ?? 0);
  const spent = formatCurrencyBRL(summary.spent);

  return summary.status === "estourado"
    ? `${label} estourou o orçamento: ${spent} de ${limit} (${summary.percent}%).`
    : `${label} atingiu ${summary.percent}% do orçamento: ${spent} de ${limit}.`;
}

type DraftOriginInput = {
  mode: BudgetMode;
  /** Valor digitado (null = vazio). */
  value: number | null;
  /** Vigencia recorrente ativa no mes (ja resolvida). */
  active: RecurringBudget | null;
  /** Vigencias da categoria que comecam depois do mes. */
  future: readonly RecurringBudget[];
  competence: Competence;
};

/**
 * Legenda de origem que acompanha o rascunho: mostra de onde vem o limite e o
 * efeito da gravacao (nova vigencia, encerramento, substituicao de futuras).
 */
export function describeDraftOrigin({
  mode,
  value,
  active,
  future,
  competence,
}: DraftOriginInput): string {
  const month = formatCompetenceShort(competence);
  const activeLimit = active?.limit ?? null;

  if (mode === "mensal") {
    if (value === null) {
      return active && activeLimit !== null
        ? `Recorrente (${formatCurrencyBRL(activeLimit)}): não é possível remover só neste mês`
        : "";
    }

    return active && activeLimit !== null
      ? `Somente neste mês (recorrente: ${formatCurrencyBRL(activeLimit)})`
      : "Somente neste mês";
  }

  const replacesFuture = future.length
    ? ` · substitui as alterações a partir de ${formatCompetenceShort(future[0])}`
    : "";

  if (value === null) {
    if (active) {
      return `Recorrência encerrada a partir de ${month}${replacesFuture}`;
    }
    return future.length ? `Remove as alterações a partir de ${formatCompetenceShort(future[0])}` : "";
  }

  if (active && value === activeLimit && !future.length) {
    return `Recorrente desde ${formatCompetenceShort(active)}`;
  }

  return `Recorrente a partir de ${month}${replacesFuture}`;
}
