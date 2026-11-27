import { ArrowRightIcon } from "lucide-react";
import { useEffect, useMemo } from "react";
import { Link } from "react-router";
import { BudgetAlerts } from "@/components/budgets/BudgetAlerts";
import { CategoryBreakdown } from "@/components/budgets/CategoryBreakdown";
import { CostTotalsGrid } from "@/components/costs/CostTotalsGrid";
import { GoalsSummary } from "@/components/goals/GoalsSummary";
import { CompetencePicker } from "@/components/shared/CompetencePicker";
import { PageHeader } from "@/components/shared/PageHeader";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  getBudgetAlerts,
  summarizeBudgets,
} from "@/domain/rules/budgetRules";
import { calculateTotals, sumByCategory } from "@/domain/rules/costRules";
import { canMutateCosts } from "@/domain/rules/permissions";
import { useCompetenceParam } from "@/hooks/useCompetenceParam";
import { useMonthBudgets } from "@/hooks/useMonthBudgets";
import { useMonthCosts } from "@/hooks/useMonthCosts";
import { formatCompetence } from "@/lib/dates";
import { notify } from "@/lib/notify";
import { useSession } from "@/providers/AuthProvider";
import { useCategories } from "@/providers/CategoriesProvider";
import { ROUTES, withCompetence } from "@/routes/navigation";

export default function HomePage() {
  const { profile } = useSession();
  const { catalog } = useCategories();
  const { competence, isCurrent, setCompetence } = useCompetenceParam();
  const { entries, isLoading, error } = useMonthCosts(
    profile.userId,
    competence,
  );
  const {
    limits,
    isLoading: isLoadingBudgets,
    error: budgetsError,
  } = useMonthBudgets(
    profile.userId,
    competence,
  );

  useEffect(() => {
    if (budgetsError) {
      notify("error", budgetsError);
    }
  }, [budgetsError]);

  const totals = useMemo(() => calculateTotals(entries), [entries]);
  const categoryTotals = useMemo(() => sumByCategory(entries), [entries]);
  const budgetSummaries = useMemo(
    () => summarizeBudgets(entries, limits, catalog.ids),
    [catalog.ids, entries, limits],
  );
  const alerts = useMemo(
    () => (isLoading || isLoadingBudgets ? [] : getBudgetAlerts(budgetSummaries)),
    [budgetSummaries, isLoading, isLoadingBudgets],
  );
  const firstName =
    profile.displayName.trim().split(/\s+/)[0] || profile.email || "Usuário";
  const competenceLabel = formatCompetence(competence.month, competence.year);

  return (
    <section className="space-y-10" data-testid="home-page-screen">
      <PageHeader
        eyebrow={`Competência ${competenceLabel}`}
        title={
          <>
            Olá, <em className="italic">{firstName}</em>
          </>
        }
        description="Acompanhe o total do mês, a distribuição por categoria e o consumo do orçamento."
        actions={
          <Button asChild size="lg">
            <Link to={withCompetence(ROUTES.costs, competence)}>
              {canMutateCosts(profile.role) ? "Registrar custo" : "Ver custos"}
              <ArrowRightIcon aria-hidden="true" />
            </Link>
          </Button>
        }
      />

      <CompetencePicker
        competence={competence}
        isCurrent={isCurrent}
        onChange={setCompetence}
      />

      <CostTotalsGrid
        totals={totals}
        isLoading={isLoading}
        labels={{ total: "Total de custos" }}
      />

      <BudgetAlerts alerts={alerts} />

      <CategoryBreakdown
        totals={categoryTotals}
        budgets={budgetSummaries}
        isLoading={isLoading}
      />

      <GoalsSummary userId={profile.userId} competence={competence} />

      <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-6 text-sm text-muted-foreground">
        <p>Competência: {competenceLabel}</p>
        <p>Lançamentos considerados: {isLoading ? "—" : entries.length}</p>
      </div>

      {(error || budgetsError) && (
        <Alert>
          <AlertDescription>
            {[error, budgetsError && `${budgetsError} Os alertas de orçamento podem estar incompletos.`]
              .filter(Boolean)
              .join(" ")}
          </AlertDescription>
        </Alert>
      )}
    </section>
  );
}
