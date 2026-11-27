import { ArrowRightIcon } from "lucide-react";
import { Link } from "react-router";
import { goalGuidance } from "@/components/goals/goalPresentation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { Competence } from "@/domain/entities/cost";
import { formatCompetenceLong } from "@/domain/rules/competence";
import {
  homeGoalHighlights,
  savedInCompetence,
} from "@/domain/rules/savingsGoalRules";
import { useSavingsGoals } from "@/hooks/useSavingsGoals";
import { formatCurrencyBRL } from "@/lib/currency";
import { ROUTES } from "@/routes/navigation";

/** Resumo do Inicio: guardado no mes e metas mais urgentes. Oculto sem metas. */
export function GoalsSummary({
  userId,
  competence,
}: {
  userId: string;
  competence: Competence;
}) {
  const { summaries, contributions, isLoading, error } = useSavingsGoals(userId);

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Metas de economia</CardTitle>
          <CardDescription role="alert">{error}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (isLoading || summaries.length === 0) {
    return null;
  }

  const savedThisMonth = savedInCompetence(contributions, competence);
  const highlights = homeGoalHighlights(summaries);

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1.5">
          <CardTitle>Metas de economia</CardTitle>
          <CardDescription>
            {`Guardado em ${formatCompetenceLong(competence)}: `}
            <strong className="font-semibold text-foreground tabular-nums">
              {formatCurrencyBRL(savedThisMonth)}
            </strong>
          </CardDescription>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link to={ROUTES.goals}>
            Ver metas
            <ArrowRightIcon aria-hidden="true" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent className="space-y-5">
        {highlights.length === 0 ? (
          <p className="text-sm text-muted-foreground">Todas as metas foram atingidas.</p>
        ) : (
          highlights.map((summary) => (
            <div key={summary.goal.id} className="space-y-2">
              <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
                <span className="font-medium">{summary.goal.name}</span>
                <span className="text-muted-foreground tabular-nums">
                  {`${formatCurrencyBRL(summary.saved)} de ${formatCurrencyBRL(summary.goal.targetAmount)}`}
                </span>
              </div>
              <Progress
                value={summary.percent}
                aria-label={`${summary.goal.name}: ${summary.percent}% do alvo`}
              />
              <p className="text-xs text-muted-foreground">{goalGuidance(summary)}</p>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
