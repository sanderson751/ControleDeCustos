import * as firestore from "firebase/firestore";
import type { RecurringCost } from "@/domain/entities/recurringCost";
import {
  createRecurringCost,
  deleteRecurringCost,
  generateRecurring,
  listRecurringCosts,
  setRecurringCostActive,
  subscribeToRecurringCosts,
  syncRecurringCosts,
  updateRecurringCost,
} from "@/services/recurringCostService";
import { querySnapshot } from "@/test/firestoreMock";

vi.mock("firebase/firestore", async () =>
  (await import("@/test/firestoreMock")).createFirestoreMock(),
);

const mocked = vi.mocked(firestore);
const NOW = new Date(2026, 10, 27, 12);
const NOV = { year: 2026, month: 11 };

/** runTransaction executa a funcao com uma transacao falsa que le `data`. */
function transactionWith(data: Record<string, unknown> | null) {
  const tx = {
    get: vi.fn(async (ref: { path: string }) => ({
      id: ref.path.split("/").pop(),
      exists: () => data !== null,
      data: () => data ?? undefined,
    })),
    set: vi.fn(),
    update: vi.fn(),
  };
  mocked.runTransaction.mockImplementation((async (_db: unknown, fn: (t: unknown) => unknown) =>
    fn(tx)) as never);
  return tx;
}

const INPUT = {
  accountName: " Aluguel ",
  amount: 2000,
  costType: "fixo" as const,
  category: "moradia",
  description: " apto ",
  dayOfMonth: 5,
  start: { year: 2026, month: 10 },
};

const recurring = (overrides: Partial<RecurringCost> = {}): RecurringCost => ({
  ...INPUT,
  accountName: "Aluguel",
  description: "apto",
  id: "r1",
  active: true,
  lastGenerated: null,
  ...overrides,
});

const DOC_DATA = {
  accountName: "Aluguel",
  amount: 2000,
  costType: "fixo",
  category: "moradia",
  description: "apto",
  dayOfMonth: 5,
  startYear: 2026,
  startMonth: 10,
  active: true,
  lastGeneratedYear: null,
  lastGeneratedMonth: null,
};

describe("recurringCostService", () => {
  beforeEach(() => {
    mocked.runTransaction.mockReset();
  });

  it("lista e converte as recorrencias (cursor e inicio)", async () => {
    mocked.getDocs.mockResolvedValueOnce(
      querySnapshot([
        { id: "r1", data: DOC_DATA },
        { id: "r2", data: { ...DOC_DATA, active: false, lastGeneratedYear: 2026, lastGeneratedMonth: 11 } },
      ]) as never,
    );

    const items = await listRecurringCosts("uid-1");

    expect(mocked.collection).toHaveBeenCalledWith(expect.anything(), "users", "uid-1", "recurringCosts");
    expect(items).toEqual([
      recurring(),
      recurring({ id: "r2", active: false, lastGenerated: { year: 2026, month: 11 } }),
    ]);
  });

  it("assina em tempo real ordenando pela conta", () => {
    const onData = vi.fn();
    mocked.onSnapshot.mockImplementationOnce(((_ref: unknown, next: (s: unknown) => void) => {
      next(
        querySnapshot([
          { id: "b", data: { ...DOC_DATA, accountName: "Internet" } },
          { id: "a", data: DOC_DATA },
        ]),
      );
      return () => undefined;
    }) as never);

    subscribeToRecurringCosts("uid-1", onData, vi.fn());

    expect(onData.mock.calls[0][0].map((item: RecurringCost) => item.accountName)).toEqual([
      "Aluguel",
      "Internet",
    ]);
  });

  it("cria ativa, sem cursor e com textos aparados", async () => {
    const created = await createRecurringCost("uid-1", INPUT);

    expect(mocked.addDoc).toHaveBeenCalledWith(
      expect.objectContaining({ path: "users/uid-1/recurringCosts" }),
      {
        userId: "uid-1",
        ...DOC_DATA,
        createdAt: "SERVER_TIMESTAMP",
        updatedAt: "SERVER_TIMESTAMP",
      },
    );
    expect(created).toMatchObject({ active: true, lastGenerated: null, id: expect.stringMatching(/^auto-/) });
  });

  it("edita sem mexer no cursor; exclui", async () => {
    await updateRecurringCost("uid-1", "r1", INPUT);
    const payload = mocked.updateDoc.mock.calls[0][1] as unknown as Record<string, unknown>;
    expect(payload).not.toHaveProperty("lastGeneratedYear");
    expect(payload).toMatchObject({ accountName: "Aluguel", startMonth: 10 });

    await deleteRecurringCost("uid-1", "r1");
    expect(mocked.deleteDoc).toHaveBeenCalledWith(
      expect.objectContaining({ path: "users/uid-1/recurringCosts/r1" }),
    );
  });

  it("pausar grava somente active=false (cursor intocado)", async () => {
    const paused = await setRecurringCostActive("uid-1", recurring({ lastGenerated: NOV }), false, NOW);

    expect(paused).toMatchObject({ active: false, lastGenerated: NOV });
    expect(mocked.updateDoc).toHaveBeenCalledWith(
      expect.objectContaining({ path: "users/uid-1/recurringCosts/r1" }),
      { active: false, updatedAt: "SERVER_TIMESTAMP" },
    );
  });

  it("regressao: reativar le o cursor do servidor (nao o da tela) e pula os meses pausados", async () => {
    // Tela desatualizada (cursor 08); servidor ja gerou ate 11.
    const tx = transactionWith({ ...DOC_DATA, active: false, lastGeneratedYear: 2026, lastGeneratedMonth: 11 });
    const resumed = await setRecurringCostActive(
      "uid-1",
      recurring({ active: false, lastGenerated: { year: 2026, month: 8 } }),
      true,
      NOW,
    );

    expect(resumed).toMatchObject({ active: true, lastGenerated: NOV });
    expect(tx.update).toHaveBeenCalledWith(
      expect.objectContaining({ path: "users/uid-1/recurringCosts/r1" }),
      { active: true, lastGeneratedYear: 2026, lastGeneratedMonth: 11, updatedAt: "SERVER_TIMESTAMP" },
    );
  });

  it("gera em transacao a partir do cursor do servidor, com id deterministico", async () => {
    const tx = transactionWith({ ...DOC_DATA, lastGeneratedYear: 2026, lastGeneratedMonth: 9 });

    await expect(generateRecurring("uid-1", "r1", NOW)).resolves.toBe(2);

    expect(tx.set).toHaveBeenCalledTimes(2);
    expect(tx.set).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ path: "users/uid-1/costEntries/rec-r1-2026-10" }),
      expect.objectContaining({
        userId: "uid-1",
        accountName: "Aluguel",
        amount: 2000,
        category: "moradia",
        installmentsTotal: 1,
        competenceYear: 2026,
        competenceMonth: 10,
        recurringId: "r1",
        createdAt: expect.objectContaining({ __timestamp: new Date(2026, 9, 5, 12).toISOString() }),
      }),
    );
    expect(tx.update).toHaveBeenCalledWith(
      expect.objectContaining({ path: "users/uid-1/recurringCosts/r1" }),
      { lastGeneratedYear: 2026, lastGeneratedMonth: 11, updatedAt: "SERVER_TIMESTAMP" },
    );
  });

  it("regressao: outra aba ja gerou (cursor atual no servidor) => nada e regravado", async () => {
    const tx = transactionWith({ ...DOC_DATA, lastGeneratedYear: 2026, lastGeneratedMonth: 11 });

    await expect(generateRecurring("uid-1", "r1", NOW)).resolves.toBe(0);
    expect(tx.set).not.toHaveBeenCalled();
    expect(tx.update).not.toHaveBeenCalled();
  });

  it("recorrencia excluida no meio do caminho: nada a gerar", async () => {
    const tx = transactionWith(null);
    await expect(generateRecurring("uid-1", "r1", NOW)).resolves.toBe(0);
    expect(tx.set).not.toHaveBeenCalled();
  });

  it("sincroniza so quem tem pendencia e isola falhas por recorrencia", async () => {
    mocked.getDocs.mockResolvedValueOnce(
      querySnapshot([
        { id: "r1", data: DOC_DATA },
        { id: "r2", data: { ...DOC_DATA, lastGeneratedYear: 2026, lastGeneratedMonth: 11 } },
        { id: "r3", data: DOC_DATA },
      ]) as never,
    );
    const tx = transactionWith(DOC_DATA);
    mocked.runTransaction
      .mockImplementationOnce((async (_db: unknown, fn: (t: unknown) => unknown) => fn(tx)) as never)
      .mockRejectedValueOnce(new Error("offline"));

    await expect(syncRecurringCosts("uid-1", { now: NOW })).resolves.toEqual({
      created: 2,
      failed: 1,
    });
    expect(mocked.runTransaction).toHaveBeenCalledTimes(2);
  });
});
