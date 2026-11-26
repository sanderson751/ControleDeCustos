import { BUDGET_STATUS_TONE } from "@/components/budgets/budgetPresentation";
import {
  BUDGET_STATUS_LABELS,
  type BudgetStatus,
} from "@/domain/entities/budget";
import { cn } from "@/lib/utils";

/** Status sempre com texto (nao depende so de cor). */
export function BudgetStatusBadge({ status }: { status: BudgetStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 font-mono text-[11px] font-medium tracking-wider whitespace-nowrap uppercase",
        BUDGET_STATUS_TONE[status].badge,
      )}
    >
      {BUDGET_STATUS_LABELS[status]}
    </span>
  );
}
