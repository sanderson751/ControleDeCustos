import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { notify } from "@/lib/notify";
import { exportCsv, exportPdf } from "@/lib/reportExport";
import ReportsPage from "@/pages/ReportsPage";
import { useSession } from "@/providers/AuthProvider";
import { listCostsForReport } from "@/services/reportService";
import { makeCostEntry, makeProfile } from "@/test/factories";
import { renderWithRouter } from "@/test/render";

vi.mock("@/providers/AuthProvider", () => ({ useSession: vi.fn() }));
vi.mock("@/lib/notify", () => ({ notify: vi.fn() }));
vi.mock("@/lib/reportExport", () => ({
  exportCsv: vi.fn(),
  exportPdf: vi.fn(async () => undefined),
}));
vi.mock("@/services/reportService", () => ({ listCostsForReport: vi.fn() }));

const mockedUseSession = vi.mocked(useSession);
const mockedList = vi.mocked(listCostsForReport);
const mockedNotify = vi.mocked(notify);

function setup() {
  const profile = makeProfile("guest");
  mockedUseSession.mockReturnValue({ profile, firebaseUser: {} as never });
  return {
    profile,
    ...renderWithRouter(<ReportsPage />, { route: "/reports" }),
  };
}

describe("ReportsPage", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 10, 26, 10));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("carrega o mes corrente por padrao e exibe os totais", async () => {
    mockedList.mockResolvedValue([
      makeCostEntry({ accountName: "Aluguel", amount: 900, costType: "fixo" }),
      makeCostEntry({ accountName: "Feira", amount: 100 }),
    ]);
    const { profile } = setup();

    expect(await screen.findByText("Aluguel")).toBeInTheDocument();
    expect(mockedList).toHaveBeenCalledWith(profile.userId, {
      startDate: "2026-11-01",
      endDate: "2026-11-26",
      costType: "todos",
    });
    expect(screen.getByText("R$ 1.000,00")).toBeInTheDocument();
  });

  it("aplica filtro de frente e periodo", async () => {
    mockedList.mockResolvedValue([]);
    const { user, profile } = setup();
    await screen.findByText(/Nenhum lançamento encontrado/);

    fireEvent.change(screen.getByLabelText("Data inicial"), {
      target: { value: "2026-10-01" },
    });
    const frente = screen.getByRole("group", { name: "Frente do relatório" });
    await user.click(within(frente).getByRole("button", { name: "Fixo" }));
    await user.click(screen.getByRole("button", { name: "Aplicar filtros" }));

    await waitFor(() =>
      expect(mockedList).toHaveBeenLastCalledWith(profile.userId, {
        startDate: "2026-10-01",
        endDate: "2026-11-26",
        costType: "fixo",
        category: "todas",
      }),
    );
  });

  it("exibe a coluna Descricao (cenario 5)", async () => {
    mockedList.mockResolvedValue([
      makeCostEntry({ accountName: "Loja", description: "Presente da Ana" }),
      makeCostEntry({ accountName: "Luz" }),
    ]);
    setup();

    expect(await screen.findByRole("cell", { name: "Presente da Ana" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Descrição" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "—" })).toBeInTheDocument();
  });

  it("filtra por categoria e exibe a coluna Categoria", async () => {
    mockedList.mockResolvedValue([
      makeCostEntry({ accountName: "Cinema", category: "lazer" }),
    ]);
    const { user, profile } = setup();
    expect(await screen.findByRole("cell", { name: "Lazer" })).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("Categoria"), "lazer");
    await user.click(screen.getByRole("button", { name: "Aplicar filtros" }));

    await waitFor(() =>
      expect(mockedList).toHaveBeenLastCalledWith(
        profile.userId,
        expect.objectContaining({ category: "lazer" }),
      ),
    );
  });

  it("avisa quando a data inicial e maior que a final", async () => {
    mockedList.mockResolvedValue([]);
    const { user } = setup();
    await screen.findByText(/Nenhum lançamento encontrado/);

    fireEvent.change(screen.getByLabelText("Data inicial"), {
      target: { value: "2026-12-30" },
    });
    await user.click(screen.getByRole("button", { name: "Aplicar filtros" }));

    expect(mockedNotify).toHaveBeenCalledWith(
      "warning",
      "A data inicial não pode ser maior que a data final.",
    );
    expect(mockedList).toHaveBeenCalledTimes(1);
  });

  it("sem conexao nao exporta relatorio possivelmente incompleto (cache do aparelho)", async () => {
    mockedList.mockResolvedValue([makeCostEntry({ accountName: "Internet" })]);
    const { user } = setup();
    await screen.findByText("Internet");
    Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
    try {
      await user.click(screen.getByRole("button", { name: "Exportar" }));
      await user.click(await screen.findByRole("menuitem", { name: "Exportar CSV" }));
      expect(exportCsv).not.toHaveBeenCalled();
      expect(mockedNotify).toHaveBeenCalledWith("warning", "Sem conexão: conecte-se para exportar o relatório completo.");
    } finally {
      Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
    }
  });

  it("exporta CSV e PDF pelo menu de exportacao", async () => {
    const entries = [makeCostEntry({ accountName: "Internet" })];
    mockedList.mockResolvedValue(entries);
    const { user } = setup();
    await screen.findByText("Internet");

    await user.click(screen.getByRole("button", { name: "Exportar" }));
    await user.click(
      await screen.findByRole("menuitem", { name: "Exportar CSV" }),
    );

    expect(exportCsv).toHaveBeenCalledWith(
      entries,
      "2026-11-01",
      "2026-11-26",
      expect.any(Function),
    );
    expect(mockedNotify).toHaveBeenCalledWith(
      "success",
      "Relatório exportado em CSV com sucesso.",
    );

    await user.click(screen.getByRole("button", { name: "Exportar" }));
    await user.click(
      await screen.findByRole("menuitem", { name: "Exportar PDF" }),
    );

    await waitFor(() =>
      expect(exportPdf).toHaveBeenCalledWith(
        entries,
        "2026-11-01",
        "2026-11-26",
        expect.any(Function),
      ),
    );
  });

  it("avisa quando nao ha lancamentos para exportar", async () => {
    mockedList.mockResolvedValue([]);
    const { user } = setup();
    await screen.findByText(/Nenhum lançamento encontrado/);

    await user.click(screen.getByRole("button", { name: "Exportar" }));
    await user.click(
      await screen.findByRole("menuitem", { name: "Exportar PDF" }),
    );

    expect(exportPdf).not.toHaveBeenCalled();
    expect(mockedNotify).toHaveBeenCalledWith(
      "warning",
      "Não há lançamentos para exportar no formato PDF.",
    );
  });

  it("exibe erro quando o relatorio nao carrega", async () => {
    mockedList.mockRejectedValue(new Error("offline"));
    setup();

    await waitFor(() =>
      expect(mockedNotify).toHaveBeenCalledWith(
        "error",
        "Não foi possível carregar o relatório com os filtros selecionados.",
      ),
    );
  });
});
