import type { Competence } from "@/domain/entities/cost";
import {
  type ContributionFormValues,
  type GoalContribution,
  type GoalFormValues,
  type GoalStatus,
  type GoalSummary,
  HOME_GOAL_HIGHLIGHTS,
  MAX_CONTRIBUTION_NOTE_LENGTH,
  MAX_GOAL_AMOUNT,
  MAX_GOAL_NAME_LENGTH,
  type SavingsGoal,
} from "@/domain/entities/savingsGoal";
import { getCurrentCompetence } from "@/domain/rules/competence";
import { normalizeSearchText } from "@/domain/rules/costRules";
import { formatCurrencyBRL } from "@/lib/currency";

const toCents = (value: number) => Math.round(value * 100);
const indexOf = ({ year, month }: Competence) => year * 12 + (month - 1);

export type Validation<T> = { ok: true; values: T } | { ok: false; message: string };

export function validateGoalForm(
  values: GoalFormValues,
  goals: readonly SavingsGoal[],
  now: Date = new Date(),
  options: { editingId?: string; originalDeadline?: Competence | null } = {},
): Validation<GoalFormValues> {
  const name = values.name.trim().replace(/\s+/g, " ");

  if (!name) {
    return { ok: false, message: "Informe o nome da meta." };
  }

  if (name.length > MAX_GOAL_NAME_LENGTH) {
    return {
      ok: false,
      message: `O nome pode ter no máximo ${MAX_GOAL_NAME_LENGTH} caracteres.`,
    };
  }

  const key = normalizeSearchText(name);
  const duplicate = goals.find(
    (goal) => goal.id !== options.editingId && normalizeSearchText(goal.name) === key,
  );

  if (duplicate) {
    return { ok: false, message: `Já existe uma meta chamada "${duplicate.name}".` };
  }

  if (!Number.isFinite(values.targetAmount) || values.targetAmount <= 0) {
    return { ok: false, message: "Informe um valor-alvo maior que zero." };
  }

  if (values.targetAmount > MAX_GOAL_AMOUNT) {
    return { ok: false, message: "O valor-alvo informado é muito alto." };
  }

  if (values.deadline) {
    const keepsOriginal =
      options.originalDeadline != null &&
      indexOf(options.originalDeadline) === indexOf(values.deadline);

    if (
      !keepsOriginal &&
      indexOf(values.deadline) < indexOf(getCurrentCompetence(now))
    ) {
      return { ok: false, message: "O prazo deve ser a partir do mês atual." };
    }
  }

  return { ok: true, values: { ...values, name } };
}

/** Valor com sinal da movimentacao (retirada negativa). */
export function signedAmount(values: Pick<ContributionFormValues, "kind" | "amount">): number {
  return values.kind === "retirada" ? -Math.abs(values.amount) : Math.abs(values.amount);
}

export function validateContribution(
  values: ContributionFormValues,
  saved: number,
  now: Date = new Date(),
): Validation<ContributionFormValues & { date: Date }> {
  if (!Number.isFinite(values.amount) || values.amount <= 0) {
    return { ok: false, message: "Informe um valor maior que zero." };
  }

  if (values.amount > MAX_GOAL_AMOUNT) {
    return { ok: false, message: "O valor informado é muito alto." };
  }

  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  if (
    !values.date ||
    Number.isNaN(values.date.getTime()) ||
    values.date.getFullYear() < 2000 ||
    values.date > endOfToday
  ) {
    return { ok: false, message: "Informe uma data válida, até hoje." };
  }

  if (values.note.trim().length > MAX_CONTRIBUTION_NOTE_LENGTH) {
    return {
      ok: false,
      message: `A observação pode ter no máximo ${MAX_CONTRIBUTION_NOTE_LENGTH} caracteres.`,
    };
  }

  if (values.kind === "retirada" && toCents(values.amount) > toCents(saved)) {
    return {
      ok: false,
      message: `A retirada não pode ser maior que o valor guardado (${formatCurrencyBRL(Math.max(saved, 0))}).`,
    };
  }

  return { ok: true, values: { ...values, date: values.date, note: values.note.trim() } };
}

/** Saldo guardado de uma meta (depositos - retiradas), em centavos exatos. */
export function savedFor(goalId: string, contributions: readonly GoalContribution[]): number {
  return (
    contributions
      .filter((item) => item.goalId === goalId)
      .reduce((sum, item) => sum + toCents(item.amount), 0) / 100
  );
}

export function summarizeGoal(
  goal: SavingsGoal,
  contributions: readonly GoalContribution[],
  now: Date = new Date(),
): GoalSummary {
  // Saldo negativo (ex.: deposito excluido apos retiradas, abas concorrentes)
  // e exibido como zero: "falta" nunca passa do alvo.
  const savedCents = Math.max(Math.round(savedFor(goal.id, contributions) * 100), 0);
  const targetCents = Math.max(toCents(goal.targetAmount), 0);
  const remainingCents = Math.max(targetCents - savedCents, 0);
  const percent =
    targetCents > 0
      ? Math.min(100, Math.max(0, Math.floor((savedCents * 100) / targetCents)))
      : 0;
  const current = indexOf(getCurrentCompetence(now));
  const deadline = goal.deadline ? indexOf(goal.deadline) : null;

  let status: GoalStatus = "em-andamento";
  if (targetCents > 0 && remainingCents === 0) {
    status = "concluida";
  } else if (deadline !== null && deadline < current) {
    status = "atrasada";
  }

  const monthsLeft = deadline !== null && deadline >= current ? deadline - current + 1 : null;
  let monthlyNeeded: number | null = null;

  if (status === "atrasada") {
    monthlyNeeded = remainingCents / 100;
  } else if (status === "em-andamento" && monthsLeft !== null) {
    monthlyNeeded = Math.ceil(remainingCents / monthsLeft) / 100;
  }

  return {
    goal,
    saved: savedCents / 100,
    remaining: remainingCents / 100,
    percent,
    status,
    monthsLeft,
    monthlyNeeded,
  };
}

/**
 * Excluir um deposito nao pode deixar o saldo negativo (as retiradas
 * posteriores dependiam dele). Retiradas podem sempre ser excluidas.
 */
export function validateContributionDeletion(
  contribution: GoalContribution,
  contributions: readonly GoalContribution[],
): { ok: true } | { ok: false; message: string } {
  if (contribution.amount <= 0) {
    return { ok: true };
  }

  const savedCents = Math.round(savedFor(contribution.goalId, contributions) * 100);

  if (savedCents - toCents(contribution.amount) < 0) {
    return {
      ok: false,
      message: `Este depósito não pode ser excluído: o saldo ficaria negativo (guardado atual ${formatCurrencyBRL(savedCents / 100)}). Exclua antes as retiradas correspondentes.`,
    };
  }

  return { ok: true };
}

/** Guardado no mes: depositos - retiradas com data na competencia. */
export function savedInCompetence(
  contributions: readonly GoalContribution[],
  { year, month }: Competence,
  existingGoalIds?: ReadonlySet<string>,
): number {
  return (
    contributions
      .filter(
        (item) =>
          item.date.getFullYear() === year &&
          item.date.getMonth() + 1 === month &&
          (!existingGoalIds || existingGoalIds.has(item.goalId)),
      )
      .reduce((sum, item) => sum + toCents(item.amount), 0) / 100
  );
}

/** Ordem de exibicao: atrasadas, em andamento (prazo mais proximo; sem prazo por ultimo), concluidas. */
export function sortGoalSummaries(summaries: readonly GoalSummary[]): GoalSummary[] {
  const rank: Record<GoalStatus, number> = { atrasada: 0, "em-andamento": 1, concluida: 2 };
  const deadlineOf = (item: GoalSummary) =>
    item.goal.deadline ? indexOf(item.goal.deadline) : Number.POSITIVE_INFINITY;

  return [...summaries].sort(
    (left, right) =>
      rank[left.status] - rank[right.status] ||
      deadlineOf(left) - deadlineOf(right) ||
      left.goal.name.localeCompare(right.goal.name, "pt-BR"),
  );
}

/** Destaques do Inicio: ate 3 metas nao concluidas, as mais urgentes primeiro. */
export function homeGoalHighlights(summaries: readonly GoalSummary[]): GoalSummary[] {
  return sortGoalSummaries(summaries)
    .filter((item) => item.status !== "concluida")
    .slice(0, HOME_GOAL_HIGHLIGHTS);
}
