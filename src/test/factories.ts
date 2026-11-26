import type { BudgetLimit } from "@/domain/entities/budget";
import type { CostCategory, CostEntry } from "@/domain/entities/cost";
import type { UserProfile, UserRole } from "@/domain/entities/user";

let sequence = 0;

export function makeCostEntry(overrides: Partial<CostEntry> = {}): CostEntry {
  sequence += 1;

  return {
    id: `cost-${sequence}`,
    accountName: `Conta ${sequence}`,
    amount: 100,
    costType: "variavel",
    category: "outros",
    installmentsTotal: 1,
    competenceYear: 2026,
    competenceMonth: 11,
    createdAt: new Date("2026-11-10T12:00:00"),
    updatedAt: new Date("2026-11-10T12:00:00"),
    ...overrides,
  };
}

export function makeProfile(
  role: UserRole = "standard",
  overrides: Partial<UserProfile> = {},
): UserProfile {
  return {
    userId: `uid-${role}`,
    email: `${role}@exemplo.com`,
    displayName: `Usuario ${role}`,
    photoURL: "",
    role,
    createdAt: new Date("2026-01-01T12:00:00"),
    updatedAt: new Date("2026-01-01T12:00:00"),
    ...overrides,
  };
}

export function makeBudget(
  category: CostCategory,
  limit: number,
  overrides: Partial<BudgetLimit> = {},
): BudgetLimit {
  const year = overrides.year ?? 2026;
  const month = overrides.month ?? 11;

  return {
    id: `${year}-${String(month).padStart(2, "0")}-${category}`,
    category,
    year,
    month,
    limit,
    ...overrides,
  };
}
