import { OctagonAlertIcon, TriangleAlertIcon } from "lucide-react";
import type { CategoryBudgetSummary } from "@/domain/entities/budget";
import { describeBudgetAlert } from "@/components/budgets/budgetPresentation";
import { cn } from "@/lib/utils";

/** Alertas de atencao (>= 80%) e estouro (>= 100%) da competencia. */
export function BudgetAlerts({
  alerts,
}: {
  alerts: readonly CategoryBudgetSummary[];
}) {
  if (alerts.length === 0) {
    return null;
  }

  return (
    <section aria-label="Alertas de orçamento" className="space-y-3">
      <h2 className="eyebrow text-muted-foreground">Alertas de orçamento</h2>
      <ul className="grid gap-3 md:grid-cols-2">
        {alerts.map((alert) => {
          const isOver = alert.status === "estourado";
          const Icon = isOver ? OctagonAlertIcon : TriangleAlertIcon;

          return (
            <li
              key={alert.category}
              role="alert"
              className={cn(
                "flex items-start gap-3 rounded-2xl p-4",
                isOver
                  ? "bg-danger text-danger-foreground"
                  : "bg-warning text-warning-foreground",
              )}
            >
              <Icon className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
              <p className="text-sm font-medium">{describeBudgetAlert(alert)}</p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
