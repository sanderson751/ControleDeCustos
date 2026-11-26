import { screen, waitFor, within } from "@testing-library/react";
import type { UserRole } from "@/domain/entities/user";
import {
  getCurrentCompetence,
  shiftCompetence,
} from "@/domain/rules/competence";
import { notify } from "@/lib/notify";
import BudgetsPage from "@/pages/BudgetsPage";
import { useSession } from "@/providers/AuthProvider";
import {
  applyBudgetChanges,
  listMonthBudgets,
} from "@/services/budgetService";
import { listMonthCosts } from "@/services/costService";
import { makeBudget, makeCostEntry, makeProfile } from "@/test/factories";
import { renderWithRouter } from "@/test/render";

vi.mock("@/providers/AuthProvider", () => ({ useSession: vi.fn() }));
vi.mock("@/lib/notify", () => ({ notify: vi.fn() }));
vi.mock("@/services/costService", () => ({ listMonthCosts: vi.fn() }));
vi.mock("@/services/budgetService", () => ({
  listMonthBudgets: vi.fn(),
  applyBudgetChanges: vi.fn(),
}));

const mockedList = vi.mocked(listMonthCosts);
const mockedBudgets = vi.mocked(listMonthBudgets);
const mockedApply = vi.mocked(applyBudgetChanges);
const mockedNotify = vi.mocked(notify);

function setup(role: UserRole = "standard", route = "/budgets?mes=2026-03") {
  const profile = makeProfile(role);
  vi.mocked(useSession).mockReturnValue({ profile, firebaseUser: {} as never });
  return {
    profile,
    ...renderWithRouter(<BudgetsPage />, { route, path: "/budgets" }),
  };
}

function rowOf(categoryLabel: string) {
  return screen.getByRole("row", { name: new RegExp(`^${categoryLabel}`) });
}

const MARCH = { year: 2026, month: 3 };

describe("BudgetsPage", () => {
  beforeEach(() => {
    mockedList.mockResolvedValue([
      makeCostEntry({ category: "alimentacao", amount: 980 }),
      makeCostEntry({ category: "lazer", amount: 300 }),
    ]);
    mockedBudgets.mockResolvedValue([
      makeBudget("alimentacao", 1200, MARCH),
      makeBudget("lazer", 250, MARCH),
    ]);
    mockedApply.mockResolvedValue(undefined);
  });

  it("exibe gasto, limite, consumo e status por categoria", async () => {
    setup();

    expect(await screen.findByLabelText("Alimentação")).toHaveValue("R$ 1.200,00");
    expect(mockedBudgets).toHaveBeenCalledWith("uid-standard", MARCH);

    const food = rowOf("Alimentação");
    expect(within(food).getByText("R$ 980,00")).toBeInTheDocument();
    expect(within(food).getByText(/81% · restam R\$ 220,00/)).toBeInTheDocument();
    expect(within(food).getByText("Atenção")).toBeInTheDocument();

    const leisure = rowOf("Lazer");
    expect(within(leisure).getByText(/120% · excedeu R\$ 50,00/)).toBeInTheDocument();
    expect(within(leisure).getByText("Estourado")).toBeInTheDocument();

    expect(within(rowOf("Moradia")).getByText("Sem orçamento")).toBeInTheDocument();
  });

  it("salva criacoes, alteracoes e remocoes da competencia", async () => {
    const { user, profile } = setup();
    await screen.findByLabelText("Alimentação");

    await user.clear(screen.getByLabelText("Alimentação"));
    await user.type(screen.getByLabelText("Alimentação"), "150000");
    await user.clear(screen.getByLabelText("Lazer"));
    await user.type(screen.getByLabelText("Moradia"), "250000");
    await user.click(screen.getByRole("button", { name: "Salvar orçamentos" }));

    await waitFor(() =>
      expect(mockedApply).toHaveBeenCalledWith(profile.userId, MARCH, {
        creates: [{ category: "moradia", limit: 2500 }],
        updates: [{ category: "alimentacao", limit: 1500 }],
        removals: ["lazer"],
      }),
    );
    expect(mockedNotify).toHaveBeenCalledWith(
      "success",
      "Orçamentos salvos com sucesso.",
    );
    expect(mockedBudgets).toHaveBeenCalledTimes(2);
  });

  it("pre-visualiza o status antes de salvar", async () => {
    const { user } = setup();
    await screen.findByLabelText("Alimentação");

    await user.clear(screen.getByLabelText("Alimentação"));
    await user.type(screen.getByLabelText("Alimentação"), "500000");

    expect(within(rowOf("Alimentação")).getByText("Dentro do orçamento")).toBeInTheDocument();
  });

  it("avisa quando nao ha alteracoes", async () => {
    const { user } = setup();
    await screen.findByLabelText("Alimentação");

    await user.click(screen.getByRole("button", { name: "Salvar orçamentos" }));

    expect(mockedApply).not.toHaveBeenCalled();
    expect(mockedNotify).toHaveBeenCalledWith(
      "warning",
      "Nenhuma alteração para salvar.",
    );
  });

  it("copia os limites do mes anterior sem gravar", async () => {
    const { user, profile } = setup();
    await screen.findByLabelText("Alimentação");
    const february = { year: 2026, month: 2 };
    mockedBudgets.mockResolvedValueOnce([makeBudget("transporte", 400, february)]);

    await user.click(
      screen.getByRole("button", { name: "Copiar do mês anterior" }),
    );

    await waitFor(() =>
      expect(screen.getByLabelText("Transporte")).toHaveValue("R$ 400,00"),
    );
    expect(mockedBudgets).toHaveBeenLastCalledWith(profile.userId, february);
    expect(screen.getByLabelText("Alimentação")).toHaveValue("");
    expect(mockedApply).not.toHaveBeenCalled();
    expect(mockedNotify).toHaveBeenCalledWith(
      "success",
      "Valores copiados de fevereiro de 2026. Revise e salve.",
    );
  });

  it("avisa quando o mes anterior nao tem orcamentos", async () => {
    const { user } = setup();
    await screen.findByLabelText("Alimentação");
    mockedBudgets.mockResolvedValueOnce([]);

    await user.click(
      screen.getByRole("button", { name: "Copiar do mês anterior" }),
    );

    await waitFor(() =>
      expect(mockedNotify).toHaveBeenCalledWith(
        "warning",
        "Não há orçamentos definidos em fevereiro de 2026.",
      ),
    );
  });

  it("mantem os valores e exibe erro quando a gravacao falha", async () => {
    mockedApply.mockRejectedValueOnce(
      Object.assign(new Error("x"), { code: "permission-denied" }),
    );
    const { user } = setup();
    await screen.findByLabelText("Alimentação");

    await user.type(screen.getByLabelText("Saúde"), "30000");
    await user.click(screen.getByRole("button", { name: "Salvar orçamentos" }));

    await waitFor(() =>
      expect(mockedNotify).toHaveBeenCalledWith(
        "error",
        "Você não possui permissão para esta operação.",
      ),
    );
    expect(screen.getByLabelText("Saúde")).toHaveValue("R$ 300,00");
  });

  it("bloqueia limite igual a zero sem gravar", async () => {
    const { user } = setup();
    await screen.findByLabelText("Alimentação");

    await user.type(screen.getByLabelText("Moradia"), "0");
    expect(screen.getByLabelText("Moradia")).toHaveValue("R$ 0,00");
    await user.click(screen.getByRole("button", { name: "Salvar orçamentos" }));

    expect(mockedApply).not.toHaveBeenCalled();
    expect(mockedNotify).toHaveBeenCalledWith(
      "warning",
      "Moradia: O orçamento deve ser maior que zero.",
    );
  });

  it("remove o orcamento e a categoria volta a 'sem orcamento' apos recarregar", async () => {
    const { user } = setup();
    await screen.findByLabelText("Lazer");
    mockedBudgets.mockResolvedValueOnce([makeBudget("alimentacao", 1200, MARCH)]);

    await user.clear(screen.getByLabelText("Lazer"));
    await user.click(screen.getByRole("button", { name: "Salvar orçamentos" }));

    await waitFor(() =>
      expect(within(rowOf("Lazer")).getByText("Sem orçamento")).toBeInTheDocument(),
    );
    expect(screen.getByLabelText("Lazer")).toHaveValue("");
  });

  it("guest visualiza sem campos editaveis nem botoes de gravacao", async () => {
    setup("guest");

    expect(await screen.findByText("R$ 1.200,00")).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Salvar orçamentos" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Copiar do mês anterior" }),
    ).not.toBeInTheDocument();
  });

  it("usa o mes atual sem parametro e navega para o anterior", async () => {
    const { user, profile } = setup("standard", "/budgets");
    const current = getCurrentCompetence();
    await waitFor(() =>
      expect(mockedBudgets).toHaveBeenCalledWith(profile.userId, current),
    );

    await user.click(await screen.findByRole("button", { name: "Mês anterior" }));

    await waitFor(() =>
      expect(mockedBudgets).toHaveBeenLastCalledWith(
        profile.userId,
        shiftCompetence(current, -1),
      ),
    );
  });
});
