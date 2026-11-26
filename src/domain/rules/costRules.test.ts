import type { CostEntry } from "@/domain/entities/cost";
import {
  addMonths,
  buildInstallmentPlan,
  calculateTotals,
  filterByCostType,
  MAX_INSTALLMENTS,
  normalizeInstallments,
  paginate,
  sortByCreatedAtDesc,
  validateCostForm,
} from "@/domain/rules/costRules";
import { makeCostEntry } from "@/test/factories";

describe("calculateTotals", () => {
  it("separa fixos e variaveis e soma o total", () => {
    const entries: CostEntry[] = [
      makeCostEntry({ amount: 1000, costType: "fixo" }),
      makeCostEntry({ amount: 250.5, costType: "variavel" }),
      makeCostEntry({ amount: 0.1, costType: "variavel" }),
      makeCostEntry({ amount: 0.2, costType: "fixo" }),
    ];

    expect(calculateTotals(entries)).toEqual({
      fixedTotal: 1000.2,
      variableTotal: 250.6,
      total: 1250.8,
    });
  });

  it("retorna zero quando nao ha lancamentos", () => {
    expect(calculateTotals([])).toEqual({
      fixedTotal: 0,
      variableTotal: 0,
      total: 0,
    });
  });
});

describe("filterByCostType", () => {
  const entries = [
    makeCostEntry({ id: "a", costType: "fixo" }),
    makeCostEntry({ id: "b", costType: "variavel" }),
  ];

  it("retorna todos com o filtro 'todos' sem mutar a lista", () => {
    const result = filterByCostType(entries, "todos");
    expect(result.map((entry) => entry.id)).toEqual(["a", "b"]);
    expect(result).not.toBe(entries);
  });

  it("filtra por frente", () => {
    expect(filterByCostType(entries, "variavel").map((e) => e.id)).toEqual([
      "b",
    ]);
  });
});

describe("sortByCreatedAtDesc", () => {
  it("ordena do mais recente para o mais antigo", () => {
    const sorted = sortByCreatedAtDesc([
      makeCostEntry({ id: "old", createdAt: new Date("2026-01-01") }),
      makeCostEntry({ id: "new", createdAt: new Date("2026-03-01") }),
      makeCostEntry({ id: "mid", createdAt: new Date("2026-02-01") }),
    ]);

    expect(sorted.map((entry) => entry.id)).toEqual(["new", "mid", "old"]);
  });
});

describe("normalizeInstallments", () => {
  it("forca 1 parcela para custo variavel", () => {
    expect(normalizeInstallments("variavel", 12)).toBe(1);
  });

  it("garante minimo 1, trunca decimais e limita ao maximo", () => {
    expect(normalizeInstallments("fixo", 0)).toBe(1);
    expect(normalizeInstallments("fixo", Number.NaN)).toBe(1);
    expect(normalizeInstallments("fixo", undefined)).toBe(1);
    expect(normalizeInstallments("fixo", 3.9)).toBe(3);
    expect(normalizeInstallments("fixo", 500)).toBe(MAX_INSTALLMENTS);
  });
});

describe("addMonths", () => {
  it("avanca meses mantendo o dia", () => {
    const result = addMonths(new Date(2026, 0, 15, 12), 2);
    expect(result.getFullYear()).toBe(2026);
    expect(result.getMonth()).toBe(2);
    expect(result.getDate()).toBe(15);
  });

  it("usa o ultimo dia valido quando o mes destino e mais curto", () => {
    const result = addMonths(new Date(2026, 0, 31, 12), 1);
    expect(result.getMonth()).toBe(1);
    expect(result.getDate()).toBe(28);
  });

  it("vira o ano corretamente", () => {
    const result = addMonths(new Date(2026, 10, 10, 12), 3);
    expect(result.getFullYear()).toBe(2027);
    expect(result.getMonth()).toBe(1);
  });
});

describe("buildInstallmentPlan", () => {
  const now = new Date(2026, 10, 20, 9);

  it("custo variavel gera uma unica parcela na competencia atual com horario do servidor", () => {
    expect(
      buildInstallmentPlan({ costType: "variavel", installmentsTotal: 5 }, now),
    ).toEqual([
      {
        installmentIndex: 0,
        competenceYear: 2026,
        competenceMonth: 11,
        createdAt: null,
      },
    ]);
  });

  it("custo fixo parcelado gera uma parcela por mes atravessando o ano", () => {
    const plan = buildInstallmentPlan(
      { costType: "fixo", installmentsTotal: 3 },
      now,
    );

    expect(
      plan.map((item) => [item.competenceMonth, item.competenceYear]),
    ).toEqual([
      [11, 2026],
      [12, 2026],
      [1, 2027],
    ]);
    expect(plan.every((item) => item.createdAt === null)).toBe(true);
  });

  it("usa a data manual como base e replica a data por parcela", () => {
    const manual = new Date(2026, 4, 10, 12);
    const plan = buildInstallmentPlan(
      { costType: "fixo", installmentsTotal: 2, createdAtManual: manual },
      now,
    );

    expect(plan[0].competenceMonth).toBe(5);
    expect(plan[1].competenceMonth).toBe(6);
    expect(plan[1].createdAt?.getMonth()).toBe(5);
  });
});

describe("validateCostForm", () => {
  const valid = {
    accountName: "Aluguel",
    amount: 100,
    costType: "fixo" as const,
    installmentsTotal: 1,
  };

  it("aceita valores validos", () => {
    expect(validateCostForm(valid)).toEqual({ ok: true });
  });

  it("exige conta preenchida", () => {
    expect(validateCostForm({ ...valid, accountName: "   " })).toEqual({
      ok: false,
      message: "Informe o nome da conta.",
    });
  });

  it("bloqueia valor zero, negativo ou invalido", () => {
    for (const amount of [0, -5, Number.NaN]) {
      expect(validateCostForm({ ...valid, amount }).ok).toBe(false);
    }
  });

  it("valida parcelas apenas para custo fixo", () => {
    expect(validateCostForm({ ...valid, installmentsTotal: 0 }).ok).toBe(false);
    expect(validateCostForm({ ...valid, installmentsTotal: 1.5 }).ok).toBe(
      false,
    );
    expect(
      validateCostForm({
        ...valid,
        installmentsTotal: MAX_INSTALLMENTS + 1,
      }).ok,
    ).toBe(false);
    expect(
      validateCostForm({ ...valid, costType: "variavel", installmentsTotal: 0 })
        .ok,
    ).toBe(true);
  });
});

describe("paginate", () => {
  const items = Array.from({ length: 23 }, (_, index) => index);

  it("retorna a fatia da pagina e o total de paginas", () => {
    expect(paginate(items, 3, 10)).toEqual({
      items: [20, 21, 22],
      currentPage: 3,
      totalPages: 3,
    });
  });

  it("limita a pagina aos extremos validos", () => {
    expect(paginate(items, 99, 10).currentPage).toBe(3);
    expect(paginate(items, 0, 10).currentPage).toBe(1);
    expect(paginate([], 1, 10)).toEqual({
      items: [],
      currentPage: 1,
      totalPages: 1,
    });
  });
});
