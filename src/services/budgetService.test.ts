import * as firestore from "firebase/firestore";
import {
  applyMonthBudgetChanges,
  listMonthBudgets,
  listRecurringBudgets,
  loadMonthBudgetState,
} from "@/services/budgetService";
import { querySnapshot } from "@/test/firestoreMock";

vi.mock("firebase/firestore", async () =>
  (await import("@/test/firestoreMock")).createFirestoreMock(),
);

type BatchMock = Record<"set" | "update" | "delete" | "commit", ReturnType<typeof vi.fn>>;
const batch = (firestore as unknown as { __batch: BatchMock }).__batch;
const mocked = vi.mocked(firestore);
const MARCH = { year: 2026, month: 3 };
const EMPTY_MONTHLY = { creates: [], updates: [], removals: [] };

describe("budgetService", () => {
  it("lista os orcamentos da competencia em users/{uid}/budgetLimits", async () => {
    mocked.getDocs.mockResolvedValueOnce(
      querySnapshot([
        {
          id: "2026-03-alimentacao",
          data: { category: "alimentacao", year: 2026, month: 3, limit: 1200 },
        },
      ]) as never,
    );

    const limits = await listMonthBudgets("uid-1", MARCH);

    expect(mocked.collection).toHaveBeenCalledWith(
      expect.anything(),
      "users",
      "uid-1",
      "budgetLimits",
    );
    expect(mocked.where).toHaveBeenCalledWith("year", "==", 2026);
    expect(mocked.where).toHaveBeenCalledWith("month", "==", 3);
    expect(limits).toEqual([
      {
        id: "2026-03-alimentacao",
        category: "alimentacao",
        year: 2026,
        month: 3,
        limit: 1200,
      },
    ]);
  });

  it("lista as vigencias recorrentes (limite nulo = encerramento)", async () => {
    mocked.getDocs.mockResolvedValueOnce(
      querySnapshot([
        { id: "2026-01-lazer", data: { category: "lazer", year: 2026, month: 1, limit: 300 } },
        { id: "2026-05-lazer", data: { category: "lazer", year: 2026, month: 5, limit: null } },
      ]) as never,
    );

    const items = await listRecurringBudgets("uid-1");

    expect(mocked.collection).toHaveBeenCalledWith(
      expect.anything(),
      "users",
      "uid-1",
      "recurringBudgets",
    );
    expect(items.map((item) => item.limit)).toEqual([300, null]);
  });

  it("monta o estado do mes com limites efetivos (excecao + recorrencia)", async () => {
    mocked.getDocs
      .mockResolvedValueOnce(
        querySnapshot([
          {
            id: "2026-03-moradia",
            data: { category: "moradia", year: 2026, month: 3, limit: 2000 },
          },
        ]) as never,
      )
      .mockResolvedValueOnce(
        querySnapshot([
          { id: "2026-01-lazer", data: { category: "lazer", year: 2026, month: 1, limit: 300 } },
        ]) as never,
      );

    const state = await loadMonthBudgetState("uid-1", MARCH);

    expect(state.monthLimits).toHaveLength(1);
    expect(state.recurring).toHaveLength(1);
    expect(
      state.effective.map((item) => [item.category, item.limit, item.source]),
    ).toEqual([
      ["moradia", 2000, "mensal"],
      ["lazer", 300, "recorrente"],
    ]);
  });

  it("aplica excecoes mensais e vigencias recorrentes em um unico batch", async () => {
    await applyMonthBudgetChanges("uid-1", MARCH, {
      monthly: {
        creates: [{ category: "alimentacao", limit: 1200 }],
        updates: [{ category: "lazer", limit: 350 }],
        removals: ["saude"],
      },
      recurring: [
        { category: "moradia", limit: 2500, operation: "create", start: MARCH },
        { category: "transporte", limit: null, operation: "update", start: MARCH },
        { category: "lazer", limit: 400, operation: "delete", start: { year: 2026, month: 9 } },
      ],
      ignored: [],
    });

    expect(batch.set).toHaveBeenCalledWith(
      { path: "users/uid-1/budgetLimits/2026-03-alimentacao" },
      {
        userId: "uid-1",
        year: 2026,
        month: 3,
        category: "alimentacao",
        limit: 1200,
        createdAt: "SERVER_TIMESTAMP",
        updatedAt: "SERVER_TIMESTAMP",
      },
    );
    expect(batch.update).toHaveBeenCalledWith(
      { path: "users/uid-1/budgetLimits/2026-03-lazer" },
      { limit: 350, updatedAt: "SERVER_TIMESTAMP" },
    );
    expect(batch.delete).toHaveBeenCalledWith({
      path: "users/uid-1/budgetLimits/2026-03-saude",
    });
    expect(batch.set).toHaveBeenCalledWith(
      { path: "users/uid-1/recurringBudgets/2026-03-moradia" },
      expect.objectContaining({ limit: 2500, category: "moradia", year: 2026, month: 3 }),
    );
    expect(batch.update).toHaveBeenCalledWith(
      { path: "users/uid-1/recurringBudgets/2026-03-transporte" },
      { limit: null, updatedAt: "SERVER_TIMESTAMP" },
    );
    expect(batch.delete).toHaveBeenCalledWith({
      path: "users/uid-1/recurringBudgets/2026-09-lazer",
    });
    expect(batch.commit).toHaveBeenCalledTimes(1);
  });

  it("divide em lotes de ate 10 categorias personalizadas distintas", async () => {
    const creates = Array.from({ length: 12 }, (_, index) => ({
      category: `cat${index}`,
      limit: 10,
    }));

    await applyMonthBudgetChanges("uid-1", MARCH, {
      monthly: { creates: [{ category: "lazer", limit: 5 }, ...creates], updates: [], removals: [] },
      recurring: [{ category: "cat0", limit: 10, operation: "create", start: MARCH }],
      ignored: [],
    });

    expect(mocked.writeBatch).toHaveBeenCalledTimes(2);
    expect(batch.commit).toHaveBeenCalledTimes(2);
    expect(batch.set).toHaveBeenCalledTimes(14);
  });

  it("nao escreve nada quando o plano esta vazio", async () => {
    await applyMonthBudgetChanges("uid-1", MARCH, {
      monthly: EMPTY_MONTHLY,
      recurring: [],
      ignored: [],
    });

    expect(mocked.writeBatch).not.toHaveBeenCalled();
  });

  it("propaga falha de persistencia", async () => {
    batch.commit.mockRejectedValueOnce(
      Object.assign(new Error("denied"), { code: "permission-denied" }),
    );

    await expect(
      applyMonthBudgetChanges("uid-1", MARCH, {
        monthly: EMPTY_MONTHLY,
        recurring: [{ category: "lazer", limit: 10, operation: "create", start: MARCH }],
        ignored: [],
      }),
    ).rejects.toMatchObject({ code: "permission-denied" });
  });
});
