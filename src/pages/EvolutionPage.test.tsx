import { screen, waitFor, within } from "@testing-library/react";
import { notify } from "@/lib/notify";
import EvolutionPage from "@/pages/EvolutionPage";
import { useSession } from "@/providers/AuthProvider";
import { loadEvolutionData } from "@/services/evolutionService";
import { listCompetences } from "@/domain/rules/evolutionRules";
import { makeCostEntry, makeProfile } from "@/test/factories";
import { renderWithRouter } from "@/test/render";

vi.mock("@/providers/AuthProvider", () => ({ useSession: vi.fn() }));
vi.mock("@/lib/notify", () => ({ notify: vi.fn() }));
vi.mock("@/services/evolutionService", () => ({ loadEvolutionData: vi.fn() }));

const mockedLoad = vi.mocked(loadEvolutionData);
const END = { year: 2026, month: 11 };

function entry(month: number, amount: number, overrides = {}) {
  return makeCostEntry({
    competenceYear: 2026,
    competenceMonth: month,
    amount,
    category: "lazer",
    costType: "variavel",
    ...overrides,
  });
}

function setup(route = "/evolution?mes=2026-11") {
  vi.mocked(useSession).mockReturnValue({
    profile: makeProfile("guest"),
    firebaseUser: {} as never,
  });
  return renderWithRouter(<EvolutionPage />, { route, path: "/evolution" });
}

describe("EvolutionPage", () => {
  beforeEach(() => {
    mockedLoad.mockImplementation(async (_uid, end, months) => ({
      competences: listCompetences(end, months),
      entries: [
        entry(9, 100),
        entry(10, 300, { category: "moradia", costType: "fixo" }),
        entry(11, 200),
      ],
      monthLimits: [],
      recurring: [
        { id: "2026-01-lazer", category: "lazer", year: 2026, month: 1, limit: 150 },
      ],
    }));
  });

  it("carrega 6 meses ate a competencia e exibe os indicadores (cenario 5)", async () => {
    setup();

    await waitFor(() =>
      expect(mockedLoad).toHaveBeenCalledWith("uid-guest", END, 6),
    );
    // Media sobre os 6 meses do periodo: 600 / 6.
    expect(await screen.findByText("R$ 100,00")).toBeInTheDocument();
    expect(screen.getByText("R$ 300,00")).toBeInTheDocument();
    expect(screen.getByText("out/2026")).toBeInTheDocument();
    expect(screen.getByText("-33%")).toBeInTheDocument();
  });

  it("filtra a categoria e conta meses acima do orcamento (cenario 2)", async () => {
    const { user } = setup();
    await screen.findByText("R$ 300,00");

    await user.selectOptions(screen.getByLabelText("Categoria"), "lazer");

    const overBudget = screen.getByText("Acima do orçamento").closest("article")!;
    expect(within(overBudget).getByText("1")).toBeInTheDocument();
    expect(within(overBudget).getByText("de 6 meses com orçamento")).toBeInTheDocument();
    expect(screen.getByText("Lazer, até novembro de 2026.")).toBeInTheDocument();
  });

  it("filtro de frente oculta o orcamento e explica o motivo (cenario 3)", async () => {
    const { user } = setup();
    await screen.findByText("R$ 300,00");

    const frente = screen.getByRole("group", { name: "Frente" });
    await user.click(within(frente).getByRole("button", { name: "Fixo" }));

    expect(
      screen.getByText(/a linha de orçamento fica oculta com o filtro de frente/),
    ).toBeInTheDocument();
    const legend = screen.getByRole("list", { name: "Legenda" });
    expect(within(legend).getByText("Gasto")).toBeInTheDocument();
    expect(within(legend).queryByText("Orçamento")).not.toBeInTheDocument();
    expect(screen.getByText("indisponível com filtro de frente")).toBeInTheDocument();
  });

  it("alterna para a visao em tabela (cenario 4)", async () => {
    const { user } = setup();
    await screen.findByText("R$ 300,00");

    await user.click(screen.getByRole("button", { name: "Ver tabela" }));

    const table = screen.getByRole("table", { name: "Evolução mensal em tabela" });
    expect(within(table).getAllByRole("row")).toHaveLength(7);
    expect(within(table).getByText("novembro de 2026")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ver gráfico" })).toBeInTheDocument();
  });

  it("muda o periodo para 12 meses", async () => {
    const { user } = setup();
    await screen.findByText("R$ 300,00");

    const periodo = screen.getByRole("group", { name: "Período" });
    await user.click(within(periodo).getByRole("button", { name: "12 meses" }));

    await waitFor(() =>
      expect(mockedLoad).toHaveBeenLastCalledWith("uid-guest", END, 12),
    );
  });

  it("exibe erro quando a evolucao nao carrega (cenario 6)", async () => {
    mockedLoad.mockRejectedValue(new Error("offline"));
    setup();

    await waitFor(() =>
      expect(notify).toHaveBeenCalledWith(
        "error",
        "Não foi possível carregar a evolução mensal.",
      ),
    );
  });
});

describe("EvolutionPage - regressoes da revisao de QA", () => {
  beforeEach(() => {
    vi.mocked(useSession).mockReturnValue({
      profile: makeProfile("guest"),
      firebaseUser: {} as never,
    });
  });

  it("D1: falha no carregamento mostra erro na tela e indicadores sem zeros enganosos", async () => {
    mockedLoad.mockRejectedValue(new Error("offline"));
    renderWithRouter(<EvolutionPage />, { route: "/evolution?mes=2026-11", path: "/evolution" });

    expect(
      await screen.findByText(
        "Não foi possível carregar a evolução mensal. Os valores não estão disponíveis no momento.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText("R$ 0,00")).not.toBeInTheDocument();
    const average = screen.getByText("Média mensal").closest("article")!;
    expect(within(average).getByText("—")).toBeInTheDocument();
  });

  it("D1/D3: falha ao trocar o periodo nao mantem dados do periodo anterior e avisa de novo", async () => {
    mockedLoad
      .mockResolvedValueOnce({
        competences: listCompetences(END, 6),
        entries: [entry(11, 600)],
        monthLimits: [],
        recurring: [],
      })
      .mockRejectedValue(new Error("offline"));
    const { user } = renderWithRouter(<EvolutionPage />, {
      route: "/evolution?mes=2026-11",
      path: "/evolution",
    });
    expect(await screen.findByTestId("evolution-last-label")).toHaveTextContent("R$ 600,00");

    const periodo = screen.getByRole("group", { name: "Período" });
    await user.click(within(periodo).getByRole("button", { name: "12 meses" }));

    expect(
      await screen.findByText(/Os valores não estão disponíveis no momento/),
    ).toBeInTheDocument();
    expect(screen.queryAllByText("R$ 600,00")).toHaveLength(0);
    expect(notify).toHaveBeenCalledWith(
      "error",
      "Não foi possível carregar a evolução mensal.",
    );
  });
});
