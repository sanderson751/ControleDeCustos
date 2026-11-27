import { collection, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";

/**
 * Caminhos centralizados do Firestore (ver specs/<feature>/firestore-structure.md).
 *
 * users/{uid}
 * users/{uid}/settings/profile
 * users/{uid}/costEntries/{entryId}
 * users/{uid}/budgetLimits/{AAAA-MM-categoria}
 * users/{uid}/recurringBudgets/{AAAA-MM-categoria}
 * users/{uid}/categories/{categoryId}
 * users/{uid}/recurringCosts/{recurringId}
 */
export const USERS_COLLECTION = "users";
export const SETTINGS_COLLECTION = "settings";
export const SETTINGS_PROFILE_DOC = "profile";
export const COST_ENTRIES_COLLECTION = "costEntries";

export const usersCollectionRef = () => collection(db, USERS_COLLECTION);

export const userDocRef = (uid: string) => doc(db, USERS_COLLECTION, uid);

export const userSettingsDocRef = (uid: string) =>
  doc(db, USERS_COLLECTION, uid, SETTINGS_COLLECTION, SETTINGS_PROFILE_DOC);

export const costEntriesCollectionRef = (uid: string) =>
  collection(db, USERS_COLLECTION, uid, COST_ENTRIES_COLLECTION);

export const costEntryDocRef = (uid: string, entryId: string) =>
  doc(db, USERS_COLLECTION, uid, COST_ENTRIES_COLLECTION, entryId);

export const BUDGET_LIMITS_COLLECTION = "budgetLimits";

export const budgetLimitsCollectionRef = (uid: string) =>
  collection(db, USERS_COLLECTION, uid, BUDGET_LIMITS_COLLECTION);

export const budgetLimitDocRef = (uid: string, budgetId: string) =>
  doc(db, USERS_COLLECTION, uid, BUDGET_LIMITS_COLLECTION, budgetId);

export const RECURRING_BUDGETS_COLLECTION = "recurringBudgets";

export const recurringBudgetsCollectionRef = (uid: string) =>
  collection(db, USERS_COLLECTION, uid, RECURRING_BUDGETS_COLLECTION);

export const recurringBudgetDocRef = (uid: string, budgetId: string) =>
  doc(db, USERS_COLLECTION, uid, RECURRING_BUDGETS_COLLECTION, budgetId);

export const CATEGORIES_COLLECTION = "categories";

export const categoriesCollectionRef = (uid: string) =>
  collection(db, USERS_COLLECTION, uid, CATEGORIES_COLLECTION);

export const categoryDocRef = (uid: string, categoryId: string) =>
  doc(db, USERS_COLLECTION, uid, CATEGORIES_COLLECTION, categoryId);

export const RECURRING_COSTS_COLLECTION = "recurringCosts";

export const recurringCostsCollectionRef = (uid: string) =>
  collection(db, USERS_COLLECTION, uid, RECURRING_COSTS_COLLECTION);

export const recurringCostDocRef = (uid: string, recurringId: string) =>
  doc(db, USERS_COLLECTION, uid, RECURRING_COSTS_COLLECTION, recurringId);
