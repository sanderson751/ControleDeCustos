import { BudgetStatusBadge } from "@/components/budgets/BudgetStatusBadge";
import { BUDGET_STATUS_TONE } from "@/components/budgets/budgetPresentation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { GROCERY_COST_CATEGORY } from "@/domain/entities/grocery";
import { formatCompetenceLong, getCurrentCompetence } from "@/domain/rules/competence";
import { listBudgetCheck } from "@/domain/rules/groceryRules";
import { useMonthBudgets } from "@/hooks/useMonthBudgets";
import { useMonthCosts } from "@/hooks/useMonthCosts";
import { formatCurrencyBRL } from "@/lib/currency";
import { useCategories } from "@/providers/CategoriesProvider";

/** Gasto do mes + previsto da lista contra o orcamento de Alimentacao. */
export function ListBudgetCard({ userId, forecast }: { userId: string; forecast: number }) {
  const competence = getCurrentCompetence();
  const { catalog } = useCategories();
  const { entries, isLoading: loadingCosts, error: costsError } = useMonthCosts(userId, competence);
  const { limits, isLoading: loadingBudgets, error: budgetsError } = useMonthBudgets(userId, competence);
  const label = catalog.labelOf(GROCERY_COST_CATEGORY);

  if (costsError || budgetsError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">{`Orçamento de ${label}`}</CardTitle>
          <CardDescription role="alert">
            {`Não foi possível comparar a lista com o orçamento agora: ${costsError ?? budgetsError}`}
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (loadingCosts || loadingBudgets) {
    return null;
  }

  const spent =
    entries
      .filter((entry) => entry.category === GROCERY_COST_CATEGORY)
      .reduce((sum, entry) => sum + Math.round(entry.amount * 100), 0) / 100;
  const limit = limits.find((item) => item.category === GROCERY_COST_CATEGORY)?.limit ?? null;
  const check = listBudgetCheck(forecast, spent, limit);

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div className="space-y-1.5">
          <CardTitle className="text-xl">{`Orçamento de ${label}`}</CardTitle>
          <CardDescription>{formatCompetenceLong(competence)}</CardDescription>
        </div>
        {check.hasBudget && (
          <BudgetStatusBadge status={check.status} />
        )}
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        {check.hasBudget ? (
          <>
            <p>
              {`Gasto ${formatCurrencyBRL(check.spent)} + lista ${formatCurrencyBRL(check.forecast)} = `}
              <strong className="tabular-nums">{`${formatCurrencyBRL(check.projected)} de ${formatCurrencyBRL(check.limit)} (${check.percent}%)`}</strong>
            </p>
            <Progress
              value={Math.min(100, check.percent)}
              indicatorClassName={BUDGET_STATUS_TONE[check.status].bar}
              aria-label={`${label}: ${check.percent}% do orçamento com a lista`}
            />
            <p className="text-muted-foreground">
              {check.remaining >= 0
                ? `Sobram ${formatCurrencyBRL(check.remaining)} depois desta compra.`
                : `A lista ultrapassa o orçamento em ${formatCurrencyBRL(-check.remaining)}.`}
            </p>
          </>
        ) : (
          <p className="text-muted-foreground">
            {`Sem orçamento de ${label} neste mês. Gasto até agora: ${formatCurrencyBRL(spent)}.`}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
