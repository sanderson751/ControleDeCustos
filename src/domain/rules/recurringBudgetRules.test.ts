import type { RecurringBudget } from "@/domain/entities/budget";
import type { Competence, CostCategory } from "@/domain/entities/cost";
import {
  buildMonthBudgetState,
  defaultBudgetMode,
  futureRecurringFor,
  hasMonthBudgetChanges,
  planMonthBudgetChanges,
  resolveEffectiveBudgets,
  resolveRecurringFor,
} from "@/domain/rules/recurringBudgetRules";
import { makeBudget } from "@/test/factories";

function recurring(
  category: CostCategory,
  year: number,
  month: number,
  limit: number | null,
): RecurringBudget {
  return {
    id: `${year}-${String(month).padStart(2, "0")}-${category}`,
    category,
    year,
    month,
    limit,
  };
}

const at = (year: number, month: number): Competence => ({ year, month });

// Historico do cenario 2/4: 1200 desde 03/2026, 1500 desde 06/2026, encerrada em 09/2026.
const foodHistory = [
  recurring("alimentacao", 2026, 6, 1500),
  recurring("alimentacao", 2026, 3, 1200),
  recurring("alimentacao", 2026, 9, null),
];

describe("resolveRecurringFor", () => {
  it("usa a vigencia mais recente iniciada ate o mes e respeita o encerramento", () => {
    expect(resolveRecurringFor(foodHistory, "alimentacao", at(2026, 2))).toBeNull();
    expect(resolveRecurringFor(foodHistory, "alimentacao", at(2026, 3))?.limit).toBe(1200);
    expect(resolveRecurringFor(foodHistory, "alimentacao", at(2026, 5))?.limit).toBe(1200);
    expect(resolveRecurringFor(foodHistory, "alimentacao", at(2026, 6))?.limit).toBe(1500);
    expect(resolveRecurringFor(foodHistory, "alimentacao", at(2026, 8))?.limit).toBe(1500);
    expect(resolveRecurringFor(foodHistory, "alimentacao", at(2026, 9))).toBeNull();
    expect(resolveRecurringFor(foodHistory, "alimentacao", at(2027, 1))).toBeNull();
    expect(resolveRecurringFor(foodHistory, "lazer", at(2026, 7))).toBeNull();
  });

  it("atravessa a virada de ano", () => {
    const items = [recurring("lazer", 2025, 11, 300)];
    expect(resolveRecurringFor(items, "lazer", at(2026, 1))?.limit).toBe(300);
    expect(resolveRecurringFor(items, "lazer", at(2025, 10))).toBeNull();
  });
});

describe("resolveEffectiveBudgets", () => {
  it("excecao mensal prevalece e mantem a recorrencia como referencia", () => {
    const effective = resolveEffectiveBudgets(
      [makeBudget("alimentacao", 2000, at(2026, 7))],
      foodHistory,
      at(2026, 7),
    );

    expect(effective).toEqual([
      expect.objectContaining({
        category: "alimentacao",
        limit: 2000,
        source: "mensal",
        recurringLimit: 1500,
        recurringFrom: at(2026, 6),
      }),
    ]);
  });

  it("usa a recorrencia quando nao ha excecao e omite categorias sem orcamento", () => {
    const effective = resolveEffectiveBudgets([], foodHistory, at(2026, 8));

    expect(effective).toEqual([
      {
        id: "2026-08-alimentacao",
        category: "alimentacao",
        year: 2026,
        month: 8,
        limit: 1500,
        source: "recorrente",
        recurringFrom: at(2026, 6),
        recurringLimit: 1500,
      },
    ]);
    expect(resolveEffectiveBudgets([], foodHistory, at(2026, 10))).toEqual([]);
  });
});

describe("defaultBudgetMode", () => {
  it("e recorrente quando o limite efetivo vem da recorrencia", () => {
    const month = at(2026, 7);
    const withRecurring = buildMonthBudgetState([], foodHistory, month);
    const withException = buildMonthBudgetState(
      [makeBudget("alimentacao", 2000, month)],
      foodHistory,
      month,
    );

    expect(defaultBudgetMode("alimentacao", withRecurring)).toBe("recorrente");
    expect(defaultBudgetMode("alimentacao", withException)).toBe("mensal");
    expect(defaultBudgetMode("lazer", withRecurring)).toBe("mensal");
  });
});

describe("planMonthBudgetChanges", () => {
  const march = at(2026, 3);
  const empty = buildMonthBudgetState([], [], march);
  const NO_MONTHLY = { creates: [], updates: [], removals: [] };

  it("cenario 1: cria vigencia recorrente no mes", () => {
    const plan = planMonthBudgetChanges(empty, march, {
      alimentacao: { value: 1200, mode: "recorrente" },
    });

    expect(plan).toEqual({
      monthly: NO_MONTHLY,
      recurring: [
        { category: "alimentacao", limit: 1200, operation: "create", start: march },
      ],
      ignored: [],
    });
  });

  it("cenario 2: alterar o valor cria nova vigencia; mesmo valor nao grava nada", () => {
    const june = at(2026, 6);
    const state = buildMonthBudgetState([], [recurring("alimentacao", 2026, 3, 1200)], june);

    expect(
      planMonthBudgetChanges(state, june, {
        alimentacao: { value: 1500, mode: "recorrente" },
      }).recurring,
    ).toEqual([
      { category: "alimentacao", limit: 1500, operation: "create", start: june },
    ]);

    expect(
      hasMonthBudgetChanges(
        planMonthBudgetChanges(state, june, {
          alimentacao: { value: 1200, mode: "recorrente" },
        }),
      ),
    ).toBe(false);
  });

  it("atualiza a vigencia quando ela ja comeca no proprio mes", () => {
    const state = buildMonthBudgetState([], [recurring("lazer", 2026, 3, 300)], march);

    expect(
      planMonthBudgetChanges(state, march, {
        lazer: { value: 350, mode: "recorrente" },
      }).recurring,
    ).toEqual([{ category: "lazer", limit: 350, operation: "update", start: march }]);
  });

  it("'este mes em diante' substitui vigencias futuras da categoria", () => {
    const june = at(2026, 6);
    const state = buildMonthBudgetState([], [recurring("lazer", 2026, 9, 500)], june);

    expect(
      planMonthBudgetChanges(state, june, {
        lazer: { value: 300, mode: "recorrente" },
      }).recurring,
    ).toEqual([
      { category: "lazer", limit: 300, operation: "create", start: june },
      { category: "lazer", limit: 500, operation: "delete", start: at(2026, 9) },
    ]);

    // Mesmo valor da recorrencia ativa, mas com alteracao futura: so remove a futura.
    const withActive = buildMonthBudgetState(
      [],
      [recurring("lazer", 2026, 1, 300), recurring("lazer", 2026, 9, 500)],
      june,
    );
    expect(
      planMonthBudgetChanges(withActive, june, {
        lazer: { value: 300, mode: "recorrente" },
      }).recurring,
    ).toEqual([
      { category: "lazer", limit: 500, operation: "delete", start: at(2026, 9) },
    ]);
  });

  it("cenario 3: excecao 'so este mes' sobre recorrencia, inclusive fixando o mesmo valor", () => {
    const july = at(2026, 7);
    const state = buildMonthBudgetState([], foodHistory, july);

    expect(
      planMonthBudgetChanges(state, july, {
        alimentacao: { value: 2000, mode: "mensal" },
      }),
    ).toEqual({
      monthly: { creates: [{ category: "alimentacao", limit: 2000 }], updates: [], removals: [] },
      recurring: [],
      ignored: [],
    });

    expect(
      planMonthBudgetChanges(state, july, {
        alimentacao: { value: 1500, mode: "mensal" },
      }).monthly.creates,
    ).toEqual([{ category: "alimentacao", limit: 1500 }]);
  });

  it("'so este mes' vazio sobre recorrencia ativa e ignorado e reportado", () => {
    const july = at(2026, 7);
    const plan = planMonthBudgetChanges(buildMonthBudgetState([], foodHistory, july), july, {
      alimentacao: { value: null, mode: "mensal" },
    });

    expect(plan.ignored).toEqual(["alimentacao"]);
    expect(hasMonthBudgetChanges(plan)).toBe(false);
  });

  it("cenario 4: apagar em modo recorrente encerra a vigencia; sem recorrencia ativa nao grava", () => {
    const sept = at(2026, 9);
    const active = buildMonthBudgetState([], [recurring("alimentacao", 2026, 3, 1200)], sept);

    expect(
      planMonthBudgetChanges(active, sept, {
        alimentacao: { value: null, mode: "recorrente" },
      }).recurring,
    ).toEqual([
      { category: "alimentacao", limit: null, operation: "create", start: sept },
    ]);

    expect(
      hasMonthBudgetChanges(
        planMonthBudgetChanges(empty, march, {
          alimentacao: { value: null, mode: "recorrente" },
        }),
      ),
    ).toBe(false);
  });

  it("passar de excecao para recorrente remove a excecao do mes", () => {
    const july = at(2026, 7);
    const state = buildMonthBudgetState(
      [makeBudget("alimentacao", 2000, july)],
      foodHistory,
      july,
    );

    expect(
      planMonthBudgetChanges(state, july, {
        alimentacao: { value: 1500, mode: "recorrente" },
      }),
    ).toEqual({
      monthly: { creates: [], updates: [], removals: ["alimentacao"] },
      // O encerramento agendado para 09/2026 e substituido ("este mes em diante").
      recurring: [
        { category: "alimentacao", limit: null, operation: "delete", start: at(2026, 9) },
      ],
      ignored: [],
    });
  });

  it("modo mensal: atualiza e remove excecoes como antes", () => {
    const state = buildMonthBudgetState(
      [makeBudget("moradia", 2000, march), makeBudget("saude", 500, march)],
      [],
      march,
    );

    expect(
      planMonthBudgetChanges(state, march, {
        moradia: { value: 2200, mode: "mensal" },
        saude: { value: null, mode: "mensal" },
        lazer: { value: null, mode: "mensal" },
      }),
    ).toEqual({
      monthly: { creates: [], updates: [{ category: "moradia", limit: 2200 }], removals: ["saude"] },
      recurring: [],
      ignored: [],
    });
  });
});

describe("futureRecurringFor", () => {
  it("lista somente vigencias da categoria iniciadas depois do mes, em ordem", () => {
    expect(
      futureRecurringFor(foodHistory, "alimentacao", at(2026, 4)).map((item) => item.month),
    ).toEqual([6, 9]);
    expect(futureRecurringFor(foodHistory, "alimentacao", at(2026, 9))).toEqual([]);
  });
});
