import type { DocumentData } from "firebase/firestore";
import type { CostEntry } from "@/domain/entities/cost";
import type { UserProfile } from "@/domain/entities/user";
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
    installmentsTotal: Number(data.installmentsTotal ?? 1),
    competenceYear: Number(data.competenceYear ?? now.getFullYear()),
    competenceMonth: Number(data.competenceMonth ?? now.getMonth() + 1),
    createdAt: toDate(data.createdAt, now),
    updatedAt: toDate(data.updatedAt, now),
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
