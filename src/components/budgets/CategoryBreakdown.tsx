import { BUDGET_STATUS_TONE } from "@/components/budgets/budgetPresentation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { CategoryBudgetSummary } from "@/domain/entities/budget";
import type { CategoryTotal } from "@/domain/entities/cost";
import { formatCurrencyBRL } from "@/lib/currency";
import { useCategories } from "@/providers/CategoriesProvider";

type CategoryBreakdownProps = {
  totals: readonly CategoryTotal[];
  budgets: readonly CategoryBudgetSummary[];
  isLoading?: boolean;
};

/** Consolidado do mes por categoria + consumo do orcamento quando houver. */
export function CategoryBreakdown({
  totals,
  budgets,
  isLoading = false,
}: CategoryBreakdownProps) {
  const { catalog } = useCategories();
  const budgetByCategory = new Map(
    budgets.map((summary) => [summary.category, summary]),
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Gastos por categoria</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-muted-foreground" aria-live="polite">
            Carregando...
          </p>
        ) : totals.length === 0 ? (
          <p className="text-muted-foreground">
            Nenhum lançamento nesta competência.
          </p>
        ) : (
          <ul className="space-y-5" aria-label="Consolidado por categoria">
            {totals.map((item) => {
              const budget = budgetByCategory.get(item.category);
              const hasBudget = budget?.limit != null;
              const label = catalog.labelOf(item.category);

              return (
                <li key={item.category} className="space-y-2">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-medium">{label}</span>
                    <span className="text-sm tabular-nums">
                      {formatCurrencyBRL(item.total)}
                      <span className="ml-2 text-muted-foreground">
                        {Math.round(item.share * 100)}% do total
                      </span>
                    </span>
                  </div>
                  <Progress
                    value={Math.min(100, hasBudget ? (budget.percent ?? 0) : item.share * 100)}
                    aria-label={
                      hasBudget
                        ? `${label}: ${budget.percent}% do orçamento`
                        : `${label}: ${Math.round(item.share * 100)}% do total`
                    }
                    indicatorClassName={
                      hasBudget
                        ? BUDGET_STATUS_TONE[budget.status].bar
                        : "bg-primary"
                    }
                  />
                  {hasBudget && (
                    <p className="text-xs text-muted-foreground">
                      {budget.percent}% do orçamento de{" "}
                      {formatCurrencyBRL(budget.limit ?? 0)}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
