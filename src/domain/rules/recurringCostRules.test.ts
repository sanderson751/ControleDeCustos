import type { Competence } from "@/domain/entities/cost";
import type {
  RecurringCost,
  RecurringCostFormValues,
} from "@/domain/entities/recurringCost";
import {
  buildOccurrenceId,
  occurrenceDate,
  pendingCompetences,
  resumeCursor,
  validateRecurringForm,
} from "@/domain/rules/recurringCostRules";

const NOW = new Date(2026, 10, 27, 12);
const NOV: Competence = { year: 2026, month: 11 };

const recurring = (overrides: Partial<RecurringCost> = {}): RecurringCost => ({
  id: "r1",
  accountName: "Aluguel",
  amount: 2000,
  costType: "fixo",
  category: "moradia",
  description: "",
  dayOfMonth: 5,
  start: { year: 2026, month: 9 },
  active: true,
  lastGenerated: null,
  ...overrides,
});

const form = (overrides: Partial<RecurringCostFormValues> = {}): RecurringCostFormValues => ({
  accountName: " Aluguel ",
  amount: 2000,
  costType: "fixo",
  category: "moradia",
  description: " apto 12 ",
  dayOfMonth: 5,
  start: { year: 2026, month: 9 },
  ...overrides,
});

describe("validateRecurringForm", () => {
  it("aceita e apara os textos", () => {
    expect(validateRecurringForm(form(), NOW)).toEqual({
      ok: true,
      values: { ...form(), accountName: "Aluguel", description: "apto 12" },
    });
  });

  it.each([
    [{ accountName: "  " }, "Informe o nome da conta."],
    [{ accountName: "a".repeat(201) }, "O nome da conta pode ter no máximo 200 caracteres."],
    [{ amount: Number.NaN }, "Informe um valor maior que zero."],
    [{ amount: 0 }, "Informe um valor maior que zero."],
    [{ amount: 1_000_000_001 }, "O valor informado é muito alto."],
    [{ category: "" }, "Selecione uma categoria."],
    [{ dayOfMonth: 0 }, "O dia do mês deve estar entre 1 e 28."],
    [{ dayOfMonth: 29 }, "O dia do mês deve estar entre 1 e 28."],
    [{ dayOfMonth: 2.5 }, "O dia do mês deve estar entre 1 e 28."],
    [{ start: { year: 2025, month: 10 } }, "O início deve estar entre 12 meses atrás e 12 meses à frente."],
    [{ start: { year: 2027, month: 12 } }, "O início deve estar entre 12 meses atrás e 12 meses à frente."],
    [{ start: { year: Number.NaN, month: Number.NaN } }, "O início deve estar entre 12 meses atrás e 12 meses à frente."],
    [{ description: "x".repeat(501) }, "A descrição pode ter no máximo 500 caracteres."],
  ])("recusa %o", (overrides, message) => {
    expect(validateRecurringForm(form(overrides), NOW)).toEqual({ ok: false, message });
  });

  it("regressao: edicao mantendo o inicio salvo fora da janela continua valida", () => {
    const old = form({ start: { year: 2025, month: 1 } });

    expect(validateRecurringForm(old, NOW).ok).toBe(false);
    expect(
      validateRecurringForm(old, NOW, { originalStart: { year: 2025, month: 1 } }).ok,
    ).toBe(true);
    // Trocar para outro inicio fora da janela continua recusado.
    expect(
      validateRecurringForm(form({ start: { year: 2025, month: 2 } }), NOW, {
        originalStart: { year: 2025, month: 1 },
      }).ok,
    ).toBe(false);
  });

  it("aceita os limites da janela de inicio", () => {
    expect(validateRecurringForm(form({ start: { year: 2025, month: 11 } }), NOW).ok).toBe(true);
    expect(validateRecurringForm(form({ start: { year: 2027, month: 11 } }), NOW).ok).toBe(true);
  });
});

describe("pendingCompetences", () => {
  it("do inicio ate a competencia atual (cenario 1)", () => {
    expect(pendingCompetences(recurring(), NOV)).toEqual([
      { year: 2026, month: 9 },
      { year: 2026, month: 10 },
      { year: 2026, month: 11 },
    ]);
  });

  it("continua apos o cursor e nada quando ja esta em dia", () => {
    expect(
      pendingCompetences(recurring({ lastGenerated: { year: 2026, month: 11 } }), {
        year: 2026,
        month: 12,
      }),
    ).toEqual([{ year: 2026, month: 12 }]);
    expect(pendingCompetences(recurring({ lastGenerated: NOV }), NOV)).toEqual([]);
  });

  it("inicio futuro, pausada: nada", () => {
    expect(pendingCompetences(recurring({ start: { year: 2027, month: 1 } }), NOV)).toEqual([]);
    expect(pendingCompetences(recurring({ active: false }), NOV)).toEqual([]);
  });

  it("vira o ano corretamente", () => {
    expect(
      pendingCompetences(recurring({ lastGenerated: { year: 2026, month: 11 } }), {
        year: 2027,
        month: 2,
      }),
    ).toEqual([
      { year: 2026, month: 12 },
      { year: 2027, month: 1 },
      { year: 2027, month: 2 },
    ]);
  });

  it("limita a recuperacao aos ultimos 24 meses", () => {
    const months = pendingCompetences(
      recurring({ start: { year: 2024, month: 1 }, lastGenerated: { year: 2024, month: 1 } }),
      NOV,
    );
    expect(months).toHaveLength(24);
    expect(months[0]).toEqual({ year: 2024, month: 12 });
    expect(months[23]).toEqual(NOV);
  });
});

describe("ocorrencia", () => {
  it("id deterministico e data no dia configurado ao meio-dia", () => {
    expect(buildOccurrenceId("abc", { year: 2026, month: 3 })).toBe("rec-abc-2026-03");
    expect(occurrenceDate({ year: 2026, month: 2 }, 28)).toEqual(new Date(2026, 1, 28, 12));
  });
});

describe("resumeCursor", () => {
  it("reativar pula os meses pausados", () => {
    expect(
      resumeCursor(recurring({ lastGenerated: { year: 2026, month: 8 } }), NOV),
    ).toEqual({ year: 2026, month: 10 });
  });

  it("nao recua um cursor mais recente nem pula inicio futuro", () => {
    expect(resumeCursor(recurring({ lastGenerated: NOV }), NOV)).toEqual(NOV);
    expect(
      resumeCursor(recurring({ start: { year: 2027, month: 2 }, lastGenerated: null }), NOV),
    ).toBeNull();
  });

  it("sem cursor e inicio passado: comeca no mes atual", () => {
    expect(resumeCursor(recurring(), NOV)).toEqual({ year: 2026, month: 10 });
  });
});
