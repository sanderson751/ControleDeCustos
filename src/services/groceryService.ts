import {
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  Timestamp,
  type Unsubscribe,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import {
  GROCERY_COST_CATEGORY,
  type GroceryList,
  type GroceryListItem,
  type GroceryProduct,
  type GroceryUnit,
} from "@/domain/entities/grocery";
import { normalizeSearchText } from "@/domain/rules/costRules";
import type { CompletionPlan } from "@/domain/rules/groceryRules";
import { db } from "@/lib/firebase";
import { toDate, toGroceryList, toGroceryProduct } from "@/services/converters";
import {
  costEntriesCollectionRef,
  groceryListDocRef,
  groceryListsCollectionRef,
  groceryProductDocRef,
  groceryProductsCollectionRef,
  groceryPurchasesCollectionRef,
  groceryReceiptKeyDocRef,
} from "@/services/firestorePaths";

/** Catalogo de produtos do usuario em tempo real, por nome. */
export function subscribeToProducts(
  userId: string,
  onData: (products: GroceryProduct[]) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    groceryProductsCollectionRef(userId),
    (snapshot) =>
      onData(
        snapshot.docs
          .map((item) => toGroceryProduct(item.id, item.data()))
          .sort((left, right) => left.name.localeCompare(right.name, "pt-BR")),
      ),
    onError,
  );
}

/** Listas do usuario em tempo real, mais recentes primeiro. */
export function subscribeToLists(
  userId: string,
  onData: (lists: GroceryList[]) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    groceryListsCollectionRef(userId),
    (snapshot) =>
      onData(
        snapshot.docs
          .map((item) => toGroceryList(item.id, item.data()))
          .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime()),
      ),
    onError,
  );
}

/**
 * Escrita local imediata: o id fica disponivel na hora (a tela nao espera o
 * servidor, que no 4G do mercado leva segundos); `written` confirma a gravacao.
 */
export type LocalWrite = { id: string; written: Promise<void> };

/** Produto novo, ainda sem historico de preco. */
export function createProduct(
  userId: string,
  input: { name: string; unit: GroceryUnit },
): LocalWrite {
  const ref = doc(groceryProductsCollectionRef(userId));
  const written = setDoc(ref, {
    userId,
    name: input.name.trim(),
    normalizedName: normalizeSearchText(input.name),
    unit: input.unit,
    lastUnitPrice: null,
    previousUnitPrice: null,
    lastPurchasedAt: null,
    lastStore: "",
    purchaseCount: 0,
    avgIntervalDays: null,
    intervalCount: 0,
    aliases: [],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return { id: ref.id, written };
}

function itemFields(items: readonly GroceryListItem[]) {
  return items.map(({ id, productId, name, quantity, checked }) => ({
    id,
    productId,
    name,
    quantity,
    checked,
  }));
}

export function createList(
  userId: string,
  input: { name: string; items?: readonly GroceryListItem[] },
): LocalWrite {
  const ref = doc(groceryListsCollectionRef(userId));
  const written = setDoc(ref, {
    userId,
    name: input.name.trim(),
    status: "aberta",
    items: itemFields(input.items ?? []),
    purchaseId: null,
    paidTotal: null,
    completedAt: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return { id: ref.id, written };
}

/** Grava os itens da lista inteira (ultima escrita vence). */
export async function updateListItems(
  userId: string,
  listId: string,
  items: readonly GroceryListItem[],
): Promise<void> {
  await updateDoc(groceryListDocRef(userId, listId), {
    items: itemFields(items),
    updatedAt: serverTimestamp(),
  });
}

/** Compra ja registrada com a mesma comanda (chave da NFC-e ou hash). */
export async function findPurchaseByReceiptKey(
  userId: string,
  key: string,
): Promise<{ id: string; purchasedAt: Date; total: number } | null> {
  const snapshot = await getDoc(groceryReceiptKeyDocRef(userId, key));
  if (!snapshot.exists()) return null;
  const data = snapshot.data();
  return {
    id: String(data.purchaseId ?? ""),
    purchasedAt: toDate(data.purchasedAt),
    total: Number(data.total ?? 0),
  };
}

/** Exclui a lista; lancamento e compra ja registrados permanecem. */
export async function deleteList(userId: string, listId: string): Promise<void> {
  await deleteDoc(groceryListDocRef(userId, listId));
}

/**
 * Conclui a compra em um unico lote atomico: lancamento de mercado em
 * Alimentacao, compra registrada (historico), ultimo preco dos produtos e
 * lista concluida. Retorna os ids do lancamento e da compra.
 */
export async function completeList(
  userId: string,
  list: GroceryList,
  plan: CompletionPlan,
): Promise<{ costEntryId: string; purchaseId: string }> {
  const costRef = doc(costEntriesCollectionRef(userId));
  const purchaseRef = doc(groceryPurchasesCollectionRef(userId));
  const purchasedAt = Timestamp.fromDate(plan.cost.purchasedAt);
  const newProductRefs = plan.newProducts.map(() => doc(groceryProductsCollectionRef(userId)));
  const purchaseItems = plan.purchase.items.map((item, index) => {
    const link = plan.purchase.newProductLinks[index];
    return link === undefined ? item : { ...item, productId: newProductRefs[link].id };
  });
  const receiptKey = plan.receipt?.key ?? null;
  const batch = writeBatch(db);

  batch.set(costRef, {
    userId,
    accountName: plan.cost.accountName,
    amount: plan.cost.amount,
    costType: "variavel",
    category: GROCERY_COST_CATEGORY,
    description: plan.cost.description,
    installmentsTotal: 1,
    competenceYear: plan.cost.purchasedAt.getFullYear(),
    competenceMonth: plan.cost.purchasedAt.getMonth() + 1,
    createdAt: purchasedAt,
    updatedAt: serverTimestamp(),
  });

  batch.set(purchaseRef, {
    userId,
    listId: list.id,
    store: plan.purchase.store,
    purchasedAt,
    total: plan.purchase.total,
    costEntryId: costRef.id,
    items: purchaseItems,
    receiptKey,
    ocrConfidence:
      plan.receipt?.confidence === null || plan.receipt?.confidence === undefined
        ? null
        : Math.round(Math.min(100, Math.max(0, plan.receipt.confidence))),
    createdAt: serverTimestamp(),
  });

  // Chave unica da comanda: uma segunda gravacao com a mesma chave e negada pelas regras.
  if (receiptKey) {
    batch.set(groceryReceiptKeyDocRef(userId, receiptKey), {
      userId,
      purchaseId: purchaseRef.id,
      purchasedAt,
      total: plan.purchase.total,
      createdAt: serverTimestamp(),
    });
  }

  plan.newProducts.forEach(({ lastPurchasedAt, ...fields }, index) => {
    batch.set(newProductRefs[index], {
      userId,
      ...fields,
      lastPurchasedAt: lastPurchasedAt ? Timestamp.fromDate(lastPurchasedAt) : null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });

  for (const { productId, lastPurchasedAt, ...fields } of plan.productUpdates) {
    batch.update(groceryProductDocRef(userId, productId), {
      ...fields,
      lastPurchasedAt: lastPurchasedAt ? Timestamp.fromDate(lastPurchasedAt) : null,
      updatedAt: serverTimestamp(),
    });
  }

  batch.update(groceryListDocRef(userId, list.id), {
    status: "concluida",
    purchaseId: purchaseRef.id,
    paidTotal: plan.purchase.total,
    completedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  await batch.commit();
  return { costEntryId: costRef.id, purchaseId: purchaseRef.id };
}
