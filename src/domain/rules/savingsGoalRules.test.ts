import type {
  ContributionFormValues,
  GoalContribution,
  SavingsGoal,
} from "@/domain/entities/savingsGoal";
import {
  validateContributionDeletion,
  homeGoalHighlights,
  savedFor,
  savedInCompetence,
  signedAmount,
  sortGoalSummaries,
  summarizeGoal,
  validateContribution,
  validateGoalForm,
} from "@/domain/rules/savingsGoalRules";

const NOW = new Date(2026, 10, 27, 12);

const goal = (overrides: Partial<SavingsGoal> = {}): SavingsGoal => ({
  id: "g1",
  name: "Viagem",
  targetAmount: 6000,
  deadline: { year: 2027, month: 4 },
  ...overrides,
});

let seq = 0;
const move = (amount: number, date = new Date(2026, 10, 10, 12), goalId = "g1"): GoalContribution => ({
  id: `c${(seq += 1)}`,
  goalId,
  amount,
  date,
  note: "",
});

describe("validateGoalForm", () => {
  const values = { name: "  Reserva   de emergência ", targetAmount: 10000, deadline: null };

  it("normaliza o nome e aceita sem prazo", () => {
    expect(validateGoalForm(values, [], NOW)).toEqual({
      ok: true,
      values: { ...values, name: "Reserva de emergência" },
    });
  });

  it.each([
    [{ name: " " }, "Informe o nome da meta."],
    [{ name: "x".repeat(61) }, "O nome pode ter no máximo 60 caracteres."],
    [{ targetAmount: Number.NaN }, "Informe um valor-alvo maior que zero."],
    [{ targetAmount: 0 }, "Informe um valor-alvo maior que zero."],
    [{ targetAmount: 1_000_000_001 }, "O valor-alvo informado é muito alto."],
    [{ deadline: { year: 2026, month: 10 } }, "O prazo deve ser a partir do mês atual."],
  ])("recusa %o", (overrides, message) => {
    expect(validateGoalForm({ ...values, ...overrides }, [], NOW)).toEqual({ ok: false, message });
  });

  it("aceita prazo no mes atual; nome unico sem acento/caixa (exceto a propria meta)", () => {
    expect(validateGoalForm({ ...values, deadline: { year: 2026, month: 11 } }, [], NOW).ok).toBe(true);
    expect(validateGoalForm({ ...values, name: "VIAGEM" }, [goal()], NOW)).toEqual({
      ok: false,
      message: 'Já existe uma meta chamada "Viagem".',
    });
    expect(
      validateGoalForm({ ...values, name: "viagem" }, [goal()], NOW, { editingId: "g1" }).ok,
    ).toBe(true);
  });

  it("edicao mantem o prazo salvo mesmo vencido", () => {
    const expired = { year: 2026, month: 6 };
    expect(
      validateGoalForm({ ...values, deadline: expired }, [], NOW, { originalDeadline: expired }).ok,
    ).toBe(true);
  });
});

describe("validateContribution", () => {
  const values = (overrides: Partial<ContributionFormValues> = {}): ContributionFormValues => ({
    kind: "deposito",
    amount: 100,
    date: new Date(2026, 10, 27, 12),
    note: "  salário ",
    ...overrides,
  });

  it("aceita deposito e apara a observacao", () => {
    expect(validateContribution(values(), 0, NOW)).toEqual({
      ok: true,
      values: { ...values(), note: "salário" },
    });
  });

  it.each([
    [{ amount: 0 }, "Informe um valor maior que zero."],
    [{ amount: 1_000_000_001 }, "O valor informado é muito alto."],
    [{ date: null }, "Informe uma data válida, até hoje."],
    [{ date: new Date(2026, 10, 28, 9) }, "Informe uma data válida, até hoje."],
    [{ date: new Date(1999, 0, 1) }, "Informe uma data válida, até hoje."],
    [{ note: "x".repeat(201) }, "A observação pode ter no máximo 200 caracteres."],
  ])("recusa %o", (overrides, message) => {
    expect(validateContribution(values(overrides), 0, NOW)).toEqual({ ok: false, message });
  });

  it("retirada nao passa do guardado (cenario 2), em centavos", () => {
    expect(validateContribution(values({ kind: "retirada", amount: 1500 }), 1200, NOW)).toEqual({
      ok: false,
      message: "A retirada não pode ser maior que o valor guardado (R$ 1.200,00).",
    });
    expect(validateContribution(values({ kind: "retirada", amount: 0.3 }), 0.1 + 0.2, NOW).ok).toBe(true);
  });

  it("valor com sinal", () => {
    expect(signedAmount({ kind: "deposito", amount: 10 })).toBe(10);
    expect(signedAmount({ kind: "retirada", amount: 10 })).toBe(-10);
  });
});

describe("summarizeGoal", () => {
  it("cenario 1: 20%, falta R$ 4.800 e R$ 800 por mes em 6 meses", () => {
    expect(summarizeGoal(goal(), [move(1200)], NOW)).toEqual({
      goal: goal(),
      saved: 1200,
      remaining: 4800,
      percent: 20,
      status: "em-andamento",
      monthsLeft: 6,
      monthlyNeeded: 800,
    });
  });

  it("soma depositos e retiradas so da propria meta, sem erro de ponto flutuante", () => {
    const moves = [move(0.1), move(0.2), move(-0.05), move(999, undefined, "outra")];
    expect(savedFor("g1", moves)).toBe(0.25);
  });

  it("cenario 3: concluida com 100% e sem valor mensal", () => {
    const summary = summarizeGoal(goal(), [move(6500)], NOW);
    expect(summary).toMatchObject({ status: "concluida", percent: 100, remaining: 0, monthlyNeeded: null });
  });

  it("cenario 4: atrasada sugere o total que falta", () => {
    const summary = summarizeGoal(goal({ deadline: { year: 2026, month: 10 } }), [move(3000)], NOW);
    expect(summary).toMatchObject({ status: "atrasada", monthsLeft: null, monthlyNeeded: 3000 });
  });

  it("sem prazo nao sugere valor mensal; arredonda o mensal para cima em centavos", () => {
    expect(summarizeGoal(goal({ deadline: null }), [], NOW).monthlyNeeded).toBeNull();
    expect(summarizeGoal(goal({ targetAmount: 100, deadline: { year: 2027, month: 1 } }), [], NOW)).toMatchObject({
      monthsLeft: 3,
      monthlyNeeded: 33.34,
    });
  });

  it("regressao: saldo negativo e exibido como zero e falta nunca passa do alvo", () => {
    const summary = summarizeGoal(goal(), [move(-1000)], NOW);
    expect(summary).toMatchObject({ saved: 0, remaining: 6000, percent: 0 });
  });

  it("alvo invalido (legado) nao gera NaN nem conclui a meta", () => {
    expect(summarizeGoal(goal({ targetAmount: 0 }), [], NOW)).toMatchObject({
      percent: 0,
      status: "em-andamento",
    });
  });

  it("virada de ano e prazo no mes atual", () => {
    expect(
      summarizeGoal(goal({ targetAmount: 100, deadline: { year: 2027, month: 1 } }), [], new Date(2026, 11, 15)),
    ).toMatchObject({ monthsLeft: 2, monthlyNeeded: 50 });
    expect(
      summarizeGoal(goal({ targetAmount: 100, deadline: { year: 2026, month: 11 } }), [move(40)], NOW),
    ).toMatchObject({ status: "em-andamento", monthsLeft: 1, monthlyNeeded: 60 });
  });

  it("percentual arredonda para baixo e nunca negativo", () => {
    expect(summarizeGoal(goal({ targetAmount: 3 }), [move(1.999)], NOW).percent).toBe(66);
  });
});

describe("resumos", () => {
  it("guardado no mes considera depositos - retiradas na competencia (cenario 5)", () => {
    const moves = [
      move(500, new Date(2026, 10, 3)),
      move(-100, new Date(2026, 10, 20)),
      move(300, new Date(2026, 9, 30)),
      move(50, new Date(2026, 10, 5), "excluida"),
    ];
    expect(savedInCompetence(moves, { year: 2026, month: 11 }, new Set(["g1"]))).toBe(400);
    expect(savedInCompetence(moves, { year: 2026, month: 11 })).toBe(450);
  });

  it("ordena atrasadas, em andamento por prazo (sem prazo por ultimo) e concluidas; Inicio mostra ate 3", () => {
    const summaries = [
      summarizeGoal(goal({ id: "a", name: "Sem prazo", deadline: null }), [], NOW),
      summarizeGoal(goal({ id: "b", name: "Concluida", targetAmount: 1 }), [move(1, undefined, "b")], NOW),
      summarizeGoal(goal({ id: "c", name: "Longe", deadline: { year: 2028, month: 1 } }), [], NOW),
      summarizeGoal(goal({ id: "d", name: "Perto", deadline: { year: 2026, month: 12 } }), [], NOW),
      summarizeGoal(goal({ id: "e", name: "Atrasada", deadline: { year: 2026, month: 1 } }), [], NOW),
    ];

    expect(sortGoalSummaries(summaries).map((item) => item.goal.id)).toEqual(["e", "d", "c", "a", "b"]);
    expect(homeGoalHighlights(summaries).map((item) => item.goal.id)).toEqual(["e", "d", "c"]);
  });
});

describe("validateContributionDeletion", () => {
  const moves = [move(1000), move(-800)];

  it("retirada sempre pode ser excluida", () => {
    expect(validateContributionDeletion(moves[1], moves)).toEqual({ ok: true });
  });

  it("deposito so se o saldo nao ficar negativo", () => {
    expect(validateContributionDeletion(moves[0], moves).ok).toBe(false);
    // 1000 + 500 - 500 = 1000: sem o deposito de 1000 o saldo fica em 0 (permitido).
    expect(validateContributionDeletion(moves[0], [moves[0], move(500), move(-500)]).ok).toBe(true);
  });
});
