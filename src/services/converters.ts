import type { DocumentData } from "firebase/firestore";
import type { BudgetLimit, RecurringBudget } from "@/domain/entities/budget";
import type { CustomCategory } from "@/domain/entities/category";
import type { CostEntry } from "@/domain/entities/cost";
import type { RecurringCost } from "@/domain/entities/recurringCost";
import type { UserProfile } from "@/domain/entities/user";
import { normalizeCategory } from "@/domain/rules/costRules";
import { normalizeRole } from "@/domain/rules/permissions";

type TimestampLike = { toDate: () => Date };

function isTimestampLike(value: unknown): value is TimestampLike {
  return (
    typeof value === "object" &&
    value !== null &&
    "toDate" in value &&
    typeof (value as TimestampLike).toDate === "function"
  );
}

/** Converte Timestamp do Firestore em Date (serverTimestamp pendente => fallback). */
export function toDate(value: unknown, fallback: Date = new Date()): Date {
  if (isTimestampLike(value)) {
    return value.toDate();
  }

  if (value instanceof Date) {
    return value;
  }

  return fallback;
}

export function toCostEntry(id: string, data: DocumentData): CostEntry {
  const now = new Date();

  return {
    id,
    accountName: String(data.accountName ?? ""),
    amount: Number(data.amount ?? 0),
    costType: data.costType === "fixo" ? "fixo" : "variavel",
    category: normalizeCategory(data.category),
    description: typeof data.description === "string" ? data.description : "",
    installmentsTotal: Number(data.installmentsTotal ?? 1),
    competenceYear: Number(data.competenceYear ?? now.getFullYear()),
    competenceMonth: Number(data.competenceMonth ?? now.getMonth() + 1),
    createdAt: toDate(data.createdAt, now),
    updatedAt: toDate(data.updatedAt, now),
    ...(typeof data.recurringId === "string" && data.recurringId
      ? { recurringId: data.recurringId }
      : {}),
  };
}

export function toBudgetLimit(id: string, data: DocumentData): BudgetLimit {
  return {
    id,
    category: normalizeCategory(data.category),
    year: Number(data.year),
    month: Number(data.month),
    limit: Number(data.limit ?? 0),
  };
}

export function toUserProfile(id: string, data: DocumentData): UserProfile {
  return {
    userId: id,
    email: String(data.email ?? ""),
    displayName: String(data.displayName ?? ""),
    photoURL: String(data.photoURL ?? ""),
    role: normalizeRole(data.role),
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
  };
}

export function toRecurringBudget(
  id: string,
  data: DocumentData,
): RecurringBudget {
  return {
    id,
    category: normalizeCategory(data.category),
    year: Number(data.year),
    month: Number(data.month),
    limit:
      typeof data.limit === "number" && data.limit > 0 ? data.limit : null,
  };
}

export function toCustomCategory(id: string, data: DocumentData): CustomCategory {
  return {
    id,
    name: typeof data.name === "string" ? data.name : "",
    archived: data.archived === true,
  };
}

function toCompetence(year: unknown, month: unknown) {
  return Number.isInteger(year) && Number.isInteger(month)
    ? { year: Number(year), month: Number(month) }
    : null;
}

export function toRecurringCost(id: string, data: DocumentData): RecurringCost {
  const now = new Date();

  return {
    id,
    accountName: String(data.accountName ?? ""),
    amount: Number(data.amount ?? 0),
    costType: data.costType === "variavel" ? "variavel" : "fixo",
    category: normalizeCategory(data.category),
    description: typeof data.description === "string" ? data.description : "",
    dayOfMonth: Number(data.dayOfMonth ?? 1),
    start: toCompetence(data.startYear, data.startMonth) ?? {
      year: now.getFullYear(),
      month: now.getMonth() + 1,
    },
    active: data.active !== false,
    lastGenerated: toCompetence(data.lastGeneratedYear, data.lastGeneratedMonth),
  };
}
