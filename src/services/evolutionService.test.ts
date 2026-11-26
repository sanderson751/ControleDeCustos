import * as firestore from "firebase/firestore";
import { listBudgetLimitsByYears } from "@/services/budgetService";
import { listCostsByCompetenceRange } from "@/services/costService";
import { loadEvolutionData } from "@/services/evolutionService";
import { querySnapshot } from "@/test/firestoreMock";

vi.mock("firebase/firestore", async () =>
  (await import("@/test/firestoreMock")).createFirestoreMock(),
);

const mocked = vi.mocked(firestore);

const costDoc = (id: string, year: number, month: number) => ({
  id,
  data: { accountName: id, amount: 10, competenceYear: year, competenceMonth: month },
});

describe("consultas da evolucao mensal", () => {
  it("custos por intervalo: uma consulta 'in' por ano e corte dos meses fora do intervalo", async () => {
    mocked.getDocs.mockResolvedValueOnce(
      querySnapshot([
        costDoc("antes", 2025, 9),
        costDoc("inicio", 2025, 10),
        costDoc("fim", 2026, 3),
        costDoc("depois", 2026, 4),
      ]) as never,
    );

    const entries = await listCostsByCompetenceRange(
      "uid-1",
      { year: 2025, month: 10 },
      { year: 2026, month: 3 },
    );

    expect(mocked.where).toHaveBeenCalledWith("competenceYear", "in", [2025, 2026]);
    expect(mocked.getDocs).toHaveBeenCalledTimes(1);
    expect(entries.map((entry) => entry.id)).toEqual(["inicio", "fim"]);
  });

  it("orcamentos mensais por anos", async () => {
    mocked.getDocs.mockResolvedValueOnce(
      querySnapshot([
        { id: "2026-01-lazer", data: { category: "lazer", year: 2026, month: 1, limit: 50 } },
      ]) as never,
    );

    const limits = await listBudgetLimitsByYears("uid-1", [2025, 2026]);

    expect(mocked.where).toHaveBeenCalledWith("year", "in", [2025, 2026]);
    expect(limits[0]).toMatchObject({ category: "lazer", limit: 50 });
  });

  it("carrega custos, orcamentos e vigencias do periodo em paralelo", async () => {
    mocked.getDocs.mockResolvedValue(querySnapshot([]) as never);

    const data = await loadEvolutionData("uid-1", { year: 2026, month: 2 }, 6);

    expect(data.competences).toHaveLength(6);
    expect(data.competences[0]).toEqual({ year: 2025, month: 9 });
    expect(mocked.getDocs).toHaveBeenCalledTimes(3);
    expect(mocked.collection).toHaveBeenCalledWith(
      expect.anything(),
      "users",
      "uid-1",
      "recurringBudgets",
    );
  });
});
