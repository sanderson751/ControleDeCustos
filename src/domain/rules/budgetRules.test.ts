import {
  BUDGET_WARNING_RATIO,
  buildBudgetDocId,
  findWorsenedBudgets,
  getBudgetAlerts,
  getBudgetStatus,
  getConsumedPercent,
  hasBudgetChanges,
  MAX_BUDGET_LIMIT,
  planBudgetChanges,
  summarizeBudgets,
  validateBudgetInput,
} from "@/domain/rules/budgetRules";
import { makeBudget, makeCostEntry } from "@/test/factories";

describe("getBudgetStatus", () => {
  it("classifica pelos limiares de 80% e 100%", () => {
    expect(BUDGET_WARNING_RATIO).toBe(0.8);
    expect(getBudgetStatus(100, null)).toBe("sem-orcamento");
    expect(getBudgetStatus(100, 0)).toBe("sem-orcamento");
    expect(getBudgetStatus(959.99, 1200)).toBe("ok");
    expect(getBudgetStatus(960, 1200)).toBe("atencao");
    expect(getBudgetStatus(1199.99, 1200)).toBe("atencao");
    expect(getBudgetStatus(1200, 1200)).toBe("estourado");
  });

  it("regressao: exatamente 80% e atencao mesmo quando limit*0.8 tem erro de ponto flutuante", () => {
    // 101 * 0.8 === 80.80000000000001 em ponto flutuante
    expect(getBudgetStatus(80.8, 101)).toBe("atencao");
    expect(getBudgetStatus(9.6, 12)).toBe("atencao");
    expect(getBudgetStatus(11.2, 14)).toBe("atencao");
    expect(getBudgetStatus(80.79, 101)).toBe("ok");
    expect(getBudgetStatus(0.1 + 0.2, 0.3)).toBe("estourado");
  });
});

describe("getConsumedPercent", () => {
  it("arredonda para baixo, coerente com o status", () => {
    expect(getConsumedPercent(980, 1200)).toBe(81);
    expect(getConsumedPercent(799.5, 1000)).toBe(79);
    expect(getConsumedPercent(995, 1000)).toBe(99);
    expect(getConsumedPercent(80.8, 101)).toBe(80);
    expect(getConsumedPercent(1200, 1000)).toBe(120);
  });
});

describe("summarizeBudgets", () => {
  it("cenario do steering: R$ 980 de R$ 1.200 em Alimentacao gera atencao (81%)", () => {
    const summaries = summarizeBudgets(
      [
        makeCostEntry({ category: "alimentacao", amount: 700 }),
        makeCostEntry({ category: "alimentacao", amount: 280 }),
      ],
      [makeBudget("alimentacao", 1200)],
    );

    expect(summaries).toHaveLength(7);
    expect(summaries[0]).toEqual({
      category: "alimentacao",
      spent: 980,
      limit: 1200,
      percent: 81,
      remaining: 220,
      status: "atencao",
    });
  });

  it("ordena por gravidade e depois por gasto", () => {
    const summaries = summarizeBudgets(
      [
        makeCostEntry({ category: "moradia", amount: 2000 }),
        makeCostEntry({ category: "lazer", amount: 300 }),
        makeCostEntry({ category: "transporte", amount: 90 }),
      ],
      [makeBudget("lazer", 200), makeBudget("transporte", 100)],
    );

    expect(summaries.slice(0, 3).map((item) => [item.category, item.status])).toEqual([
      ["lazer", "estourado"],
      ["transporte", "atencao"],
      ["moradia", "sem-orcamento"],
    ]);
    expect(summaries[0].remaining).toBe(-100);
    expect(summaries[0].percent).toBe(150);
  });
});

describe("alertas", () => {
  const limits = [makeBudget("alimentacao", 1200)];

  it("lista apenas categorias em atencao ou estouradas", () => {
    const alerts = getBudgetAlerts(
      summarizeBudgets(
        [makeCostEntry({ category: "alimentacao", amount: 1220 })],
        limits,
      ),
    );

    expect(alerts.map((item) => [item.category, item.status])).toEqual([
      ["alimentacao", "estourado"],
    ]);
  });

  it("detecta somente categorias cujo status piorou", () => {
    const before = summarizeBudgets(
      [makeCostEntry({ category: "alimentacao", amount: 980 })],
      limits,
    );
    const sameStatus = summarizeBudgets(
      [makeCostEntry({ category: "alimentacao", amount: 1000 })],
      limits,
    );
    const worse = summarizeBudgets(
      [makeCostEntry({ category: "alimentacao", amount: 1220 })],
      limits,
    );

    expect(findWorsenedBudgets(before, sameStatus)).toEqual([]);
    expect(findWorsenedBudgets(before, worse).map((item) => item.status)).toEqual([
      "estourado",
    ]);
    expect(findWorsenedBudgets([], before).map((item) => item.status)).toEqual([
      "atencao",
    ]);
  });
});

describe("persistencia de orcamento", () => {
  it("gera id deterministico por competencia e categoria", () => {
    expect(buildBudgetDocId(2026, 3, "alimentacao")).toBe("2026-03-alimentacao");
  });

  it("valida o valor informado", () => {
    expect(validateBudgetInput(Number.NaN)).toEqual({ ok: true, value: null });
    expect(validateBudgetInput(null)).toEqual({ ok: true, value: null });
    expect(validateBudgetInput(1200)).toEqual({ ok: true, value: 1200 });
    expect(validateBudgetInput(0).ok).toBe(false);
    expect(validateBudgetInput(MAX_BUDGET_LIMIT + 1).ok).toBe(false);
  });

  it("planeja apenas criacoes, alteracoes e remocoes necessarias", () => {
    const plan = planBudgetChanges(
      [makeBudget("moradia", 2000), makeBudget("lazer", 300), makeBudget("saude", 500)],
      { moradia: 2000, lazer: 350, saude: null, alimentacao: 1200 },
    );

    expect(plan).toEqual({
      creates: [{ category: "alimentacao", limit: 1200 }],
      updates: [{ category: "lazer", limit: 350 }],
      removals: ["saude"],
    });
    expect(hasBudgetChanges(plan)).toBe(true);
    expect(
      hasBudgetChanges(planBudgetChanges([makeBudget("moradia", 1)], { moradia: 1 })),
    ).toBe(false);
  });
});
