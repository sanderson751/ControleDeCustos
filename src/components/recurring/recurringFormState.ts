import type { CostCategory, CostType } from "@/domain/entities/cost";
import {
  MAX_RECURRING_DAY,
  type RecurringCost,
  type RecurringCostFormValues,
} from "@/domain/entities/recurringCost";
import {
  getCurrentCompetence,
  parseCompetenceParam,
  toCompetenceParam,
} from "@/domain/rules/competence";
import {
  parseMaskedCurrencyToNumber,
  toMaskedCurrencyFromNumber,
} from "@/lib/currency";

/** Estado do formulario como texto (o que o usuario digita). */
export type RecurringFormState = {
  accountName: string;
  amount: string;
  category: CostCategory | "";
  costType: CostType;
  dayOfMonth: string;
  /** "AAAA-MM" (input type="month"). */
  start: string;
  description: string;
};

export function emptyRecurringForm(now: Date = new Date()): RecurringFormState {
  return {
    accountName: "",
    amount: "",
    category: "",
    costType: "fixo",
    dayOfMonth: String(Math.min(now.getDate(), MAX_RECURRING_DAY)),
    start: toCompetenceParam(getCurrentCompetence(now)),
    description: "",
  };
}

export function recurringFormFrom(recurring: RecurringCost): RecurringFormState {
  return {
    accountName: recurring.accountName,
    amount: toMaskedCurrencyFromNumber(recurring.amount),
    category: recurring.category,
    costType: recurring.costType,
    dayOfMonth: String(recurring.dayOfMonth),
    start: toCompetenceParam(recurring.start),
    description: recurring.description,
  };
}

export function toRecurringValues(state: RecurringFormState): RecurringCostFormValues {
  return {
    accountName: state.accountName,
    amount: parseMaskedCurrencyToNumber(state.amount),
    category: state.category,
    costType: state.costType,
    dayOfMonth: state.dayOfMonth.trim() ? Number(state.dayOfMonth) : Number.NaN,
    start: parseCompetenceParam(state.start) ?? { year: Number.NaN, month: Number.NaN },
    description: state.description,
  };
}
