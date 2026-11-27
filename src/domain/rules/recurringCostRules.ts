import { MAX_DESCRIPTION_LENGTH, type Competence } from "@/domain/entities/cost";
import {
  MAX_CATCH_UP_MONTHS,
  MAX_RECURRING_AMOUNT,
  MAX_RECURRING_DAY,
  type RecurringCost,
  type RecurringCostFormValues,
  type RecurringCostInput,
  START_WINDOW_MONTHS,
} from "@/domain/entities/recurringCost";
import { MAX_ACCOUNT_NAME_LENGTH } from "@/domain/entities/statementImport";
import {
  getCurrentCompetence,
  shiftCompetence,
  toCompetenceParam,
} from "@/domain/rules/competence";
import { isCostCategory } from "@/domain/rules/costRules";

function indexOf({ year, month }: Competence): number {
  return year * 12 + (month - 1);
}

function fromIndex(index: number): Competence {
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

export type RecurringValidation =
  | { ok: true; values: RecurringCostInput }
  | { ok: false; message: string };

export function validateRecurringForm(
  values: RecurringCostFormValues,
  now: Date = new Date(),
  /** Edicao: o inicio salvo continua valido mesmo fora da janela (recorrencia antiga). */
  options: { originalStart?: Competence } = {},
): RecurringValidation {
  const accountName = values.accountName.trim();
  const description = values.description.trim();

  if (!accountName) {
    return { ok: false, message: "Informe o nome da conta." };
  }

  if (accountName.length > MAX_ACCOUNT_NAME_LENGTH) {
    return {
      ok: false,
      message: `O nome da conta pode ter no máximo ${MAX_ACCOUNT_NAME_LENGTH} caracteres.`,
    };
  }

  if (!Number.isFinite(values.amount) || values.amount <= 0) {
    return { ok: false, message: "Informe um valor maior que zero." };
  }

  if (values.amount > MAX_RECURRING_AMOUNT) {
    return { ok: false, message: "O valor informado é muito alto." };
  }

  if (!isCostCategory(values.category)) {
    return { ok: false, message: "Selecione uma categoria." };
  }

  if (
    !Number.isInteger(values.dayOfMonth) ||
    values.dayOfMonth < 1 ||
    values.dayOfMonth > MAX_RECURRING_DAY
  ) {
    return {
      ok: false,
      message: `O dia do mês deve estar entre 1 e ${MAX_RECURRING_DAY}.`,
    };
  }

  const current = indexOf(getCurrentCompetence(now));
  const start = indexOf(values.start);
  const keepsOriginalStart =
    options.originalStart !== undefined && indexOf(options.originalStart) === start;

  if (
    !Number.isInteger(values.start.year) ||
    !Number.isInteger(values.start.month) ||
    values.start.month < 1 ||
    values.start.month > 12 ||
    (!keepsOriginalStart && Math.abs(start - current) > START_WINDOW_MONTHS)
  ) {
    return {
      ok: false,
      message: `O início deve estar entre ${START_WINDOW_MONTHS} meses atrás e ${START_WINDOW_MONTHS} meses à frente.`,
    };
  }

  if (description.length > MAX_DESCRIPTION_LENGTH) {
    return {
      ok: false,
      message: `A descrição pode ter no máximo ${MAX_DESCRIPTION_LENGTH} caracteres.`,
    };
  }

  return {
    ok: true,
    values: { ...values, accountName, description, category: values.category },
  };
}

/**
 * Competencias a gerar: de max(inicio, cursor + 1) ate a atual, somente se
 * ativa. Apos longa ausencia mantem apenas os ultimos meses (limite de recuperacao).
 */
export function pendingCompetences(
  recurring: RecurringCost,
  current: Competence,
): Competence[] {
  if (!recurring.active) {
    return [];
  }

  const first = Math.max(
    indexOf(recurring.start),
    recurring.lastGenerated ? indexOf(recurring.lastGenerated) + 1 : -Infinity,
    indexOf(current) - MAX_CATCH_UP_MONTHS + 1,
  );
  const last = indexOf(current);
  const months: Competence[] = [];

  for (let index = first; index <= last; index += 1) {
    months.push(fromIndex(index));
  }

  return months;
}

/** Id deterministico do lancamento gerado (impede duplicar o mesmo mes). */
export function buildOccurrenceId(recurringId: string, competence: Competence): string {
  return `rec-${recurringId}-${toCompetenceParam(competence)}`;
}

/** Data do lancamento gerado: dia configurado, ao meio-dia local. */
export function occurrenceDate({ year, month }: Competence, dayOfMonth: number): Date {
  return new Date(year, month - 1, Math.min(dayOfMonth, MAX_RECURRING_DAY), 12);
}

/**
 * Ao reativar, os meses pausados nao sao gerados: o cursor avanca para o mes
 * anterior ao atual (sem recuar um cursor mais recente).
 */
export function resumeCursor(
  recurring: RecurringCost,
  current: Competence,
): Competence | null {
  const previous = shiftCompetence(current, -1);
  const candidates = [recurring.lastGenerated, previous].filter(
    (item): item is Competence => item !== null,
  );
  const latest = Math.max(...candidates.map(indexOf));

  // Inicio ainda no futuro: nada a pular.
  return indexOf(recurring.start) > indexOf(previous)
    ? recurring.lastGenerated
    : fromIndex(latest);
}
