import { screen, waitFor, within } from "@testing-library/react";
import HomePage from "@/pages/HomePage";
import { useSession } from "@/providers/AuthProvider";
import {
  listMonthBudgets,
  listRecurringBudgets,
} from "@/services/budgetService";
import { listMonthCosts } from "@/services/costService";
import {
  subscribeToContributions,
  subscribeToGoals,
} from "@/services/savingsGoalService";
import { makeBudget, makeCostEntry, makeProfile } from "@/test/factories";
import { renderWithRouter } from "@/test/render";

vi.mock("@/providers/AuthProvider", () => ({ useSession: vi.fn() }));
vi.mock("@/services/costService", () => ({ listMonthCosts: vi.fn() }));
vi.mock("@/services/savingsGoalService", () => ({
  subscribeToGoals: vi.fn((_uid: string, onData: (items: never[]) => void) => {
    onData([]);
    return () => undefined;
  }),
  subscribeToContributions: vi.fn((_uid: string, onData: (items: never[]) => void) => {
    onData([]);
    return () => undefined;
  }),
}));
vi.mock("@/services/budgetService", async () =>
  (await import("@/test/budgetServiceMock")).createBudgetServiceMock(),
);

const mockedUseSession = vi.mocked(useSession);
const mockedList = vi.mocked(listMonthCosts);
const mockedBudgets = vi.mocked(listMonthBudgets);

function asUser(role: "standard" | "guest" = "standard") {
  mockedUseSession.mockReturnValue({
    profile: makeProfile(role, { displayName: "Maria Souza" }),
    firebaseUser: {} as never,
  });
}

describe("HomePage", () => {
  beforeEach(() => {
    mockedBudgets.mockResolvedValue([]);
  });

  it("exibe indicadores separados para total, fixos e variaveis", async () => {
    asUser();
    mockedList.mockResolvedValue([
      makeCostEntry({ amount: 1000, costType: "fixo", category: "moradia" }),
      makeCostEntry({ amount: 250, costType: "variavel", category: "lazer" }),
    ]);

    renderWithRouter(<HomePage />);

    expect(await screen.findByText("R$ 1.250,00")).toBeInTheDocument();
    expect(screen.getByText("Total de custos")).toBeInTheDocument();
    expect(screen.getByText("Maria")).toBeInTheDocument();
    expect(screen.getByText("Lançamentos considerados: 2")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Registrar custo/ })).toHaveAttribute(
      "href",
      "/costs",
    );
  });

  it("mostra o consolidado por categoria do maior para o menor", async () => {
    asUser();
    mockedList.mockResolvedValue([
      makeCostEntry({ category: "alimentacao", amount: 500 }),
      makeCostEntry({ category: "moradia", amount: 2000 }),
    ]);

    renderWithRouter(<HomePage />);

    const list = await screen.findByRole("list", {
      name: "Consolidado por categoria",
    });
    const items = within(list).getAllByRole("listitem");
    expect(items[0]).toHaveTextContent("Moradia");
    expect(items[0]).toHaveTextContent("80% do total");
    expect(items[1]).toHaveTextContent("Alimentação");
    expect(items[1]).toHaveTextContent("20% do total");
  });

  it("exibe alertas de 80% e de estouro do orcamento (cenario do steering)", async () => {
    asUser();
    mockedList.mockResolvedValue([
      makeCostEntry({ category: "alimentacao", amount: 980 }),
      makeCostEntry({ category: "lazer", amount: 300 }),
    ]);
    mockedBudgets.mockResolvedValue([
      makeBudget("alimentacao", 1200),
      makeBudget("lazer", 250),
    ]);

    renderWithRouter(<HomePage />);

    const alerts = await screen.findByRole("region", {
      name: "Alertas de orçamento",
    });
    expect(
      within(alerts).getByText(
        "Lazer estourou o orçamento: R$ 300,00 de R$ 250,00 (120%).",
      ),
    ).toBeInTheDocument();
    expect(
      within(alerts).getByText(
        "Alimentação atingiu 81% do orçamento: R$ 980,00 de R$ 1.200,00.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("81% do orçamento de R$ 1.200,00")).toBeInTheDocument();
  });

  it("considera o orcamento recorrente nos alertas (cenario 5 da recorrencia)", async () => {
    asUser();
    mockedList.mockResolvedValue([
      makeCostEntry({ category: "lazer", amount: 850 }),
    ]);
    mockedBudgets.mockResolvedValue([]);
    vi.mocked(listRecurringBudgets).mockResolvedValueOnce([
      { id: "2026-01-lazer", category: "lazer", year: 2026, month: 1, limit: 1000 },
    ]);

    renderWithRouter(<HomePage />, { route: "/home?mes=2026-04" });

    expect(
      await screen.findByText(
        "Lazer atingiu 85% do orçamento: R$ 850,00 de R$ 1.000,00.",
      ),
    ).toBeInTheDocument();
  });

  it("nao exibe alertas sem categorias acima de 80%", async () => {
    asUser();
    mockedList.mockResolvedValue([
      makeCostEntry({ category: "alimentacao", amount: 100 }),
    ]);
    mockedBudgets.mockResolvedValue([makeBudget("alimentacao", 1200)]);

    renderWithRouter(<HomePage />);

    await screen.findByText("8% do orçamento de R$ 1.200,00");
    expect(
      screen.queryByRole("region", { name: "Alertas de orçamento" }),
    ).not.toBeInTheDocument();
  });

  it("carrega a competencia informada na URL", async () => {
    asUser();
    mockedList.mockResolvedValue([]);

    renderWithRouter(<HomePage />, { route: "/home?mes=2026-02" });

    await waitFor(() =>
      expect(mockedList).toHaveBeenCalledWith("uid-standard", 2026, 2),
    );
    expect(mockedBudgets).toHaveBeenCalledWith("uid-standard", {
      year: 2026,
      month: 2,
    });
    expect(await screen.findByText("Nenhum lançamento nesta competência.")).toBeInTheDocument();
  });

  it("informa quando os orcamentos nao carregam (alertas podem estar incompletos)", async () => {
    asUser();
    mockedList.mockResolvedValue([]);
    mockedBudgets.mockRejectedValue(new Error("offline"));

    renderWithRouter(<HomePage />);

    expect(
      await screen.findByText(
        "Não foi possível carregar os orçamentos do mês. Os alertas de orçamento podem estar incompletos.",
      ),
    ).toBeInTheDocument();
  });

  it("atalho para custos preserva a competencia visualizada", async () => {
    asUser();
    mockedList.mockResolvedValue([]);

    renderWithRouter(<HomePage />, { route: "/home?mes=2025-07" });

    expect(
      await screen.findByRole("link", { name: /Registrar custo/ }),
    ).toHaveAttribute("href", "/costs?mes=2025-07");
  });

  it("guest ve atalho somente leitura e aviso em caso de falha", async () => {
    asUser("guest");
    mockedList.mockRejectedValue(new Error("offline"));

    renderWithRouter(<HomePage />);

    expect(
      await screen.findByText("Não foi possível carregar os custos do mês."),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Ver custos/ })).toBeInTheDocument();
  });
});

describe("HomePage - metas de economia", () => {
  beforeEach(() => {
    mockedBudgets.mockResolvedValue([]);
    mockedList.mockResolvedValue([]);
  });

  it("mostra o guardado no mes visualizado e as metas mais urgentes (cenario 5)", async () => {
    asUser();
    const nextYear = new Date().getFullYear() + 1;
    vi.mocked(subscribeToGoals).mockImplementation((_uid, onData) => {
      onData([
        { id: "g1", name: "Viagem", targetAmount: 6000, deadline: { year: nextYear, month: 6 } },
        { id: "g2", name: "Reserva", targetAmount: 1000, deadline: null },
      ]);
      return () => undefined;
    });
    vi.mocked(subscribeToContributions).mockImplementation((_uid, onData) => {
      onData([
        { id: "c1", goalId: "g1", amount: 500, date: new Date(2026, 10, 3, 12), note: "" },
        { id: "c2", goalId: "g1", amount: -100, date: new Date(2026, 10, 20, 12), note: "" },
        { id: "c3", goalId: "g2", amount: 1000, date: new Date(2026, 9, 1, 12), note: "" },
      ]);
      return () => undefined;
    });

    renderWithRouter(<HomePage />, { route: "/home?mes=2026-11", path: "/home" });

    expect(await screen.findByText("Metas de economia")).toBeInTheDocument();
    expect(screen.getByText(/Guardado em novembro de 2026:/)).toBeInTheDocument();
    expect(screen.getByText("R$ 400,00")).toBeInTheDocument();
    expect(screen.getByText("Viagem")).toBeInTheDocument();
    // Meta concluida nao aparece nos destaques.
    expect(screen.queryByText("Reserva")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Ver metas/ })).toHaveAttribute("href", "/goals");
  });

  it("sem metas o resumo fica oculto", async () => {
    asUser();
    vi.mocked(subscribeToGoals).mockImplementation((_uid, onData) => {
      onData([]);
      return () => undefined;
    });
    vi.mocked(subscribeToContributions).mockImplementation((_uid, onData) => {
      onData([]);
      return () => undefined;
    });

    renderWithRouter(<HomePage />);
    await screen.findByText("Total de custos");
    expect(screen.queryByText("Metas de economia")).not.toBeInTheDocument();
  });
});
