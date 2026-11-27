import * as firestore from "firebase/firestore";
import { ImportPartialError, importCostEntries } from "@/services/importService";

vi.mock("firebase/firestore", async () =>
  (await import("@/test/firestoreMock")).createFirestoreMock(),
);

type BatchMock = Record<"set" | "update" | "delete" | "commit", ReturnType<typeof vi.fn>>;
const batch = (firestore as unknown as { __batch: BatchMock }).__batch;

const input = (category: string, day = 5) => ({
  accountName: "  Uber Trip ",
  amount: 23.9,
  costType: "variavel" as const,
  category,
  description: "Importado de extrato.csv",
  installmentsTotal: 1,
  createdAtManual: new Date(2026, 3 - 1, day, 12),
});

describe("importCostEntries", () => {
  beforeEach(() => {
    batch.commit.mockResolvedValue(undefined);
  });

  it("grava cada linha como custo de 1 parcela na competencia da data", async () => {
    const count = await importCostEntries("uid-1", [input("transporte")]);

    expect(count).toBe(1);
    expect(batch.set).toHaveBeenCalledWith(
      expect.objectContaining({ path: expect.stringMatching(/^users\/uid-1\/costEntries\//) }),
      {
        userId: "uid-1",
        accountName: "Uber Trip",
        amount: 23.9,
        costType: "variavel",
        category: "transporte",
        description: "Importado de extrato.csv",
        installmentsTotal: 1,
        competenceYear: 2026,
        competenceMonth: 3,
        createdAt: expect.objectContaining({ __timestamp: expect.any(String) }),
        updatedAt: "SERVER_TIMESTAMP",
      },
    );
  });

  it("falha no primeiro lote propaga o erro original", async () => {
    batch.commit.mockRejectedValueOnce(new Error("denied"));
    await expect(importCostEntries("uid-1", [input("lazer")])).rejects.toThrow("denied");
  });

  it("falha depois de lotes gravados informa o parcial", async () => {
    const inputs = Array.from({ length: 11 }, (_, index) => input(`custom${index}`));
    batch.commit
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("denied"));

    const error = await importCostEntries("uid-1", inputs).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ImportPartialError);
    expect((error as ImportPartialError).imported).toBe(10);
  });
});

describe("importCostEntries - volume", () => {
  it("divide em lotes acima de 400 linhas", async () => {
    batch.commit.mockResolvedValue(undefined);
    const inputs = Array.from({ length: 401 }, () => input("outros"));

    await expect(importCostEntries("uid-1", inputs)).resolves.toBe(401);
    expect(batch.commit).toHaveBeenCalledTimes(2);
  });
});
