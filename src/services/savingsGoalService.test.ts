import * as firestore from "firebase/firestore";
import {
  addContribution,
  createGoal,
  deleteContribution,
  deleteGoal,
  subscribeToContributions,
  subscribeToGoals,
  updateGoal,
} from "@/services/savingsGoalService";
import { querySnapshot, timestamp } from "@/test/firestoreMock";

vi.mock("firebase/firestore", async () =>
  (await import("@/test/firestoreMock")).createFirestoreMock(),
);

type BatchMock = Record<"set" | "update" | "delete" | "commit", ReturnType<typeof vi.fn>>;
const batch = (firestore as unknown as { __batch: BatchMock }).__batch;
const mocked = vi.mocked(firestore);

function emitOnce(docs: Array<{ id: string; data: Record<string, unknown> }>) {
  mocked.onSnapshot.mockImplementationOnce(((_ref: unknown, next: (s: unknown) => void) => {
    next(querySnapshot(docs));
    return () => undefined;
  }) as never);
}

describe("savingsGoalService", () => {
  beforeEach(() => {
    batch.commit.mockResolvedValue(undefined);
  });

  it("assina metas convertendo o prazo (ano e mes juntos)", () => {
    const onData = vi.fn();
    emitOnce([
      { id: "g1", data: { name: "Viagem", targetAmount: 6000, deadlineYear: 2027, deadlineMonth: 4 } },
      { id: "g2", data: { name: "Reserva", targetAmount: 10000, deadlineYear: null, deadlineMonth: null } },
    ]);

    subscribeToGoals("uid-1", onData, vi.fn());

    expect(mocked.collection).toHaveBeenCalledWith(expect.anything(), "users", "uid-1", "savingsGoals");
    expect(onData).toHaveBeenCalledWith([
      { id: "g1", name: "Viagem", targetAmount: 6000, deadline: { year: 2027, month: 4 } },
      { id: "g2", name: "Reserva", targetAmount: 10000, deadline: null },
    ]);
  });

  it("assina movimentacoes da mais recente para a mais antiga", () => {
    const onData = vi.fn();
    emitOnce([
      { id: "c1", data: { goalId: "g1", amount: 100, date: timestamp(new Date(2026, 9, 1)), note: "" } },
      { id: "c2", data: { goalId: "g1", amount: -50, date: timestamp(new Date(2026, 10, 1)) } },
    ]);

    subscribeToContributions("uid-1", onData, vi.fn());

    expect(onData.mock.calls[0][0].map((item: { id: string }) => item.id)).toEqual(["c2", "c1"]);
    expect(onData.mock.calls[0][0][0]).toMatchObject({ amount: -50, note: "" });
  });

  it("cria e edita a meta com prazo opcional", async () => {
    await expect(
      createGoal("uid-1", { name: " Viagem ", targetAmount: 6000, deadline: { year: 2027, month: 4 } }),
    ).resolves.toMatch(/^auto-/);
    expect(mocked.addDoc).toHaveBeenCalledWith(
      expect.objectContaining({ path: "users/uid-1/savingsGoals" }),
      {
        userId: "uid-1",
        name: "Viagem",
        targetAmount: 6000,
        deadlineYear: 2027,
        deadlineMonth: 4,
        createdAt: "SERVER_TIMESTAMP",
        updatedAt: "SERVER_TIMESTAMP",
      },
    );

    await updateGoal("uid-1", "g1", { name: "Viagem", targetAmount: 7000, deadline: null });
    expect(mocked.updateDoc).toHaveBeenCalledWith(
      expect.objectContaining({ path: "users/uid-1/savingsGoals/g1" }),
      { name: "Viagem", targetAmount: 7000, deadlineYear: null, deadlineMonth: null, updatedAt: "SERVER_TIMESTAMP" },
    );
  });

  it("registra e exclui movimentacoes", async () => {
    const date = new Date(2026, 10, 27, 12);
    await addContribution("uid-1", { goalId: "g1", amount: -50, date, note: " saque " });

    expect(mocked.addDoc).toHaveBeenCalledWith(
      expect.objectContaining({ path: "users/uid-1/goalContributions" }),
      {
        userId: "uid-1",
        goalId: "g1",
        amount: -50,
        date: expect.objectContaining({ __timestamp: date.toISOString() }),
        note: "saque",
        createdAt: "SERVER_TIMESTAMP",
      },
    );

    await deleteContribution("uid-1", "c9");
    expect(mocked.deleteDoc).toHaveBeenCalledWith(
      expect.objectContaining({ path: "users/uid-1/goalContributions/c9" }),
    );
  });

  it("exclui a meta primeiro (exclusao parece completa mesmo com falha posterior)", async () => {
    await deleteGoal("uid-1", "g1", [
      { id: "c1", goalId: "g1", amount: 10, date: new Date(), note: "" },
      { id: "c2", goalId: "outra", amount: 10, date: new Date(), note: "" },
      { id: "c3", goalId: "g1", amount: -5, date: new Date(), note: "" },
    ]);

    expect(batch.delete.mock.calls.map(([ref]) => (ref as { path: string }).path)).toEqual([
      "users/uid-1/savingsGoals/g1",
      "users/uid-1/goalContributions/c1",
      "users/uid-1/goalContributions/c3",
    ]);
    expect(batch.commit).toHaveBeenCalledTimes(1);
  });
});

describe("deleteGoal - muitas movimentacoes", () => {
  it("divide em lotes com a meta no primeiro", async () => {
    batch.commit.mockResolvedValue(undefined);
    const moves = Array.from({ length: 450 }, (_, index) => ({
      id: `c${index}`,
      goalId: "g1",
      amount: 1,
      date: new Date(),
      note: "",
    }));

    await deleteGoal("uid-1", "g1", moves);

    expect(batch.commit).toHaveBeenCalledTimes(2);
    expect((batch.delete.mock.calls[0][0] as { path: string }).path).toBe("users/uid-1/savingsGoals/g1");
  });
});
