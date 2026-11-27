import { screen, waitFor, within } from "@testing-library/react";
import type { RecurringCost } from "@/domain/entities/recurringCost";
import type { UserRole } from "@/domain/entities/user";
import { buildCategoryCatalog } from "@/domain/rules/categoryRules";
import { notify } from "@/lib/notify";
import RecurringPage from "@/pages/RecurringPage";
import { useSession } from "@/providers/AuthProvider";
import { useCategories } from "@/providers/CategoriesProvider";
import {
  createRecurringCost,
  deleteRecurringCost,
  setRecurringCostActive,
  subscribeToRecurringCosts,
  generateRecurring,
  updateRecurringCost,
} from "@/services/recurringCostService";
import { makeProfile } from "@/test/factories";
import { renderWithRouter } from "@/test/render";

vi.mock("@/providers/AuthProvider", () => ({ useSession: vi.fn() }));
vi.mock("@/providers/CategoriesProvider", () => ({ useCategories: vi.fn() }));
vi.mock("@/lib/notify", () => ({ notify: vi.fn() }));
vi.mock("@/services/recurringCostService", () => ({
  subscribeToRecurringCosts: vi.fn(),
  createRecurringCost: vi.fn(),
  updateRecurringCost: vi.fn(),
  setRecurringCostActive: vi.fn(),
  deleteRecurringCost: vi.fn(),
  generateRecurring: vi.fn(),
}));

const mockedNotify = vi.mocked(notify);
const CUSTOMS = [
  { id: "pets1", name: "Pets", archived: false },
  { id: "old1", name: "Antiga", archived: true },
];

const ALUGUEL: RecurringCost = {
  id: "r1",
  accountName: "Aluguel",
  amount: 2000,
  costType: "fixo",
  category: "moradia",
  description: "apto 12",
  dayOfMonth: 5,
  start: { year: 2026, month: 9 },
  active: true,
  lastGenerated: { year: 2026, month: 11 },
};
const ACADEMIA: RecurringCost = {
  ...ALUGUEL,
  id: "r2",
  accountName: "Academia",
  amount: 120,
  category: "old1",
  description: "",
  active: false,
  lastGenerated: null,
};

function setup(role: UserRole = "standard", items: RecurringCost[] = [ALUGUEL, ACADEMIA]) {
  vi.mocked(useSession).mockReturnValue({
    profile: makeProfile(role),
    firebaseUser: {} as never,
  });
  vi.mocked(useCategories).mockReturnValue({
    catalog: buildCategoryCatalog(CUSTOMS),
    customs: CUSTOMS,
    isLoading: false,
    error: null,
  });
  vi.mocked(subscribeToRecurringCosts).mockImplementation((_uid, onData) => {
    onData(items);
    return () => undefined;
  });
  return renderWithRouter(<RecurringPage />);
}

/** Renderiza mantendo os mocks de sessao/categorias ja configurados. */
function renderPage() {
  return renderWithRouter(<RecurringPage />);
}

function rowOf(name: string) {
  return screen.getByRole("row", { name: new RegExp(name) });
}

describe("RecurringPage", () => {
  beforeEach(() => {
    vi.mocked(createRecurringCost).mockImplementation(async (_uid, input) => ({
      ...input,
      id: "novo",
      active: true,
      lastGenerated: null,
    }));
    vi.mocked(generateRecurring).mockResolvedValue(3);
    vi.mocked(updateRecurringCost).mockResolvedValue(undefined);
    vi.mocked(deleteRecurringCost).mockResolvedValue(undefined);
    vi.mocked(setRecurringCostActive).mockImplementation(async (_uid, item, active) => ({
      ...item,
      active,
    }));
  });

  it("lista as recorrencias com situacao, inicio e ultimo mes gerado", () => {
    setup();

    const aluguel = rowOf("Aluguel");
    expect(within(aluguel).getByText("R$ 2.000,00")).toBeInTheDocument();
    expect(within(aluguel).getByText("Moradia")).toBeInTheDocument();
    expect(within(aluguel).getByText("set/2026")).toBeInTheDocument();
    expect(within(aluguel).getByText("nov/2026")).toBeInTheDocument();
    expect(within(aluguel).getByText("Ativa")).toBeInTheDocument();
    expect(within(rowOf("Academia")).getByText("Pausada")).toBeInTheDocument();
    expect(within(rowOf("Academia")).getByText("Antiga")).toBeInTheDocument();
  });

  it("cria a recorrencia, gera os pendentes na hora e limpa o formulario", async () => {
    const { user } = setup();
    const form = screen.getByRole("form", { name: "Nova recorrência" });

    await user.type(within(form).getByLabelText("Conta"), "Internet");
    await user.type(within(form).getByLabelText("Valor"), "9990");
    await user.selectOptions(within(form).getByLabelText("Categoria"), "pets1");
    await user.clear(within(form).getByLabelText("Dia do mês"));
    await user.type(within(form).getByLabelText("Dia do mês"), "10");
    await user.click(screen.getByRole("button", { name: "Adicionar recorrência" }));

    await waitFor(() =>
      expect(createRecurringCost).toHaveBeenCalledWith(
        "uid-standard",
        expect.objectContaining({
          accountName: "Internet",
          amount: 99.9,
          category: "pets1",
          costType: "fixo",
          dayOfMonth: 10,
        }),
      ),
    );
    expect(generateRecurring).toHaveBeenCalledWith("uid-standard", "novo");
    expect(mockedNotify).toHaveBeenCalledWith(
      "success",
      'Recorrência "Internet" criada. 3 lançamentos gerados.',
    );
    expect(within(form).getByLabelText("Conta")).toHaveValue("");
  });

  it("escolhe mes e ano do primeiro lancamento (inicio no passado)", async () => {
    const lastYear = new Date().getFullYear() - 1;
    const { user } = setup();
    const form = screen.getByRole("form", { name: "Nova recorrência" });

    await user.type(within(form).getByLabelText("Conta"), "Escola");
    await user.type(within(form).getByLabelText("Valor"), "150000");
    await user.selectOptions(within(form).getByLabelText("Categoria"), "educacao");
    await user.selectOptions(within(form).getByLabelText("Ano do primeiro lançamento"), String(lastYear));
    await user.selectOptions(within(form).getByLabelText("Mês do primeiro lançamento"), "12");
    await user.click(screen.getByRole("button", { name: "Adicionar recorrência" }));

    await waitFor(() =>
      expect(createRecurringCost).toHaveBeenCalledWith(
        "uid-standard",
        expect.objectContaining({ start: { year: lastYear, month: 12 } }),
      ),
    );
  });

  it("valida antes de gravar e nao oferece categoria arquivada na criacao", async () => {
    const { user } = setup();
    const form = screen.getByRole("form", { name: "Nova recorrência" });

    expect(within(form).queryByRole("option", { name: /Antiga/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Adicionar recorrência" }));

    expect(mockedNotify).toHaveBeenCalledWith("warning", "Informe o nome da conta.");
    expect(createRecurringCost).not.toHaveBeenCalled();
  });

  it("criacao com geracao falhando avisa que sera gerado depois", async () => {
    vi.mocked(generateRecurring).mockRejectedValueOnce(new Error("offline"));
    const { user } = setup();
    const form = screen.getByRole("form", { name: "Nova recorrência" });

    await user.type(within(form).getByLabelText("Conta"), "Internet");
    await user.type(within(form).getByLabelText("Valor"), "9990");
    await user.selectOptions(within(form).getByLabelText("Categoria"), "lazer");
    await user.click(screen.getByRole("button", { name: "Adicionar recorrência" }));

    await waitFor(() =>
      expect(mockedNotify).toHaveBeenCalledWith(
        "warning",
        expect.stringContaining("serão gerados na próxima abertura"),
      ),
    );
  });

  it("edita pelo dialogo mantendo a categoria arquivada atual", async () => {
    vi.mocked(generateRecurring).mockResolvedValueOnce(0);
    const { user } = setup();

    await user.click(screen.getByRole("button", { name: "Editar Academia" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByLabelText("Categoria")).toHaveValue("old1");
    const amount = within(dialog).getByLabelText("Valor");
    await user.clear(amount);
    await user.type(amount, "15000");
    await user.click(within(dialog).getByRole("button", { name: "Salvar" }));

    await waitFor(() =>
      expect(updateRecurringCost).toHaveBeenCalledWith(
        "uid-standard",
        "r2",
        expect.objectContaining({ amount: 150, category: "old1" }),
      ),
    );
    expect(mockedNotify).toHaveBeenCalledWith(
      "success",
      "Recorrência atualizada. A alteração vale para os próximos meses.",
    );
  });

  it("regressao: recorrencia com mais de 12 meses continua editavel e o inicio fica travado", async () => {
    vi.mocked(generateRecurring).mockResolvedValueOnce(0);
    const twoYearsAgo = new Date().getFullYear() - 2;
    const antiga: RecurringCost = {
      ...ALUGUEL,
      start: { year: twoYearsAgo, month: 3 },
      lastGenerated: { year: twoYearsAgo + 2, month: 1 },
    };
    const { user } = setup("standard", [antiga]);

    await user.click(screen.getByRole("button", { name: "Editar Aluguel" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByLabelText("Ano do primeiro lançamento")).toBeDisabled();
    expect(within(dialog).getByLabelText("Mês do primeiro lançamento")).toHaveValue("03");
    expect(
      within(dialog).getByText("O primeiro mês não muda depois que há lançamentos gerados."),
    ).toBeInTheDocument();

    const amount = within(dialog).getByLabelText("Valor");
    await user.clear(amount);
    await user.type(amount, "210000");
    await user.click(within(dialog).getByRole("button", { name: "Salvar" }));

    await waitFor(() =>
      expect(updateRecurringCost).toHaveBeenCalledWith(
        "uid-standard",
        "r1",
        expect.objectContaining({ amount: 2100, start: { year: twoYearsAgo, month: 3 } }),
      ),
    );
  });

  it("edicao com categorias carregando avisa em vez de recusar a categoria", async () => {
    const { user } = setup();
    vi.mocked(useCategories).mockReturnValue({
      catalog: buildCategoryCatalog([]),
      customs: [],
      isLoading: true,
      error: null,
    });

    await user.click(screen.getByRole("button", { name: "Editar Academia" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Salvar" }));

    expect(mockedNotify).toHaveBeenCalledWith(
      "warning",
      "Aguarde o carregamento das suas categorias.",
    );
    expect(updateRecurringCost).not.toHaveBeenCalled();
  });

  it("pausa e reativa (reativar gera o mes atual)", async () => {
    vi.mocked(generateRecurring).mockResolvedValue(1);
    const { user } = setup();

    await user.click(screen.getByRole("button", { name: "Pausar Aluguel" }));
    await waitFor(() =>
      expect(setRecurringCostActive).toHaveBeenCalledWith("uid-standard", ALUGUEL, false),
    );
    expect(mockedNotify).toHaveBeenCalledWith("success", 'Recorrência "Aluguel" pausada.');
    expect(generateRecurring).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Reativar Academia" }));
    await waitFor(() =>
      expect(mockedNotify).toHaveBeenCalledWith(
        "success",
        'Recorrência "Academia" reativada a partir deste mês. 1 lançamento gerado.',
      ),
    );
  });

  it("exclui com confirmacao mantendo os lancamentos gerados", async () => {
    const { user } = setup();

    await user.click(screen.getByRole("button", { name: "Excluir Aluguel" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveTextContent("Os lançamentos já gerados serão mantidos.");
    await user.click(within(dialog).getByRole("button", { name: "Excluir" }));

    await waitFor(() => expect(deleteRecurringCost).toHaveBeenCalledWith("uid-standard", "r1"));
    expect(mockedNotify).toHaveBeenCalledWith(
      "success",
      'Recorrência "Aluguel" excluída. Os lançamentos já gerados foram mantidos.',
    );
  });

  it("erro ao gravar mostra mensagem amigavel", async () => {
    vi.mocked(deleteRecurringCost).mockRejectedValueOnce(
      Object.assign(new Error("x"), { code: "permission-denied" }),
    );
    const { user } = setup();

    await user.click(screen.getByRole("button", { name: "Excluir Aluguel" }));
    await user.click(
      within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Excluir" }),
    );

    await waitFor(() => expect(mockedNotify).toHaveBeenCalledWith("error", expect.any(String)));
  });

  it("estado vazio e falha de carregamento", () => {
    const { unmount } = setup("standard", []);
    expect(screen.getByText("Nenhuma recorrência cadastrada ainda.")).toBeInTheDocument();
    unmount();

    vi.mocked(subscribeToRecurringCosts).mockImplementation((_uid, _onData, onError) => {
      onError(Object.assign(new Error("x"), { code: "permission-denied" }));
      return () => undefined;
    });
    renderPage();
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("guest apenas visualiza", () => {
    setup("guest");

    expect(screen.queryByRole("form", { name: "Nova recorrência" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Editar|Pausar|Excluir/ })).toBeNull();
    expect(screen.getByText("Aluguel")).toBeInTheDocument();
  });
});
