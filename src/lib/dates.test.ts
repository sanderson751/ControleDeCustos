import {
  formatCompetence,
  formatDateBR,
  fromInputDateAtNoon,
  getCurrentMonthRange,
  parseDateRange,
  toInputDate,
} from "@/lib/dates";

describe("dates", () => {
  it("converte Date para o formato do input date", () => {
    expect(toInputDate(new Date(2026, 1, 5))).toBe("2026-02-05");
  });

  it("converte input date para meio-dia local", () => {
    const date = fromInputDateAtNoon("2026-03-15");
    expect(date.getDate()).toBe(15);
    expect(date.getHours()).toBe(12);
  });

  it("formata data e competencia", () => {
    expect(formatDateBR(new Date(2026, 0, 9))).toBe("09/01/2026");
    expect(formatCompetence(4, 2026)).toBe("04/2026");
  });

  it("intervalo padrao vai do primeiro dia do mes ate hoje", () => {
    expect(getCurrentMonthRange(new Date(2026, 10, 26))).toEqual({
      startDate: "2026-11-01",
      endDate: "2026-11-26",
    });
  });

  describe("parseDateRange", () => {
    it("retorna inicio e fim do dia", () => {
      const range = parseDateRange("2026-11-01", "2026-11-30");
      expect(range?.startDate.getHours()).toBe(0);
      expect(range?.endDate.getHours()).toBe(23);
      expect(range?.endDate.getMilliseconds()).toBe(999);
    });

    it("rejeita vazio, invalido ou invertido", () => {
      expect(parseDateRange("", "2026-11-01")).toBeNull();
      expect(parseDateRange("data", "2026-11-01")).toBeNull();
      expect(parseDateRange("2026-12-01", "2026-11-01")).toBeNull();
    });
  });
});
