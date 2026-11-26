import type { Competence } from "@/domain/entities/cost";

const PARAM_PATTERN = /^(\d{4})-(\d{2})$/;

/** Faixa suportada (espelha a validacao de ano em firestore.rules). */
export const MIN_COMPETENCE: Competence = { year: 2000, month: 1 };
export const MAX_COMPETENCE: Competence = { year: 2100, month: 12 };

const MONTH_NAMES = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

export function getCurrentCompetence(now: Date = new Date()): Competence {
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

/** "2026-11" => { year: 2026, month: 11 }. Null quando invalido. */
export function parseCompetenceParam(
  value: string | null | undefined,
): Competence | null {
  const match = value ? PARAM_PATTERN.exec(value) : null;

  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);

  if (
    year < MIN_COMPETENCE.year ||
    year > MAX_COMPETENCE.year ||
    month < 1 ||
    month > 12
  ) {
    return null;
  }

  return { year, month };
}

export function toCompetenceParam({ year, month }: Competence): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

export function shiftCompetence(
  { year, month }: Competence,
  delta: number,
): Competence {
  const index = year * 12 + (month - 1) + delta;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

export function isSameCompetence(left: Competence, right: Competence) {
  return left.year === right.year && left.month === right.month;
}

/** { 2026, 11 } => "novembro de 2026" */
export function formatCompetenceLong({ year, month }: Competence): string {
  return `${MONTH_NAMES[month - 1]} de ${year}`;
}

/**
 * Data sugerida para um novo lancamento na competencia visualizada:
 * hoje, se for o mes atual; senao o mesmo dia do mes (limitado ao ultimo dia).
 */
export function defaultDateForCompetence(
  competence: Competence,
  now: Date = new Date(),
): Date {
  if (isSameCompetence(competence, getCurrentCompetence(now))) {
    return now;
  }

  const lastDay = new Date(competence.year, competence.month, 0).getDate();
  return new Date(
    competence.year,
    competence.month - 1,
    Math.min(now.getDate(), lastDay),
    12,
  );
}

export function isFirstCompetence(competence: Competence): boolean {
  return isSameCompetence(competence, MIN_COMPETENCE);
}

export function isLastCompetence(competence: Competence): boolean {
  return isSameCompetence(competence, MAX_COMPETENCE);
}

/** { 2026, 3 } => "mar/2026" */
export function formatCompetenceShort({ year, month }: Competence): string {
  return `${MONTH_NAMES[month - 1].slice(0, 3)}/${year}`;
}
