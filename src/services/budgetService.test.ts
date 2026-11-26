import * as firestore from "firebase/firestore";
import {
  applyBudgetChanges,
  listMonthBudgets,
} from "@/services/budgetService";
import { querySnapshot } from "@/test/firestoreMock";

vi.mock("firebase/firestore", async () =>
  (await import("@/test/firestoreMock")).createFirestoreMock(),
);

type BatchMock = Record<"set" | "update" | "delete" | "commit", ReturnType<typeof vi.fn>>;
const batch = (firestore as unknown as { __batch: BatchMock }).__batch;
const mocked = vi.mocked(firestore);

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

    const limits = await listMonthBudgets("uid-1", { year: 2026, month: 3 });

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

  it("aplica criacoes, alteracoes e remocoes em um unico batch", async () => {
    await applyBudgetChanges(
      "uid-1",
      { year: 2026, month: 3 },
      {
        creates: [{ category: "alimentacao", limit: 1200 }],
        updates: [{ category: "lazer", limit: 350 }],
        removals: ["saude"],
      },
    );

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
    expect(batch.commit).toHaveBeenCalledTimes(1);
  });

  it("nao escreve nada quando o plano esta vazio", async () => {
    await applyBudgetChanges(
      "uid-1",
      { year: 2026, month: 3 },
      { creates: [], updates: [], removals: [] },
    );

    expect(mocked.writeBatch).not.toHaveBeenCalled();
  });

  it("propaga falha de persistencia", async () => {
    batch.commit.mockRejectedValueOnce(
      Object.assign(new Error("denied"), { code: "permission-denied" }),
    );

    await expect(
      applyBudgetChanges(
        "uid-1",
        { year: 2026, month: 3 },
        { creates: [{ category: "lazer", limit: 10 }], updates: [], removals: [] },
      ),
    ).rejects.toMatchObject({ code: "permission-denied" });
  });
});
