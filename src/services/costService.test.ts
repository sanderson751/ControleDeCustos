import * as firestore from "firebase/firestore";
import {
  createCostEntry,
  deleteCostEntry,
  getCostEntryById,
  listMonthCosts,
  updateCostEntry,
} from "@/services/costService";
import {
  docSnapshot,
  querySnapshot,
  timestamp,
} from "@/test/firestoreMock";

vi.mock("firebase/firestore", async () =>
  (await import("@/test/firestoreMock")).createFirestoreMock(),
);

type BatchMock = {
  set: ReturnType<typeof vi.fn>;
  commit: ReturnType<typeof vi.fn>;
};
const batch = (firestore as unknown as { __batch: BatchMock }).__batch;
const mocked = vi.mocked(firestore);

describe("costService", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 10, 20, 10));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("listMonthCosts", () => {
    it("consulta a competencia em users/{uid}/costEntries e ordena por criacao desc", async () => {
      mocked.getDocs.mockResolvedValueOnce(
        querySnapshot([
          {
            id: "old",
            data: {
              accountName: "Luz",
              amount: 80,
              costType: "fixo",
              installmentsTotal: 1,
              competenceYear: 2026,
              competenceMonth: 11,
              createdAt: timestamp(new Date(2026, 10, 1)),
            },
          },
          {
            id: "new",
            data: {
              accountName: "Mercado",
              amount: 120.5,
              costType: "variavel",
              competenceYear: 2026,
              competenceMonth: 11,
              createdAt: timestamp(new Date(2026, 10, 15)),
            },
          },
        ]) as never,
      );

      const entries = await listMonthCosts("uid-1", 2026, 11);

      expect(mocked.collection).toHaveBeenCalledWith(
        expect.anything(),
        "users",
        "uid-1",
        "costEntries",
      );
      expect(mocked.where).toHaveBeenCalledWith("competenceYear", "==", 2026);
      expect(mocked.where).toHaveBeenCalledWith("competenceMonth", "==", 11);
      expect(entries.map((entry) => entry.id)).toEqual(["new", "old"]);
      expect(entries[0]).toMatchObject({
        accountName: "Mercado",
        amount: 120.5,
        costType: "variavel",
        category: "outros", // documento legado sem categoria
        installmentsTotal: 1,
      });
    });
  });

  describe("getCostEntryById", () => {
    it("retorna null quando o documento nao existe", async () => {
      mocked.getDoc.mockResolvedValueOnce(docSnapshot("x", null) as never);
      await expect(getCostEntryById("uid-1", "x")).resolves.toBeNull();
    });

    it("converte o documento existente", async () => {
      mocked.getDoc.mockResolvedValueOnce(
        docSnapshot("abc", {
          accountName: "Aluguel",
          amount: 1500,
          costType: "fixo",
          installmentsTotal: 12,
        }) as never,
      );

      const entry = await getCostEntryById("uid-1", "abc");

      expect(mocked.doc).toHaveBeenCalledWith(
        expect.anything(),
        "users",
        "uid-1",
        "costEntries",
        "abc",
      );
      expect(entry).toMatchObject({
        id: "abc",
        accountName: "Aluguel",
        costType: "fixo",
        category: "outros", // documento legado sem categoria
        installmentsTotal: 12,
      });
    });
  });

  describe("createCostEntry", () => {
    it("custo variavel grava um documento com horario do servidor", async () => {
      await createCostEntry("uid-1", {
        accountName: "  Mercado  ",
        amount: 99.9,
        costType: "variavel",
        category: "alimentacao",
        installmentsTotal: 4,
      });

      expect(batch.set).toHaveBeenCalledTimes(1);
      expect(batch.set.mock.calls[0][1]).toEqual({
        userId: "uid-1",
        accountName: "Mercado",
        amount: 99.9,
        costType: "variavel",
        category: "alimentacao",
        description: "",
        installmentsTotal: 1,
        competenceYear: 2026,
        competenceMonth: 11,
        createdAt: "SERVER_TIMESTAMP",
        updatedAt: "SERVER_TIMESTAMP",
      });
      expect(batch.commit).toHaveBeenCalledTimes(1);
    });

    it("custo fixo parcelado grava uma parcela por competencia no mesmo batch", async () => {
      await createCostEntry("uid-1", {
        accountName: "Curso",
        amount: 300,
        costType: "fixo",
        category: "educacao",
        description: "  Inglês intensivo  ",
        installmentsTotal: 3,
      });

      const writes = batch.set.mock.calls.map((call) => call[1]);
      expect(writes).toHaveLength(3);
      expect(
        writes.map((write) => [write.competenceMonth, write.competenceYear]),
      ).toEqual([
        [11, 2026],
        [12, 2026],
        [1, 2027],
      ]);
      expect(writes.every((write) => write.installmentsTotal === 3)).toBe(true);
      // RF-02: todas as parcelas herdam a descricao (aparada).
      expect(writes.every((write) => write.description === "Inglês intensivo")).toBe(true);
      expect(batch.commit).toHaveBeenCalledTimes(1);
    });

    it("usa a data manual convertida em Timestamp", async () => {
      const manualDate = new Date(2026, 4, 10, 12);

      await createCostEntry("uid-1", {
        accountName: "Conta antiga",
        amount: 10,
        costType: "variavel",
        category: "alimentacao",
        createdAtManual: manualDate,
      });

      expect(mocked.Timestamp.fromDate).toHaveBeenCalledWith(manualDate);
      expect(batch.set.mock.calls[0][1]).toMatchObject({
        competenceMonth: 5,
        createdAt: { __timestamp: manualDate.toISOString() },
      });
    });

    it("propaga falha de persistencia", async () => {
      batch.commit.mockRejectedValueOnce(
        Object.assign(new Error("denied"), { code: "permission-denied" }),
      );

      await expect(
        createCostEntry("uid-1", {
          accountName: "X",
          amount: 1,
          costType: "variavel",
          category: "alimentacao",
        }),
      ).rejects.toMatchObject({ code: "permission-denied" });
    });
  });

  describe("updateCostEntry", () => {
    it("normaliza parcelas para custo variavel e atualiza updatedAt", async () => {
      await updateCostEntry("uid-1", "abc", {
        accountName: " Luz ",
        amount: 50,
        costType: "variavel",
        category: "alimentacao",
        description: "  conta de luz  ",
        installmentsTotal: 7,
      });

      expect(mocked.updateDoc).toHaveBeenCalledWith(
        { path: "users/uid-1/costEntries/abc" },
        {
          accountName: "Luz",
          amount: 50,
          costType: "variavel",
          category: "alimentacao",
          description: "conta de luz",
          installmentsTotal: 1,
          updatedAt: "SERVER_TIMESTAMP",
        },
      );
    });
  });

  describe("deleteCostEntry", () => {
    it("remove o documento do usuario", async () => {
      await deleteCostEntry("uid-1", "abc");
      expect(mocked.deleteDoc).toHaveBeenCalledWith({
        path: "users/uid-1/costEntries/abc",
      });
    });
  });
});
