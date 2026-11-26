import { screen, waitFor, within } from "@testing-library/react";
import type { UserRole } from "@/domain/entities/user";
import { notify } from "@/lib/notify";
import CostsPage from "@/pages/CostsPage";
import { useSession } from "@/providers/AuthProvider";
import {
  createCostEntry,
  deleteCostEntry,
  listMonthCosts,
} from "@/services/costService";
import { makeCostEntry, makeProfile } from "@/test/factories";
import { renderWithRouter } from "@/test/render";

vi.mock("@/providers/AuthProvider", () => ({ useSession: vi.fn() }));
vi.mock("@/lib/notify", () => ({ notify: vi.fn() }));
vi.mock("@/services/costService", () => ({
  listMonthCosts: vi.fn(),
  createCostEntry: vi.fn(),
  deleteCostEntry: vi.fn(),
}));

const mockedUseSession = vi.mocked(useSession);
const mockedList = vi.mocked(listMonthCosts);
const mockedCreate = vi.mocked(createCostEntry);
const mockedDelete = vi.mocked(deleteCostEntry);
const mockedNotify = vi.mocked(notify);

function setup(role: UserRole = "standard") {
  const profile = makeProfile(role);
  mockedUseSession.mockReturnValue({
    profile,
    firebaseUser: {} as never,
  });
  return {
    profile,
    ...renderWithRouter(<CostsPage />, { route: "/costs", path: "/costs" }),
  };
}

describe("CostsPage", () => {
  beforeEach(() => {
    mockedList.mockResolvedValue([]);
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

  it("realiza cadastro rapido com campos obrigatorios e recarrega a lista", async () => {
    const { user, profile } = setup();
    await screen.findByText(/Nenhum custo encontrado/);

    await user.type(screen.getByLabelText("Conta"), "Internet");
    await user.type(screen.getByLabelText("Valor"), "12990");
    await user.click(screen.getByRole("button", { name: "Adicionar custo" }));

    await waitFor(() =>
      expect(mockedCreate).toHaveBeenCalledWith(profile.userId, {
        accountName: "Internet",
        amount: 129.9,
        costType: "variavel",
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
  });

  it("bloqueia cadastro com valor zero exibindo warning", async () => {
    const { user } = setup();
    await screen.findByText(/Nenhum custo encontrado/);

    await user.type(screen.getByLabelText("Conta"), "Teste");
    await user.type(screen.getByLabelText("Valor"), "0");
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
    await user.type(screen.getByLabelText("Conta"), "Curso");
    await user.type(screen.getByLabelText("Valor"), "30000");
    await user.click(screen.getByRole("button", { name: "Adicionar custo" }));

    await waitFor(() =>
      expect(mockedCreate).toHaveBeenCalledWith(
        profile.userId,
        expect.objectContaining({ costType: "fixo", installmentsTotal: 3 }),
      ),
    );
  });

  it("permite ajustar a data de criacao manualmente", async () => {
    const { user, profile } = setup();
    await screen.findByText(/Nenhum custo encontrado/);

    await user.click(screen.getByLabelText("Ajustar data de criação"));
    const dateInput = screen.getByLabelText("Data de criação");
    await user.clear(dateInput);
    await user.type(dateInput, "2026-05-10");
    await user.type(screen.getByLabelText("Conta"), "Antigo");
    await user.type(screen.getByLabelText("Valor"), "100");
    await user.click(screen.getByRole("button", { name: "Adicionar custo" }));

    await waitFor(() => expect(mockedCreate).toHaveBeenCalled());
    const [, input] = mockedCreate.mock.calls[0];
    expect(input.createdAtManual?.getMonth()).toBe(4);
    expect(input.createdAtManual?.getDate()).toBe(10);
    expect(mockedCreate.mock.calls[0][0]).toBe(profile.userId);
  });

  it("aplica filtro por custos variaveis", async () => {
    mockedList.mockResolvedValue([
      makeCostEntry({ accountName: "Aluguel", costType: "fixo" }),
      makeCostEntry({ accountName: "Mercado", costType: "variavel" }),
    ]);
    const { user } = setup();
    await screen.findByText("Aluguel");

    const filtro = screen.getByRole("group", { name: "Filtro de custos" });
    await user.click(within(filtro).getByRole("button", { name: "Variáveis" }));

    expect(screen.queryByText("Aluguel")).not.toBeInTheDocument();
    expect(screen.getByText("Mercado")).toBeInTheDocument();
  });

  it("paginacao navega entre paginas quando ha muitos itens", async () => {
    mockedList.mockResolvedValue(
      Array.from({ length: 12 }, (_, index) =>
        makeCostEntry({ accountName: `Conta ${index + 1}` }),
      ),
    );
    const { user } = setup();
    await screen.findByText("Conta 1");

    expect(screen.getByText(/Página 1 de 2/)).toBeInTheDocument();
    expect(screen.queryByText("Conta 11")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Próxima" }));

    expect(screen.getByText(/Página 2 de 2/)).toBeInTheDocument();
    expect(screen.getByText("Conta 11")).toBeInTheDocument();
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

  it("exibe snackbar de erro quando a persistencia falha", async () => {
    mockedCreate.mockRejectedValueOnce(
      Object.assign(new Error("x"), { code: "permission-denied" }),
    );
    const { user } = setup();
    await screen.findByText(/Nenhum custo encontrado/);

    await user.type(screen.getByLabelText("Conta"), "X");
    await user.type(screen.getByLabelText("Valor"), "100");
    await user.click(screen.getByRole("button", { name: "Adicionar custo" }));

    await waitFor(() =>
      expect(mockedNotify).toHaveBeenCalledWith(
        "error",
        "Você não possui permissão para esta operação.",
      ),
    );
  });

  it("exibe snackbar de erro quando a listagem falha", async () => {
    mockedList.mockRejectedValueOnce(new Error("offline"));
    setup();

    await waitFor(() =>
      expect(mockedNotify).toHaveBeenCalledWith(
        "error",
        "Não foi possível carregar os custos do mês corrente.",
      ),
    );
  });
});
