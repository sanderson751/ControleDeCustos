import {
  type CategoryFilter,
  type CategoryTotal,
  COST_CATEGORIES,
  type CostCategory,
  type CostEntry,
  type CostFilter,
  type CostTotals,
  type CostType,
  FALLBACK_CATEGORY,
  MAX_DESCRIPTION_LENGTH,
  type NewCostInput,
} from "@/domain/entities/cost";

export const MAX_INSTALLMENTS = 120;

export function isCostCategory(value: unknown): value is CostCategory {
  return (
    typeof value === "string" &&
    (COST_CATEGORIES as readonly string[]).includes(value)
  );
}

/** Categoria valida ou "outros" (lancamentos legados sem categoria). */
export function normalizeCategory(value: unknown): CostCategory {
  return isCostCategory(value) ? value : FALLBACK_CATEGORY;
}

/** Texto para busca: minusculas, sem acentos e com espacos colapsados. */
export function normalizeSearchText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Termo (normalizado) contido na conta OU na descricao (campos separados); vazio aceita tudo. */
export function matchesSearch(entry: CostEntry, term: string): boolean {
  const normalizedTerm = normalizeSearchText(term);

  if (!normalizedTerm) {
    return true;
  }

  return (
    normalizeSearchText(entry.accountName).includes(normalizedTerm) ||
    normalizeSearchText(entry.description).includes(normalizedTerm)
  );
}

export function filterCosts(
  entries: readonly CostEntry[],
  filters: { costType: CostFilter; category: CategoryFilter; search?: string },
): CostEntry[] {
  return entries.filter(
    (entry) =>
      (filters.costType === "todos" || entry.costType === filters.costType) &&
      (filters.category === "todas" || entry.category === filters.category) &&
      matchesSearch(entry, filters.search ?? ""),
  );
}

/**
 * Consolidado por categoria: soma, participacao no total e ordenacao do
 * maior para o menor. Categorias sem lancamento nao aparecem.
 */
export function sumByCategory(entries: readonly CostEntry[]): CategoryTotal[] {
  const totals = new Map<CostCategory, number>();
  let grandTotal = 0;

  for (const entry of entries) {
    totals.set(entry.category, (totals.get(entry.category) ?? 0) + entry.amount);
    grandTotal += entry.amount;
  }

  return [...totals.entries()]
    .map(([category, total]) => ({
      category,
      total: roundCurrency(total),
      share: grandTotal > 0 ? total / grandTotal : 0,
    }))
    .sort(
      (left, right) =>
        right.total - left.total ||
        COST_CATEGORIES.indexOf(left.category) -
          COST_CATEGORIES.indexOf(right.category),
    );
}

/** Total gasto por categoria (todas as categorias, zero quando sem lancamento). */
export function spentByCategory(
  entries: readonly CostEntry[],
): Record<CostCategory, number> {
  const result = Object.fromEntries(
    COST_CATEGORIES.map((category) => [category, 0]),
  ) as Record<CostCategory, number>;

  for (const entry of entries) {
    result[entry.category] = roundCurrency(
      result[entry.category] + entry.amount,
    );
  }

  return result;
}

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
  /** Vazio quando o usuario ainda nao selecionou. */
  category: CostCategory | "";
  description: string;
  installmentsTotal: number;
};

export type ValidCostFormValues = CostFormValues & { category: CostCategory };

export type CostValidationResult =
  | { ok: true; values: ValidCostFormValues }
  | { ok: false; message: string };

export function validateCostForm(values: CostFormValues): CostValidationResult {
  if (!values.accountName.trim()) {
    return { ok: false, message: "Informe o nome da conta." };
  }

  if (!Number.isFinite(values.amount) || values.amount <= 0) {
    return { ok: false, message: "Informe um valor maior que zero." };
  }

  if (!isCostCategory(values.category)) {
    return { ok: false, message: "Selecione uma categoria." };
  }

  if (values.description.trim().length > MAX_DESCRIPTION_LENGTH) {
    return {
      ok: false,
      message: `A descrição pode ter no máximo ${MAX_DESCRIPTION_LENGTH} caracteres.`,
    };
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

  return { ok: true, values: { ...values, category: values.category } };
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
