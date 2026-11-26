import type { RecurringBudget } from "@/domain/entities/budget";
import {
  buildAxisTicks,
  buildMonthlyEvolution,
  listCompetences,
  niceStep,
  summarizeEvolution,
  yearsOf,
} from "@/domain/rules/evolutionRules";
import { makeBudget, makeCostEntry } from "@/test/factories";

const at = (year: number, month: number) => ({ year, month });

function entry(year: number, month: number, amount: number, overrides = {}) {
  return makeCostEntry({
    competenceYear: year,
    competenceMonth: month,
    amount,
    ...overrides,
  });
}

describe("listCompetences / yearsOf", () => {
  it("gera o periodo em ordem cronologica atravessando o ano", () => {
    const months = listCompetences(at(2026, 2), 4);
    expect(months).toEqual([at(2025, 11), at(2025, 12), at(2026, 1), at(2026, 2)]);
    expect(yearsOf(months)).toEqual([2025, 2026]);
  });
});

describe("buildMonthlyEvolution", () => {
  const competences = listCompetences(at(2026, 11), 6);
  const leisureRecurring: RecurringBudget = {
    id: "2026-08-lazer",
    category: "lazer",
    year: 2026,
    month: 8,
    limit: 1000,
  };

  it("cenario 1: soma por competencia e preenche meses vazios com zero", () => {
    const points = buildMonthlyEvolution({
      entries: [
        entry(2026, 6, 100),
        entry(2026, 6, 50.1),
        entry(2026, 11, 300),
        entry(2026, 5, 999), // fora do periodo
      ],
      monthLimits: [],
      recurring: [],
      competences,
      category: "todas",
      costType: "todos",
    });

    expect(points.map((point) => point.spent)).toEqual([150.1, 0, 0, 0, 0, 300]);
    expect(points.every((point) => point.budget === null)).toBe(true);
  });

  it("cenario 2: orcamento efetivo da categoria (recorrente + excecao) e estouro", () => {
    const points = buildMonthlyEvolution({
      entries: [
        entry(2026, 9, 1000, { category: "lazer" }),
        entry(2026, 10, 400, { category: "lazer" }),
        entry(2026, 10, 5000, { category: "moradia" }),
      ],
      monthLimits: [makeBudget("lazer", 300, at(2026, 10))],
      recurring: [leisureRecurring],
      competences,
      category: "lazer",
      costType: "todos",
    });

    expect(points.map((point) => point.budget)).toEqual([null, null, 1000, 1000, 300, 1000]);
    expect(points.map((point) => point.isOverBudget)).toEqual([
      false, false, false, true, true, false,
    ]);
    expect(points[4].spent).toBe(400);
  });

  it("com categoria 'todas' soma os limites efetivos de todas as categorias", () => {
    const [point] = buildMonthlyEvolution({
      entries: [],
      monthLimits: [makeBudget("moradia", 2000, at(2026, 11))],
      recurring: [leisureRecurring],
      competences: [at(2026, 11)],
      category: "todas",
      costType: "todos",
    });

    expect(point.budget).toBe(3000);
  });

  it("cenario 3: filtro de frente soma so a frente e omite o orcamento", () => {
    const points = buildMonthlyEvolution({
      entries: [
        entry(2026, 11, 100, { costType: "fixo" }),
        entry(2026, 11, 40, { costType: "variavel" }),
      ],
      monthLimits: [makeBudget("outros", 50, at(2026, 11))],
      recurring: [],
      competences: [at(2026, 11)],
      category: "todas",
      costType: "fixo",
    });

    expect(points[0]).toEqual({
      competence: at(2026, 11),
      spent: 100,
      budget: null,
      isOverBudget: false,
    });
  });
});

describe("summarizeEvolution", () => {
  const point = (month: number, spent: number, budget: number | null = null) => ({
    competence: at(2026, month),
    spent,
    budget,
    isOverBudget: budget !== null && spent >= budget,
  });

  it("cenario 5: media, pico, variacao do ultimo mes e meses acima do orcamento", () => {
    const summary = summarizeEvolution([
      point(9, 100, 150),
      point(10, 300, 250),
      point(11, 200),
    ]);

    expect(summary.average).toBe(200);
    expect(summary.peak?.competence).toEqual(at(2026, 10));
    expect(summary.lastChange).toBeCloseTo(-1 / 3);
    expect(summary.monthsOverBudget).toBe(1);
    expect(summary.monthsWithBudget).toBe(2);
  });

  it("variacao indefinida quando o mes anterior e zero; sem pico sem gastos", () => {
    const summary = summarizeEvolution([point(10, 0), point(11, 50)]);
    expect(summary.lastChange).toBeNull();
    expect(summarizeEvolution([point(11, 0)]).peak).toBeNull();
    expect(summarizeEvolution([]).average).toBe(0);
  });
});

describe("eixo", () => {
  it("passos redondos", () => {
    expect(niceStep(1000)).toBe(250);
    expect(niceStep(5432)).toBe(2000);
    expect(niceStep(90)).toBe(25);
    expect(niceStep(0)).toBe(1);
  });

  it("ticks comecam em zero e cobrem o maximo", () => {
    expect(buildAxisTicks(5432)).toEqual([0, 2000, 4000, 6000]);
    expect(buildAxisTicks(1000)).toEqual([0, 250, 500, 750, 1000]);
    expect(buildAxisTicks(0)).toEqual([0, 2.5, 5, 7.5, 10]);
    // Regressao D2: valores abaixo de R$ 10 nao geram ticks duplicados/sub-centavo.
    expect(buildAxisTicks(0.01)).toEqual([0, 2.5, 5, 7.5, 10]);
    expect(buildAxisTicks(9.99)).toEqual([0, 2.5, 5, 7.5, 10]);
    expect(buildAxisTicks(10.5)).toEqual([0, 5, 10, 15]);
  });
});
