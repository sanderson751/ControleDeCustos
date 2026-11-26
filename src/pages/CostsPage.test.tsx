import { screen, waitFor, within } from "@testing-library/react";
import type { UserRole } from "@/domain/entities/user";
import {
  getCurrentCompetence,
  shiftCompetence,
  toCompetenceParam,
} from "@/domain/rules/competence";
import { notify } from "@/lib/notify";
import CostsPage from "@/pages/CostsPage";
import { useSession } from "@/providers/AuthProvider";
import { listMonthBudgets } from "@/services/budgetService";
import {
  createCostEntry,
  deleteCostEntry,
  listMonthCosts,
} from "@/services/costService";
import { makeBudget, makeCostEntry, makeProfile } from "@/test/factories";
import { renderWithRouter } from "@/test/render";

vi.mock("@/providers/AuthProvider", () => ({ useSession: vi.fn() }));
vi.mock("@/lib/notify", () => ({ notify: vi.fn() }));
vi.mock("@/services/costService", () => ({
  listMonthCosts: vi.fn(),
  createCostEntry: vi.fn(),
  deleteCostEntry: vi.fn(),
}));
vi.mock("@/services/budgetService", () => ({ listMonthBudgets: vi.fn() }));

const mockedUseSession = vi.mocked(useSession);
const mockedList = vi.mocked(listMonthCosts);
const mockedCreate = vi.mocked(createCostEntry);
const mockedDelete = vi.mocked(deleteCostEntry);
const mockedBudgets = vi.mocked(listMonthBudgets);
const mockedNotify = vi.mocked(notify);

function setup(role: UserRole = "standard", route = "/costs") {
  const profile = makeProfile(role);
  mockedUseSession.mockReturnValue({ profile, firebaseUser: {} as never });
  return {
    profile,
    ...renderWithRouter(<CostsPage />, { route, path: "/costs" }),
  };
}

async function fillRequired(
  user: ReturnType<typeof setup>["user"],
  { account = "Internet", amount = "12990", category = "moradia" } = {},
) {
  await user.type(screen.getByLabelText("Conta"), account);
  await user.type(screen.getByLabelText("Valor"), amount);
  await user.selectOptions(screen.getByLabelText("Categoria"), category);
}

describe("CostsPage", () => {
  beforeEach(() => {
    mockedList.mockResolvedValue([]);
    mockedBudgets.mockResolvedValue([]);
    mockedCreate.mockResolvedValue(undefined);
    mockedDelete.mockResolvedValue(undefined);
  });

  it("exibe os totais do mes por frente", async () => {
    mockedList.mockResolvedValue([
      makeCostEntry({ amount: 1000, costType: "fixo" }),
      makeCostEntry({ amount: 250, costType: "variavel" }),
    ]);

    setup();

    expect(await screen.findByText("R$ 1.250,00")).toBeInTheDocument();
    expect(screen.getAllByText("R$ 1.000,00").length).toBeGreaterThan(0);
    expect(screen.getAllByText("R$ 250,00").length).toBeGreaterThan(0);
  });

  it("realiza cadastro rapido com categoria e recarrega a lista", async () => {
    const { user, profile } = setup();
    await screen.findByText(/Nenhum custo encontrado/);

    await fillRequired(user, { category: "alimentacao" });
    await user.click(screen.getByRole("button", { name: "Adicionar custo" }));

    await waitFor(() =>
      expect(mockedCreate).toHaveBeenCalledWith(profile.userId, {
        accountName: "Internet",
        amount: 129.9,
        costType: "variavel",
        category: "alimentacao",
        installmentsTotal: 1,
        createdAtManual: undefined,
      }),
    );
    expect(mockedNotify).toHaveBeenCalledWith(
      "success",
      "Custo cadastrado com sucesso.",
    );
    expect(mockedList).toHaveBeenCalledTimes(2);
    expect(screen.getByLabelText("Conta")).toHaveValue("");
    expect(screen.getByLabelText("Categoria")).toHaveValue("");
  });

  it("exige categoria antes de gravar", async () => {
    const { user } = setup();
    await screen.findByText(/Nenhum custo encontrado/);

    await user.type(screen.getByLabelText("Conta"), "Sem categoria");
    await user.type(screen.getByLabelText("Valor"), "1000");
    await user.click(screen.getByRole("button", { name: "Adicionar custo" }));

    expect(mockedCreate).not.toHaveBeenCalled();
    expect(mockedNotify).toHaveBeenCalledWith(
      "warning",
      "Selecione uma categoria.",
    );
  });

  it("bloqueia cadastro com valor zero exibindo warning", async () => {
    const { user } = setup();
    await screen.findByText(/Nenhum custo encontrado/);

    await fillRequired(user, { amount: "0" });
    await user.click(screen.getByRole("button", { name: "Adicionar custo" }));

    expect(mockedCreate).not.toHaveBeenCalled();
    expect(mockedNotify).toHaveBeenCalledWith(
      "warning",
      "Informe um valor maior que zero.",
    );
  });

  it("exibe campo de parcelas apenas para frente fixa e envia o parcelamento", async () => {
    const { user, profile } = setup();
    await screen.findByText(/Nenhum custo encontrado/);

    expect(screen.queryByLabelText("Parcelas")).not.toBeInTheDocument();

    const frente = screen.getByRole("group", { name: "Frente do custo" });
    await user.click(within(frente).getByRole("button", { name: "Fixo" }));

    const installments = screen.getByLabelText("Parcelas");
    await user.clear(installments);
    await user.type(installments, "3");
    await fillRequired(user, { account: "Curso", amount: "30000", category: "educacao" });
    await user.click(screen.getByRole("button", { name: "Adicionar custo" }));

    await waitFor(() =>
      expect(mockedCreate).toHaveBeenCalledWith(
        profile.userId,
        expect.objectContaining({
          costType: "fixo",
          category: "educacao",
          installmentsTotal: 3,
        }),
      ),
    );
  });

  it("permite ajustar a data de criacao manualmente", async () => {
    const { user } = setup();
    await screen.findByText(/Nenhum custo encontrado/);

    await user.click(screen.getByLabelText("Ajustar data de criação"));
    const dateInput = screen.getByLabelText("Data de criação");
    await user.clear(dateInput);
    await user.type(dateInput, "2026-05-10");
    await fillRequired(user);
    await user.click(screen.getByRole("button", { name: "Adicionar custo" }));

    await waitFor(() => expect(mockedCreate).toHaveBeenCalled());
    const [, input] = mockedCreate.mock.calls[0];
    expect(input.createdAtManual?.getMonth()).toBe(4);
    expect(input.createdAtManual?.getDate()).toBe(10);
  });

  it("avisa quando o cadastro faz a categoria passar de 80% e de 100% do orcamento", async () => {
    mockedBudgets.mockResolvedValue([makeBudget("alimentacao", 1000)]);
    mockedList
      .mockResolvedValueOnce([
        makeCostEntry({ accountName: "Feira", category: "alimentacao", amount: 700 }),
      ])
      .mockResolvedValueOnce([
        makeCostEntry({ accountName: "Feira", category: "alimentacao", amount: 700 }),
        makeCostEntry({ category: "alimentacao", amount: 150 }),
      ]);
    const { user } = setup();
    await screen.findByText("Feira");

    await fillRequired(user, { amount: "15000", category: "alimentacao" });
    await user.click(screen.getByRole("button", { name: "Adicionar custo" }));

    await waitFor(() =>
      expect(mockedNotify).toHaveBeenCalledWith(
        "warning",
        "Alimentação atingiu 85% do orçamento: R$ 850,00 de R$ 1.000,00.",
      ),
    );
  });

  it("avisa estouro quando o cadastro passa de 100% do orcamento", async () => {
    mockedBudgets.mockResolvedValue([makeBudget("alimentacao", 1200)]);
    mockedList
      .mockResolvedValueOnce([
        makeCostEntry({ accountName: "Feira", category: "alimentacao", amount: 980 }),
      ])
      .mockResolvedValueOnce([
        makeCostEntry({ accountName: "Feira", category: "alimentacao", amount: 980 }),
        makeCostEntry({ category: "alimentacao", amount: 240 }),
      ]);
    const { user } = setup();
    await screen.findByText("Feira");

    await fillRequired(user, { amount: "24000", category: "alimentacao" });
    await user.click(screen.getByRole("button", { name: "Adicionar custo" }));

    await waitFor(() =>
      expect(mockedNotify).toHaveBeenCalledWith(
        "warning",
        "Alimentação estourou o orçamento: R$ 1.220,00 de R$ 1.200,00 (101%).",
      ),
    );
  });

  it("avisa quando os orcamentos nao carregam e nao calcula alertas", async () => {
    mockedBudgets.mockRejectedValue(new Error("offline"));
    const { user } = setup();
    await screen.findByText(/Nenhum custo encontrado/);

    await waitFor(() =>
      expect(mockedNotify).toHaveBeenCalledWith(
        "warning",
        "Não foi possível carregar os orçamentos do mês. Os alertas de orçamento não serão exibidos.",
      ),
    );

    await fillRequired(user);
    await user.click(screen.getByRole("button", { name: "Adicionar custo" }));
    await waitFor(() => expect(mockedCreate).toHaveBeenCalled());
    expect(
      mockedNotify.mock.calls.filter(([status]) => status === "warning"),
    ).toHaveLength(1);
  });

  it("aplica filtros por frente e por categoria", async () => {
    mockedList.mockResolvedValue([
      makeCostEntry({ accountName: "Aluguel", costType: "fixo", category: "moradia" }),
      makeCostEntry({ accountName: "Mercado", costType: "variavel", category: "alimentacao" }),
      makeCostEntry({ accountName: "Cinema", costType: "variavel", category: "lazer" }),
    ]);
    const { user } = setup();
    await screen.findByText("Aluguel");

    const filtro = screen.getByRole("group", { name: "Filtro de custos" });
    await user.click(within(filtro).getByRole("button", { name: "Variáveis" }));
    expect(screen.queryByText("Aluguel")).not.toBeInTheDocument();
    expect(screen.getByText("Mercado")).toBeInTheDocument();

    await user.selectOptions(
      screen.getByLabelText("Filtrar por categoria"),
      "lazer",
    );
    expect(screen.queryByText("Mercado")).not.toBeInTheDocument();
    expect(screen.getByText("Cinema")).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "Lazer" })).toBeInTheDocument();
  });

  it("navega para o mes anterior pela URL e sugere data nessa competencia", async () => {
    const { user, profile } = setup();
    await screen.findByText(/Nenhum custo encontrado/);
    const previous = shiftCompetence(getCurrentCompetence(), -1);

    await user.click(screen.getByRole("button", { name: "Mês anterior" }));

    expect(screen.getByTestId("location")).toHaveTextContent(
      `/costs?mes=${toCompetenceParam(previous)}`,
    );
    await waitFor(() =>
      expect(mockedList).toHaveBeenLastCalledWith(
        profile.userId,
        previous.year,
        previous.month,
      ),
    );
    expect(screen.getByLabelText("Ajustar data de criação")).toBeChecked();
    expect(
      (screen.getByLabelText("Data de criação") as HTMLInputElement).value,
    ).toMatch(new RegExp(`^${toCompetenceParam(previous)}-`));

    await user.click(screen.getByRole("button", { name: "Mês atual" }));
    expect(screen.getByTestId("location")).toHaveTextContent(/^\/costs$/);
  });

  it("le a competencia inicial da URL", async () => {
    const { profile } = setup("standard", "/costs?mes=2025-02");

    await waitFor(() =>
      expect(mockedList).toHaveBeenCalledWith(profile.userId, 2025, 2),
    );
    expect(screen.getByTestId("competence-label")).toHaveTextContent(
      "fevereiro de 2025",
    );
  });

  it("paginacao navega entre paginas quando ha muitos itens", async () => {
    mockedList.mockResolvedValue(
      Array.from({ length: 12 }, (_, index) =>
        makeCostEntry({ accountName: `Item ${index + 1}` }),
      ),
    );
    const { user } = setup();
    await screen.findByText("Item 1");

    expect(screen.getByText(/Página 1 de 2/)).toBeInTheDocument();
    expect(screen.queryByText("Item 11")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Próxima" }));

    expect(screen.getByText(/Página 2 de 2/)).toBeInTheDocument();
    expect(screen.getByText("Item 11")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Próxima" })).toBeDisabled();
  });

  it("exige confirmacao para excluir custo", async () => {
    const entry = makeCostEntry({ id: "del-1", accountName: "Streaming" });
    mockedList.mockResolvedValue([entry]);
    const { user, profile } = setup();
    await screen.findByText("Streaming");

    await user.click(screen.getByRole("button", { name: "Excluir custo" }));
    const dialog = await screen.findByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: "Cancelar" }));
    expect(mockedDelete).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Excluir custo" }));
    await user.click(
      within(await screen.findByRole("alertdialog")).getByRole("button", {
        name: "Excluir",
      }),
    );

    await waitFor(() =>
      expect(mockedDelete).toHaveBeenCalledWith(profile.userId, "del-1"),
    );
    expect(mockedNotify).toHaveBeenCalledWith(
      "success",
      "Custo removido com sucesso.",
    );
  });

  it("navega para a edicao do custo", async () => {
    mockedList.mockResolvedValue([makeCostEntry({ id: "edit-1" })]);
    const { user } = setup();
    await screen.findByRole("button", { name: "Editar custo" });

    await user.click(screen.getByRole("button", { name: "Editar custo" }));

    expect(screen.getByTestId("location")).toHaveTextContent(
      "/costs/edit-1/edit",
    );
  });

  it("oculta acoes e formulario rapido para perfil guest", async () => {
    mockedList.mockResolvedValue([makeCostEntry({ accountName: "Luz" })]);
    setup("guest");
    await screen.findByText("Luz");

    expect(
      screen.queryByRole("form", { name: "Adição rápida de custo" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Editar custo" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Excluir custo" }),
    ).not.toBeInTheDocument();
  });

  it("exibe snackbar de erro quando a persistencia falha e mantem os dados", async () => {
    mockedCreate.mockRejectedValueOnce(
      Object.assign(new Error("x"), { code: "permission-denied" }),
    );
    const { user } = setup();
    await screen.findByText(/Nenhum custo encontrado/);

    await fillRequired(user, { account: "Mantido" });
    await user.click(screen.getByRole("button", { name: "Adicionar custo" }));

    await waitFor(() =>
      expect(mockedNotify).toHaveBeenCalledWith(
        "error",
        "Você não possui permissão para esta operação.",
      ),
    );
    expect(screen.getByLabelText("Conta")).toHaveValue("Mantido");
  });

  it("exibe snackbar de erro quando a listagem falha", async () => {
    mockedList.mockRejectedValueOnce(new Error("offline"));
    setup();

    await waitFor(() =>
      expect(mockedNotify).toHaveBeenCalledWith(
        "error",
        "Não foi possível carregar os custos do mês.",
      ),
    );
  });
});
