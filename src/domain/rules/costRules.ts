import type {
  CostEntry,
  CostFilter,
  CostTotals,
  CostType,
  NewCostInput,
} from "@/domain/entities/cost";

export const MAX_INSTALLMENTS = 120;

/** Soma os custos fixos, variaveis e o total geral. */
export function calculateTotals(entries: readonly CostEntry[]): CostTotals {
  let fixedTotal = 0;
  let variableTotal = 0;

  for (const entry of entries) {
    if (entry.costType === "fixo") {
      fixedTotal += entry.amount;
    } else {
      variableTotal += entry.amount;
    }
  }

  return {
    fixedTotal: roundCurrency(fixedTotal),
    variableTotal: roundCurrency(variableTotal),
    total: roundCurrency(fixedTotal + variableTotal),
  };
}

export function filterByCostType(
  entries: readonly CostEntry[],
  filter: CostFilter,
): CostEntry[] {
  return filter === "todos"
    ? [...entries]
    : entries.filter((entry) => entry.costType === filter);
}

export function sortByCreatedAtDesc(
  entries: readonly CostEntry[],
): CostEntry[] {
  return [...entries].sort(
    (left, right) => right.createdAt.getTime() - left.createdAt.getTime(),
  );
}

/** Custos variaveis sempre possuem 1 parcela; fixos entre 1 e MAX_INSTALLMENTS. */
export function normalizeInstallments(
  costType: CostType,
  installmentsTotal: number | undefined,
): number {
  if (costType !== "fixo") {
    return 1;
  }

  const value = Math.trunc(Number(installmentsTotal ?? 1));
  if (!Number.isFinite(value) || value < 1) {
    return 1;
  }

  return Math.min(value, MAX_INSTALLMENTS);
}

/** Soma meses preservando o ultimo dia valido (31/01 + 1 mes = ultimo dia de fevereiro). */
export function addMonths(baseDate: Date, monthsToAdd: number): Date {
  const result = new Date(baseDate);
  const originalDay = result.getDate();
  result.setDate(1);
  result.setMonth(result.getMonth() + monthsToAdd);
  const lastDayOfMonth = new Date(
    result.getFullYear(),
    result.getMonth() + 1,
    0,
  ).getDate();
  result.setDate(Math.min(originalDay, lastDayOfMonth));
  return result;
}

export type InstallmentPlan = {
  installmentIndex: number;
  competenceYear: number;
  competenceMonth: number;
  /** Data de criacao da parcela quando informada manualmente; null = horario do servidor. */
  createdAt: Date | null;
};

/**
 * Gera uma entrada por parcela. Cada parcela cai na competencia do mes seguinte
 * ao da anterior, a partir da data base (manual ou atual).
 */
export function buildInstallmentPlan(
  input: Pick<
    NewCostInput,
    "costType" | "installmentsTotal" | "createdAtManual"
  >,
  now: Date = new Date(),
): InstallmentPlan[] {
  const installmentsTotal = normalizeInstallments(
    input.costType,
    input.installmentsTotal,
  );
  const baseDate = input.createdAtManual ?? now;

  return Array.from({ length: installmentsTotal }, (_, installmentIndex) => {
    const installmentDate = addMonths(baseDate, installmentIndex);

    return {
      installmentIndex,
      competenceYear: installmentDate.getFullYear(),
      competenceMonth: installmentDate.getMonth() + 1,
      createdAt: input.createdAtManual ? installmentDate : null,
    };
  });
}

export type CostFormValues = {
  accountName: string;
  amount: number;
  costType: CostType;
  installmentsTotal: number;
};

export type ValidationResult = { ok: true } | { ok: false; message: string };

export function validateCostForm(values: CostFormValues): ValidationResult {
  if (!values.accountName.trim()) {
    return { ok: false, message: "Informe o nome da conta." };
  }

  if (!Number.isFinite(values.amount) || values.amount <= 0) {
    return { ok: false, message: "Informe um valor maior que zero." };
  }

  if (
    values.costType === "fixo" &&
    (!Number.isInteger(values.installmentsTotal) ||
      values.installmentsTotal < 1 ||
      values.installmentsTotal > MAX_INSTALLMENTS)
  ) {
    return {
      ok: false,
      message: `Total de parcelas deve ser um número inteiro entre 1 e ${MAX_INSTALLMENTS}.`,
    };
  }

  return { ok: true };
}

export function paginate<T>(
  items: readonly T[],
  page: number,
  pageSize: number,
) {
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const currentPage = Math.min(Math.max(1, page), totalPages);
  const startIndex = (currentPage - 1) * pageSize;

  return {
    items: items.slice(startIndex, startIndex + pageSize),
    currentPage,
    totalPages,
  };
}

function roundCurrency(value: number) {
  return Math.round(value * 100) / 100;
}
