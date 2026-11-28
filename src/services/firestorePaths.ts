import { collection, collectionGroup, doc } from "firebase/firestore";
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
 * users/{uid}/savingsGoals/{goalId}
 * users/{uid}/goalContributions/{contributionId}
 * users/{uid}/groceryProducts/{productId}
 * users/{uid}/groceryLists/{listId}        (memberIds: participantes)
 * users/{uid}/groceryMembers/{memberUid}   (acesso do participante ao catalogo)
 * groceryInvites/{ownerId}_{listId}_{email}
 * users/{uid}/groceryPurchases/{purchaseId}
 * users/{uid}/groceryReceiptKeys/{receiptKey}
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

export const SAVINGS_GOALS_COLLECTION = "savingsGoals";
export const GOAL_CONTRIBUTIONS_COLLECTION = "goalContributions";

export const savingsGoalsCollectionRef = (uid: string) =>
  collection(db, USERS_COLLECTION, uid, SAVINGS_GOALS_COLLECTION);

export const savingsGoalDocRef = (uid: string, goalId: string) =>
  doc(db, USERS_COLLECTION, uid, SAVINGS_GOALS_COLLECTION, goalId);

export const goalContributionsCollectionRef = (uid: string) =>
  collection(db, USERS_COLLECTION, uid, GOAL_CONTRIBUTIONS_COLLECTION);

export const goalContributionDocRef = (uid: string, contributionId: string) =>
  doc(db, USERS_COLLECTION, uid, GOAL_CONTRIBUTIONS_COLLECTION, contributionId);

export const GROCERY_PRODUCTS_COLLECTION = "groceryProducts";
export const GROCERY_LISTS_COLLECTION = "groceryLists";
export const GROCERY_PURCHASES_COLLECTION = "groceryPurchases";
export const GROCERY_RECEIPT_KEYS_COLLECTION = "groceryReceiptKeys";

export const groceryProductsCollectionRef = (uid: string) =>
  collection(db, USERS_COLLECTION, uid, GROCERY_PRODUCTS_COLLECTION);

export const groceryProductDocRef = (uid: string, productId: string) =>
  doc(db, USERS_COLLECTION, uid, GROCERY_PRODUCTS_COLLECTION, productId);

export const groceryListsCollectionRef = (uid: string) =>
  collection(db, USERS_COLLECTION, uid, GROCERY_LISTS_COLLECTION);

export const groceryListDocRef = (uid: string, listId: string) =>
  doc(db, USERS_COLLECTION, uid, GROCERY_LISTS_COLLECTION, listId);

export const groceryPurchasesCollectionRef = (uid: string) =>
  collection(db, USERS_COLLECTION, uid, GROCERY_PURCHASES_COLLECTION);

/** Convites para listas: groceryInvites/{ownerId}_{listId}_{email} (colecao raiz). */
export const GROCERY_INVITES_COLLECTION = "groceryInvites";
export const GROCERY_MEMBERS_COLLECTION = "groceryMembers";

export const groceryInvitesCollectionRef = () => collection(db, GROCERY_INVITES_COLLECTION);

export const groceryInviteDocRef = (inviteId: string) => doc(db, GROCERY_INVITES_COLLECTION, inviteId);

/** Acesso de um participante ao catalogo do dono: users/{dono}/groceryMembers/{uid}. */
export const groceryMemberDocRef = (ownerId: string, memberUid: string) =>
  doc(db, USERS_COLLECTION, ownerId, GROCERY_MEMBERS_COLLECTION, memberUid);

/** Listas de todos os usuarios (consulta das listas compartilhadas comigo). */
export const groceryListsGroupRef = () => collectionGroup(db, GROCERY_LISTS_COLLECTION);

/** Comanda ja lancada (id = chave da NFC-e ou hash): garante que nao entra duas vezes. */
export const groceryReceiptKeyDocRef = (uid: string, receiptKey: string) =>
  doc(db, USERS_COLLECTION, uid, GROCERY_RECEIPT_KEYS_COLLECTION, receiptKey);
