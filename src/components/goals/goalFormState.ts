import type {
  ContributionFormValues,
  ContributionKind,
  GoalFormValues,
  SavingsGoal,
} from "@/domain/entities/savingsGoal";
import { toInputDate } from "@/lib/dates";
import {
  parseMaskedCurrencyToNumber,
  toMaskedCurrencyFromNumber,
} from "@/lib/currency";

export type GoalFormState = {
  name: string;
  target: string;
  hasDeadline: boolean;
  /** "1".."12" */
  deadlineMonth: string;
  deadlineYear: string;
};

export function emptyGoalForm(now: Date = new Date()): GoalFormState {
  return {
    name: "",
    target: "",
    hasDeadline: false,
    deadlineMonth: String(now.getMonth() + 1),
    deadlineYear: String(now.getFullYear() + 1),
  };
}

export function goalFormFrom(goal: SavingsGoal, now: Date = new Date()): GoalFormState {
  return {
    name: goal.name,
    target: toMaskedCurrencyFromNumber(goal.targetAmount),
    hasDeadline: goal.deadline !== null,
    deadlineMonth: String(goal.deadline?.month ?? now.getMonth() + 1),
    deadlineYear: String(goal.deadline?.year ?? now.getFullYear() + 1),
  };
}

export function toGoalValues(state: GoalFormState): GoalFormValues {
  return {
    name: state.name,
    targetAmount: parseMaskedCurrencyToNumber(state.target),
    deadline: state.hasDeadline
      ? { year: Number(state.deadlineYear), month: Number(state.deadlineMonth) }
      : null,
  };
}

export type ContributionFormState = {
  kind: ContributionKind;
  amount: string;
  /** "AAAA-MM-DD" (input type="date"). */
  date: string;
  note: string;
};

export function emptyContributionForm(
  kind: ContributionKind = "deposito",
  now: Date = new Date(),
): ContributionFormState {
  return { kind, amount: "", date: toInputDate(now), note: "" };
}

export function toContributionValues(state: ContributionFormState): ContributionFormValues {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(state.date) ? new Date(`${state.date}T12:00:00`) : null;
  return {
    kind: state.kind,
    amount: parseMaskedCurrencyToNumber(state.amount),
    date,
    note: state.note,
  };
}
