import type { DocumentData } from "firebase/firestore";
import type { BudgetLimit, RecurringBudget } from "@/domain/entities/budget";
import type { CustomCategory } from "@/domain/entities/category";
import type { CostEntry } from "@/domain/entities/cost";
import type { RecurringCost } from "@/domain/entities/recurringCost";
import type { GoalContribution, SavingsGoal } from "@/domain/entities/savingsGoal";
import {
  GROCERY_UNITS,
  type GroceryList,
  type GroceryListItem,
  type GroceryProduct,
  type GroceryUnit,
} from "@/domain/entities/grocery";
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

export function toSavingsGoal(id: string, data: DocumentData): SavingsGoal {
  return {
    id,
    name: String(data.name ?? ""),
    targetAmount: Number(data.targetAmount ?? 0),
    deadline: toCompetence(data.deadlineYear, data.deadlineMonth),
  };
}

export function toGoalContribution(id: string, data: DocumentData): GoalContribution {
  return {
    id,
    goalId: String(data.goalId ?? ""),
    amount: Number(data.amount ?? 0),
    date: toDate(data.date),
    note: typeof data.note === "string" ? data.note : "",
  };
}

const priceOrNull = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;

export function toGroceryProduct(id: string, data: DocumentData): GroceryProduct {
  const unit = GROCERY_UNITS.includes(data.unit as GroceryUnit) ? (data.unit as GroceryUnit) : "un";

  return {
    id,
    name: String(data.name ?? ""),
    normalizedName: String(data.normalizedName ?? ""),
    unit,
    lastUnitPrice: priceOrNull(data.lastUnitPrice),
    previousUnitPrice: priceOrNull(data.previousUnitPrice),
    lastPurchasedAt: data.lastPurchasedAt ? toDate(data.lastPurchasedAt) : null,
    lastStore: typeof data.lastStore === "string" ? data.lastStore : "",
    purchaseCount: Number.isInteger(data.purchaseCount) ? Number(data.purchaseCount) : 0,
    avgIntervalDays:
      typeof data.avgIntervalDays === "number" && data.avgIntervalDays >= 0 ? data.avgIntervalDays : null,
    intervalCount: Number.isInteger(data.intervalCount) ? Number(data.intervalCount) : 0,
    aliases: Array.isArray(data.aliases) ? data.aliases.filter((alias): alias is string => typeof alias === "string") : [],
  };
}

function toGroceryListItem(raw: unknown, fallbackId: string): GroceryListItem | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const item = raw as Record<string, unknown>;
  const quantity = Number(item.quantity);

  if (typeof item.productId !== "string" || !Number.isFinite(quantity) || quantity <= 0) {
    return null;
  }

  return {
    id: typeof item.id === "string" && item.id ? item.id : fallbackId,
    productId: item.productId,
    name: String(item.name ?? ""),
    quantity,
    checked: item.checked === true,
  };
}

/**
 * Itens no formato atual (mapa `items.{itemId}` com `order`) ou no antigo
 * (array). Item incompleto (ex.: removido por um aparelho enquanto outro
 * marcava) e ignorado.
 */
function toGroceryListItems(raw: unknown): { items: GroceryListItem[]; staleItemIds: string[] } {
  if (Array.isArray(raw)) {
    return {
      items: raw
        .map((item: unknown, index: number) => toGroceryListItem(item, `item-${index}`))
        .filter((item): item is GroceryListItem => item !== null),
      staleItemIds: [],
    };
  }

  if (!raw || typeof raw !== "object") return { items: [], staleItemIds: [] };

  const entries: Array<{ item: GroceryListItem; order: number }> = [];
  const staleItemIds: string[] = [];

  for (const [itemId, value] of Object.entries(raw as Record<string, unknown>)) {
    const item = toGroceryListItem(
      value && typeof value === "object" ? { ...value, id: itemId } : null,
      itemId,
    );
    if (!item) {
      staleItemIds.push(itemId);
      continue;
    }
    const order = Number((value as { order?: unknown }).order);
    entries.push({ item, order: Number.isFinite(order) ? order : Number.MAX_SAFE_INTEGER });
  }

  return {
    items: entries
      .sort((left, right) => left.order - right.order || left.item.id.localeCompare(right.item.id))
      .map((entry) => entry.item),
    staleItemIds,
  };
}

export function toGroceryList(id: string, data: DocumentData): GroceryList {
  const { items, staleItemIds } = toGroceryListItems(data.items);

  return {
    id,
    name: String(data.name ?? ""),
    status: data.status === "concluida" ? "concluida" : "aberta",
    items,
    legacyItems: Array.isArray(data.items),
    staleItemIds,
    purchaseId: typeof data.purchaseId === "string" ? data.purchaseId : null,
    paidTotal: typeof data.paidTotal === "number" && data.paidTotal > 0 ? data.paidTotal : null,
    createdAt: toDate(data.createdAt),
    completedAt: data.completedAt ? toDate(data.completedAt) : null,
  };
}
