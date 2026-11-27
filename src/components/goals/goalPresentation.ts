import type { GoalSummary } from "@/domain/entities/savingsGoal";
import { formatCompetenceShort } from "@/domain/rules/competence";
import { formatCurrencyBRL } from "@/lib/currency";

/** Texto de orientacao da meta (prazo e quanto guardar por mes). */
export function goalGuidance(summary: GoalSummary): string {
  const { status, goal, monthlyNeeded, monthsLeft, remaining } = summary;

  if (status === "concluida") {
    return "Meta atingida!";
  }

  if (status === "atrasada" && goal.deadline) {
    return `Prazo vencido em ${formatCompetenceShort(goal.deadline)}: faltam ${formatCurrencyBRL(remaining)}.`;
  }

  if (monthlyNeeded !== null && monthsLeft !== null && goal.deadline) {
    return `Guardar ${formatCurrencyBRL(monthlyNeeded)} por mês até ${formatCompetenceShort(goal.deadline)} (${monthsLeft} ${monthsLeft === 1 ? "mês" : "meses"}).`;
  }

  return "Sem prazo definido.";
}
