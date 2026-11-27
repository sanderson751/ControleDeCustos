import * as firestore from "firebase/firestore";
import type { GroceryList } from "@/domain/entities/grocery";
import {
  completeList,
  createList,
  createProduct,
  deleteList,
  subscribeToLists,
  subscribeToProducts,
  updateListItems,
} from "@/services/groceryService";
import { querySnapshot, timestamp } from "@/test/firestoreMock";

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
      expect.objectContaining({ status: "aberta", purchaseId: null, paidTotal: null, items: LIST.items }),
    );
  });

  it("atualiza itens e exclui lista", async () => {
    await updateListItems("uid-1", "l1", LIST.items);
    expect(mocked.updateDoc).toHaveBeenCalledWith(
      expect.objectContaining({ path: "users/uid-1/groceryLists/l1" }),
      { items: LIST.items, updatedAt: "SERVER_TIMESTAMP" },
    );
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
        },
      ],
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
