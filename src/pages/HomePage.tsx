import { ArrowRightIcon } from "lucide-react";
import { useMemo } from "react";
import { Link } from "react-router";
import { CostTotalsGrid } from "@/components/costs/CostTotalsGrid";
import { PageHeader } from "@/components/shared/PageHeader";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { calculateTotals } from "@/domain/rules/costRules";
import { canMutateCosts } from "@/domain/rules/permissions";
import { getCurrentCompetence, useMonthCosts } from "@/hooks/useMonthCosts";
import { formatCompetence } from "@/lib/dates";
import { useSession } from "@/providers/AuthProvider";
import { ROUTES } from "@/routes/navigation";

export default function HomePage() {
  const { profile } = useSession();
  const { year, month } = useMemo(() => getCurrentCompetence(), []);
  const { entries, isLoading, error } = useMonthCosts(
    profile.userId,
    year,
    month,
  );
  const totals = useMemo(() => calculateTotals(entries), [entries]);
  const firstName =
    profile.displayName.trim().split(/\s+/)[0] || profile.email || "Usuário";

  return (
    <section className="space-y-10" data-testid="home-page-screen">
      <PageHeader
        eyebrow={`Competência ${formatCompetence(month, year)}`}
        title={
          <>
            Olá, <em className="italic">{firstName}</em>
          </>
        }
        description="Acompanhe o total do mês e a distribuição entre custos fixos e variáveis."
        actions={
          <Button asChild size="lg">
            <Link to={ROUTES.costs}>
              {canMutateCosts(profile.role) ? "Registrar custo" : "Ver custos"}
              <ArrowRightIcon aria-hidden="true" />
            </Link>
          </Button>
        }
      />

      <CostTotalsGrid
        totals={totals}
        isLoading={isLoading}
        labels={{ total: "Total de custos" }}
      />

      <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-6 text-sm text-muted-foreground">
        <p>Competência atual: {formatCompetence(month, year)}</p>
        <p>Lançamentos considerados: {isLoading ? "—" : entries.length}</p>
      </div>

      {error && (
        <Alert>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </section>
  );
}
