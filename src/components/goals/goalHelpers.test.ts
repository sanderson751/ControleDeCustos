import {
  emptyContributionForm,
  emptyGoalForm,
  goalFormFrom,
  toContributionValues,
  toGoalValues,
} from "@/components/goals/goalFormState";
import { goalGuidance } from "@/components/goals/goalPresentation";
import { savedInCompetence, summarizeGoal } from "@/domain/rules/savingsGoalRules";

const NOW = new Date(2026, 10, 27, 12);

describe("goalFormState", () => {
  it("formulario vazio sem prazo, sugerindo o mesmo mes do ano seguinte", () => {
    expect(emptyGoalForm(NOW)).toEqual({
      name: "",
      target: "",
      hasDeadline: false,
      deadlineMonth: "11",
      deadlineYear: "2027",
    });
  });

  it("ida e volta da meta com e sem prazo", () => {
    const goal = { id: "g1", name: "Viagem", targetAmount: 6000, deadline: { year: 2027, month: 4 } };
    const state = goalFormFrom(goal, NOW);

    expect(state).toMatchObject({ name: "Viagem", target: "R$ 6.000,00", hasDeadline: true });
    expect(toGoalValues(state)).toEqual({
      name: "Viagem",
      targetAmount: 6000,
      deadline: { year: 2027, month: 4 },
    });
    expect(toGoalValues({ ...state, hasDeadline: false }).deadline).toBeNull();
  });

  it("data da movimentacao vira meio-dia local (nao muda de dia/mes por fuso)", () => {
    const values = toContributionValues({ ...emptyContributionForm("retirada", NOW), amount: "R$ 10,00", date: "2026-10-31" });

    expect(values).toMatchObject({ kind: "retirada", amount: 10 });
    expect(values.date).toEqual(new Date(2026, 9, 31, 12));
    expect(
      savedInCompetence([{ id: "c", goalId: "g", amount: 10, date: values.date!, note: "" }], { year: 2026, month: 10 }),
    ).toBe(10);
    expect(toContributionValues({ ...emptyContributionForm(), date: "" }).date).toBeNull();
  });
});

describe("goalGuidance", () => {
  const goal = { id: "g1", name: "Viagem", targetAmount: 6000, deadline: { year: 2027, month: 4 } };
  const move = (amount: number) => ({ id: "c", goalId: "g1", amount, date: NOW, note: "" });

  it.each([
    [goal, [move(1200)], "Guardar R$ 800,00 por mês até abr/2027 (6 meses)."],
    [goal, [move(6000)], "Meta atingida!"],
    [{ ...goal, deadline: { year: 2026, month: 10 } }, [move(3000)], "Prazo vencido em out/2026: faltam R$ 3.000,00."],
    [{ ...goal, deadline: null }, [], "Sem prazo definido."],
    [{ ...goal, deadline: { year: 2026, month: 11 } }, [], "Guardar R$ 6.000,00 por mês até nov/2026 (1 mês)."],
  ])("%#", (target, moves, expected) => {
    expect(goalGuidance(summarizeGoal(target, moves, NOW))).toBe(expected);
  });
});
