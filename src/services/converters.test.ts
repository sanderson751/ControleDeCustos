import {
  toCostEntry,
  toDate,
  toRecurringBudget,
  toUserProfile,
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
