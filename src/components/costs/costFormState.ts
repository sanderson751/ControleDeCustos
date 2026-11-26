import type { CostCategory, CostEntry, CostType } from "@/domain/entities/cost";
import type { CostFormValues } from "@/domain/rules/costRules";
import {
  parseMaskedCurrencyToNumber,
  toMaskedCurrencyFromNumber,
} from "@/lib/currency";

/** Estado bruto do formulario de custo (valores como digitados). */
export type CostFormState = {
  accountName: string;
  /** Valor mascarado, ex.: "R$ 1.234,56" */
  amount: string;
  costType: CostType;
  /** Vazio ate o usuario escolher (categoria e obrigatoria). */
  category: CostCategory | "";
  description: string;
  installmentsTotal: string;
};

export const EMPTY_COST_FORM: CostFormState = {
  accountName: "",
  amount: "",
  costType: "variavel",
  category: "",
  description: "",
  installmentsTotal: "1",
};

export function toCostFormValues(state: CostFormState): CostFormValues {
  return {
    accountName: state.accountName,
    amount: parseMaskedCurrencyToNumber(state.amount),
    costType: state.costType,
    category: state.category,
    description: state.description,
    installmentsTotal:
      state.costType === "fixo" ? Number(state.installmentsTotal) : 1,
  };
}

export function fromCostEntry(entry: CostEntry): CostFormState {
  return {
    accountName: entry.accountName,
    amount: toMaskedCurrencyFromNumber(entry.amount),
    costType: entry.costType,
    category: entry.category,
    description: entry.description,
    installmentsTotal: String(entry.installmentsTotal),
  };
}
