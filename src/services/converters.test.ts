import {
  toCostEntry,
  toDate,
  toRecurringBudget,
  toUserProfile,
  toRecurringCost,
} from "@/services/converters";

describe("converters", () => {
  it("toDate aceita Timestamp, Date e usa fallback para pendentes", () => {
    const date = new Date(2026, 0, 1);
    const fallback = new Date(2000, 0, 1);

    expect(toDate({ toDate: () => date }, fallback)).toBe(date);
    expect(toDate(date, fallback)).toBe(date);
    expect(toDate(null, fallback)).toBe(fallback);
  });

  it("toCostEntry aplica valores padrao seguros", () => {
    const entry = toCostEntry("x", { amount: "12.5", costType: "outro" });

    expect(entry).toMatchObject({
      id: "x",
      accountName: "",
      amount: 12.5,
      costType: "variavel",
      installmentsTotal: 1,
    });
  });

  it("toUserProfile normaliza papel desconhecido para standard", () => {
    expect(toUserProfile("u1", { role: "root" })).toMatchObject({
      userId: "u1",
      role: "standard",
      email: "",
      photoURL: "",
    });
  });
});

describe("toRecurringBudget", () => {
  it("aceita limite positivo e trata ausente/invalido como encerramento", () => {
    expect(
      toRecurringBudget("2026-01-lazer", { category: "lazer", year: 2026, month: 1, limit: 300 }),
    ).toEqual({ id: "2026-01-lazer", category: "lazer", year: 2026, month: 1, limit: 300 });
    expect(toRecurringBudget("x", { category: "lazer", year: 2026, month: 1, limit: null }).limit).toBeNull();
    expect(toRecurringBudget("x", { category: "lazer", year: 2026, month: 1, limit: -5 }).limit).toBeNull();
  });
});

describe("descricao no lancamento", () => {
  it("le descricao existente e trata ausente (legado) como vazia", () => {
    expect(toCostEntry("x", { description: "nota" }).description).toBe("nota");
    expect(toCostEntry("x", {}).description).toBe("");
    expect(toCostEntry("x", { description: 42 }).description).toBe("");
  });
});

describe("recorrencias", () => {
  it("toRecurringCost converte cursor, inicio e padroes seguros", () => {
    expect(
      toRecurringCost("r1", {
        accountName: "Aluguel",
        amount: 2000,
        costType: "variavel",
        category: "moradia",
        dayOfMonth: 5,
        startYear: 2026,
        startMonth: 9,
        active: false,
        lastGeneratedYear: 2026,
        lastGeneratedMonth: 11,
      }),
    ).toEqual({
      id: "r1",
      accountName: "Aluguel",
      amount: 2000,
      costType: "variavel",
      category: "moradia",
      description: "",
      dayOfMonth: 5,
      start: { year: 2026, month: 9 },
      active: false,
      lastGenerated: { year: 2026, month: 11 },
    });

    expect(toRecurringCost("r2", { startYear: 2026, startMonth: 1 })).toMatchObject({
      costType: "fixo",
      category: "outros",
      active: true,
      lastGenerated: null,
    });
  });

  it("toCostEntry le recurringId somente quando presente", () => {
    expect(toCostEntry("rec-r1-2026-11", { recurringId: "r1" }).recurringId).toBe("r1");
    expect(toCostEntry("c1", {})).not.toHaveProperty("recurringId");
  });
});
