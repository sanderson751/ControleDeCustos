import * as firestore from "firebase/firestore";
import type { GroceryList } from "@/domain/entities/grocery";
import {
  completeList,
  convertListItems,
  createList,
  createProduct,
  deleteList,
  findPurchaseByReceiptKey,
  subscribeToLists,
  subscribeToProducts,
  updateListItems,
} from "@/services/groceryService";
import { docSnapshot, querySnapshot, timestamp } from "@/test/firestoreMock";

vi.mock("firebase/firestore", async () =>
  (await import("@/test/firestoreMock")).createFirestoreMock(),
);

type BatchMock = Record<"set" | "update" | "delete" | "commit", ReturnType<typeof vi.fn>>;
const batch = (firestore as unknown as { __batch: BatchMock }).__batch;
const mocked = vi.mocked(firestore);
const NOW = new Date(2026, 10, 27, 12);

const LIST: GroceryList = {
  id: "l1",
  name: "Feira",
  status: "aberta",
  items: [{ id: "i1", productId: "arroz", name: "Arroz", quantity: 2, checked: true }],
  purchaseId: null,
  paidTotal: null,
  createdAt: NOW,
  completedAt: null,
};

/** Ultimo updateDoc com caminhos: pares [caminho, valor]. */
function lastWrite() {
  const [ref, ...pairs] = mocked.updateDoc.mock.calls.at(-1) as unknown as [{ path: string }, ...unknown[]];
  expect(ref.path).toBe("users/uid-1/groceryLists/l1");
  const written: Array<[string, unknown]> = [];
  for (let index = 0; index < pairs.length; index += 2) {
    written.push([(pairs[index] as { segments: string[] }).segments.join("."), pairs[index + 1]]);
  }
  return written;
}

function emitOnce(docs: Array<{ id: string; data: Record<string, unknown> }>) {
  mocked.onSnapshot.mockImplementationOnce(((_ref: unknown, next: (s: unknown) => void) => {
    next(querySnapshot(docs));
    return () => undefined;
  }) as never);
}

describe("groceryService", () => {
  beforeEach(() => {
    batch.commit.mockResolvedValue(undefined);
  });

  it("assina produtos por nome, com historico e unidade validos", () => {
    const onData = vi.fn();
    emitOnce([
      { id: "p2", data: { name: "Café", normalizedName: "cafe", unit: "pct", lastUnitPrice: 8.2, lastPurchasedAt: timestamp(NOW), purchaseCount: 1 } },
      { id: "p1", data: { name: "Arroz", normalizedName: "arroz", unit: "caixa", lastUnitPrice: 0 } },
    ]);

    subscribeToProducts("uid-1", onData, vi.fn());

    expect(mocked.collection).toHaveBeenCalledWith(expect.anything(), "users", "uid-1", "groceryProducts");
    expect(onData.mock.calls[0][0]).toEqual([
      expect.objectContaining({ id: "p1", unit: "un", lastUnitPrice: null, purchaseCount: 0 }),
      expect.objectContaining({ id: "p2", unit: "pct", lastUnitPrice: 8.2, lastPurchasedAt: NOW, purchaseCount: 1 }),
    ]);
  });

  it("assina listas da mais recente, ignorando itens invalidos", () => {
    const onData = vi.fn();
    emitOnce([
      { id: "a", data: { name: "Antiga", status: "concluida", items: [], createdAt: timestamp(new Date(2026, 0, 1)) } },
      {
        id: "b",
        data: {
          name: "Nova",
          status: "aberta",
          createdAt: timestamp(NOW),
          items: [{ id: "i1", productId: "p1", name: "Arroz", quantity: 2 }, { productId: 3 }, null],
        },
      },
    ]);

    subscribeToLists("uid-1", onData, vi.fn());

    const [lists] = onData.mock.calls[0];
    expect(lists.map((list: GroceryList) => list.id)).toEqual(["b", "a"]);
    expect(lists[0].items).toEqual([
      { id: "i1", productId: "p1", name: "Arroz", quantity: 2, checked: false },
    ]);
    expect(lists[0].legacyItems).toBe(true);
  });

  it("le itens no formato de mapa pela ordem, ignorando item incompleto", () => {
    const onData = vi.fn();
    emitOnce([
      {
        id: "m",
        data: {
          name: "Mapa",
          status: "aberta",
          createdAt: timestamp(NOW),
          items: {
            b: { productId: "p2", name: "Café", quantity: 1, checked: true, order: 1800000000000 },
            a: { productId: "p1", name: "Arroz", quantity: 2, checked: false, order: 0 },
            // Removido em um aparelho enquanto outro marcava: sobra so o campo marcado.
            c: { checked: true },
          },
        },
      },
    ]);

    subscribeToLists("uid-1", onData, vi.fn());

    const [[list]] = onData.mock.calls[0];
    expect(list.legacyItems).toBe(false);
    expect(list.staleItemIds).toEqual(["c"]);
    expect(list.items).toEqual([
      { id: "a", productId: "p1", name: "Arroz", quantity: 2, checked: false },
      { id: "b", productId: "p2", name: "Café", quantity: 1, checked: true },
    ]);
  });

  it("cria produto sem historico e lista aberta com id imediato (sem esperar o servidor)", async () => {
    const product = createProduct("uid-1", { name: " Café ", unit: "pct" });
    expect(product.id).toMatch(/^auto-/);
    await expect(product.written).resolves.toBeUndefined();
    expect(mocked.setDoc).toHaveBeenCalledWith(
      expect.objectContaining({ path: `users/uid-1/groceryProducts/${product.id}` }),
      expect.objectContaining({
        userId: "uid-1",
        name: "Café",
        normalizedName: "cafe",
        unit: "pct",
        lastUnitPrice: null,
        purchaseCount: 0,
        intervalCount: 0,
        aliases: [],
      }),
    );

    const list = createList("uid-1", { name: "Feira", items: LIST.items });
    expect(mocked.setDoc).toHaveBeenLastCalledWith(
      expect.objectContaining({ path: `users/uid-1/groceryLists/${list.id}` }),
      expect.objectContaining({
        status: "aberta",
        purchaseId: null,
        paidTotal: null,
        items: { i1: { productId: "arroz", name: "Arroz", quantity: 2, checked: true, order: 0 } },
      }),
    );
  });

  it("grava so os campos alterados de cada item (edicoes simultaneas nao se apagam)", async () => {
    vi.spyOn(Date, "now").mockReturnValue(1800000000000);
    const previous = [
      ...LIST.items,
      { id: "i2", productId: "cafe", name: "Café", quantity: 1, checked: false },
    ];
    const next = [
      { ...previous[0], quantity: 3 },
      { id: "i3", productId: "leite", name: "Leite", quantity: 6, checked: false },
    ];

    await updateListItems("uid-1", "l1", next, previous, ["x9"]);

    expect(lastWrite()).toEqual([
      ["items.i1.quantity", 3],
      ["items.i3", { productId: "leite", name: "Leite", quantity: 6, checked: false, order: 1800000000000 }],
      ["items.i2", "DELETE_FIELD"],
      // Sobra incompleta de remocao concorrente.
      ["items.x9", "DELETE_FIELD"],
      ["updatedAt", "SERVER_TIMESTAMP"],
    ]);

    // Mesmo milissegundo: a proxima inclusao vem depois, sem empate.
    await updateListItems("uid-1", "l1", [...next, { id: "i4", productId: "pao", name: "Pão", quantity: 1, checked: false }], next);
    expect(lastWrite()[0]).toEqual(["items.i4", expect.objectContaining({ order: 1800000000001 })]);
    vi.mocked(Date.now).mockRestore();
  });

  it("sem mudanca nao grava", async () => {
    mocked.updateDoc.mockClear();
    await updateListItems("uid-1", "l1", LIST.items, LIST.items);
    expect(mocked.updateDoc).not.toHaveBeenCalled();
  });

  it("converte lista antiga item a item (preserva o que outro aparelho ja gravou no mapa)", async () => {
    const previous = [...LIST.items, { id: "i2", productId: "cafe", name: "Café", quantity: 1, checked: false }];
    await convertListItems("uid-1", "l1", LIST.items, previous);
    expect(lastWrite()).toEqual([
      ["items.i1", { productId: "arroz", name: "Arroz", quantity: 2, checked: true, order: 0 }],
      ["items.i2", "DELETE_FIELD"],
      ["updatedAt", "SERVER_TIMESTAMP"],
    ]);

    // Lista esvaziada: o mapa vazio substitui o array.
    await convertListItems("uid-1", "l1", [], previous);
    expect(mocked.updateDoc).toHaveBeenLastCalledWith(
      expect.objectContaining({ path: "users/uid-1/groceryLists/l1" }),
      { items: {}, updatedAt: "SERVER_TIMESTAMP" },
    );
  });

  it("exclui lista", async () => {
    await deleteList("uid-1", "l1");
    expect(mocked.deleteDoc).toHaveBeenCalledWith(expect.objectContaining({ path: "users/uid-1/groceryLists/l1" }));
  });

  it("conclui em um unico lote: custo, compra, produtos e lista", async () => {
    const result = await completeList("uid-1", LIST, {
      cost: { accountName: "Mercado — Assaí", amount: 60, description: "Lista: Feira", purchasedAt: NOW },
      purchase: {
        store: "Assaí",
        purchasedAt: NOW,
        total: 60,
        items: [{ productId: "arroz", rawName: "Arroz", quantity: 2, unitPrice: 25.9, lineTotal: 51.8 }],
        newProductLinks: {},
      },
      productUpdates: [
        {
          productId: "arroz",
          lastUnitPrice: 25.9,
          previousUnitPrice: null,
          lastPurchasedAt: NOW,
          lastStore: "Assaí",
          purchaseCount: 1,
          avgIntervalDays: null,
          intervalCount: 0,
          aliases: [],
        },
      ],
      newProducts: [],
      receipt: null,
      droppedExtras: 0,
    });

    expect(batch.commit).toHaveBeenCalledTimes(1);
    const [costCall, purchaseCall] = batch.set.mock.calls;
    expect(result.costEntryId).toMatch(/^auto-/);
    expect(costCall[0].path).toBe(`users/uid-1/costEntries/${result.costEntryId}`);
    expect(costCall[1]).toMatchObject({
      accountName: "Mercado — Assaí",
      amount: 60,
      category: "alimentacao",
      costType: "variavel",
      competenceYear: 2026,
      competenceMonth: 11,
      installmentsTotal: 1,
    });
    expect(purchaseCall[0].path).toBe(`users/uid-1/groceryPurchases/${result.purchaseId}`);
    expect(purchaseCall[1]).toMatchObject({ listId: "l1", costEntryId: result.costEntryId, total: 60 });
    expect(batch.update).toHaveBeenCalledWith(
      expect.objectContaining({ path: "users/uid-1/groceryProducts/arroz" }),
      expect.objectContaining({ lastUnitPrice: 25.9, purchaseCount: 1, lastStore: "Assaí" }),
    );
    expect(batch.update).toHaveBeenLastCalledWith(
      expect.objectContaining({ path: "users/uid-1/groceryLists/l1" }),
      expect.objectContaining({ status: "concluida", purchaseId: result.purchaseId, paidTotal: 60 }),
    );
  });
});

describe("groceryService - comanda", () => {
  beforeEach(() => {
    batch.commit.mockResolvedValue(undefined);
  });

  it("conclusao com comanda cria produto novo (ligado a compra), apelidos, chave unica e confianca", async () => {
    const result = await completeList("uid-1", LIST, {
      cost: { accountName: "Mercado — Assaí", amount: 77.67, description: "Lista: Feira", purchasedAt: NOW },
      purchase: {
        store: "Assaí",
        purchasedAt: NOW,
        total: 77.67,
        items: [{ productId: null, rawName: "DETERGENTE YPE 500ML", quantity: 3, unitPrice: 2.79, lineTotal: 8.37 }],
        newProductLinks: { 0: 0 },
      },
      productUpdates: [
        {
          productId: "arroz",
          aliases: ["arroz tipo 1 tio joao 5kg"],
          lastUnitPrice: 25.9,
          previousUnitPrice: null,
          lastPurchasedAt: NOW,
          lastStore: "Assaí",
          purchaseCount: 1,
          avgIntervalDays: null,
          intervalCount: 0,
        },
      ],
      newProducts: [
        {
          name: "Detergente Ype 500ml",
          normalizedName: "detergente ype 500ml",
          unit: "un",
          aliases: ["detergente ype 500ml"],
          lastUnitPrice: 2.79,
          previousUnitPrice: null,
          lastPurchasedAt: NOW,
          lastStore: "Assaí",
          purchaseCount: 1,
          avgIntervalDays: null,
          intervalCount: 0,
        },
      ],
      receipt: { key: "h-06057223000171-20261127-7767", confidence: 88.6 },
      droppedExtras: 0,
    });

    const created = batch.set.mock.calls.find(([ref]) => (ref as { path: string }).path.includes("groceryProducts"));
    const newProductId = (created?.[0] as { path: string }).path.split("/").pop();
    expect(created?.[1]).toMatchObject({
      userId: "uid-1",
      name: "Detergente Ype 500ml",
      lastUnitPrice: 2.79,
      aliases: ["detergente ype 500ml"],
      createdAt: "SERVER_TIMESTAMP",
    });
    const purchase = batch.set.mock.calls.find(([ref]) => (ref as { path: string }).path.includes("groceryPurchases"));
    expect(purchase?.[1]).toMatchObject({ receiptKey: "h-06057223000171-20261127-7767", ocrConfidence: 89 });
    expect((purchase?.[1] as { items: Array<{ productId: string }> }).items[0].productId).toBe(newProductId);
    const key = batch.set.mock.calls.find(([ref]) => (ref as { path: string }).path.includes("groceryReceiptKeys"));
    expect(key?.[0]).toMatchObject({ path: "users/uid-1/groceryReceiptKeys/h-06057223000171-20261127-7767" });
    expect(key?.[1]).toMatchObject({ userId: "uid-1", purchaseId: result.purchaseId, total: 77.67, createdAt: "SERVER_TIMESTAMP" });
    expect(batch.update).toHaveBeenCalledWith(
      expect.objectContaining({ path: "users/uid-1/groceryProducts/arroz" }),
      expect.objectContaining({ aliases: ["arroz tipo 1 tio joao 5kg"] }),
    );
  });

  it("procura a comanda ja lancada pela chave", async () => {
    mocked.getDoc.mockResolvedValueOnce(
      docSnapshot("k1", { purchaseId: "g9", purchasedAt: timestamp(NOW), total: 77.67 }) as never,
    );
    await expect(findPurchaseByReceiptKey("uid-1", "k1")).resolves.toEqual({ id: "g9", purchasedAt: NOW, total: 77.67 });
    expect(mocked.getDoc).toHaveBeenCalledWith(expect.objectContaining({ path: "users/uid-1/groceryReceiptKeys/k1" }));

    mocked.getDoc.mockResolvedValueOnce(docSnapshot("k2", null) as never);
    await expect(findPurchaseByReceiptKey("uid-1", "k2")).resolves.toBeNull();
  });

  it("conclusao manual (sem comanda) nao grava chave", async () => {
    await completeList("uid-1", LIST, {
      cost: { accountName: "Mercado — A", amount: 10, description: "Lista: Feira", purchasedAt: NOW },
      purchase: { store: "A", purchasedAt: NOW, total: 10, items: [], newProductLinks: {} },
      productUpdates: [],
      newProducts: [],
      receipt: null,
      droppedExtras: 0,
    });
    expect(batch.set.mock.calls.some(([ref]) => (ref as { path: string }).path.includes("groceryReceiptKeys"))).toBe(false);
  });
});
