import {
  defaultDateForCompetence,
  formatCompetenceLong,
  getCurrentCompetence,
  isFirstCompetence,
  isLastCompetence,
  isSameCompetence,
  MAX_COMPETENCE,
  MIN_COMPETENCE,
  parseCompetenceParam,
  shiftCompetence,
  toCompetenceParam,
} from "@/domain/rules/competence";

describe("competence", () => {
  it("obtem a competencia atual", () => {
    expect(getCurrentCompetence(new Date(2026, 10, 26))).toEqual({
      year: 2026,
      month: 11,
    });
  });

  it("converte de/para o parametro de URL", () => {
    expect(parseCompetenceParam("2026-03")).toEqual({ year: 2026, month: 3 });
    expect(toCompetenceParam({ year: 2026, month: 3 })).toBe("2026-03");
  });

  it("rejeita parametros invalidos", () => {
    for (const value of [null, "", "2026-13", "2026-00", "26-01", "1999-05", "abc"]) {
      expect(parseCompetenceParam(value)).toBeNull();
    }
  });

  it("navega entre meses virando o ano", () => {
    expect(shiftCompetence({ year: 2026, month: 1 }, -1)).toEqual({
      year: 2025,
      month: 12,
    });
    expect(shiftCompetence({ year: 2026, month: 12 }, 1)).toEqual({
      year: 2027,
      month: 1,
    });
    expect(shiftCompetence({ year: 2026, month: 5 }, -14)).toEqual({
      year: 2025,
      month: 3,
    });
  });

  it("compara e formata por extenso", () => {
    expect(
      isSameCompetence({ year: 2026, month: 3 }, { year: 2026, month: 3 }),
    ).toBe(true);
    expect(
      isSameCompetence({ year: 2026, month: 3 }, { year: 2025, month: 3 }),
    ).toBe(false);
    expect(formatCompetenceLong({ year: 2026, month: 3 })).toBe(
      "março de 2026",
    );
  });

  describe("defaultDateForCompetence", () => {
    const now = new Date(2026, 10, 30, 9);

    it("usa hoje no mes atual", () => {
      expect(defaultDateForCompetence({ year: 2026, month: 11 }, now)).toBe(now);
    });

    it("usa o mesmo dia limitado ao fim do mes em outra competencia", () => {
      const date = defaultDateForCompetence({ year: 2026, month: 2 }, now);
      expect(date.getMonth()).toBe(1);
      expect(date.getDate()).toBe(28);
      expect(date.getHours()).toBe(12);
    });
  });
});

describe("limites da faixa de competencia", () => {
  it("identifica a primeira e a ultima competencia suportadas", () => {
    expect(isFirstCompetence(MIN_COMPETENCE)).toBe(true);
    expect(isLastCompetence(MAX_COMPETENCE)).toBe(true);
    expect(isFirstCompetence({ year: 2026, month: 1 })).toBe(false);
    expect(parseCompetenceParam(toCompetenceParam(MIN_COMPETENCE))).toEqual(
      MIN_COMPETENCE,
    );
  });
});
