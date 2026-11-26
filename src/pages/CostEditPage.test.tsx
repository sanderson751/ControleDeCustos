import { screen, waitFor, within } from "@testing-library/react";
import type { UserRole } from "@/domain/entities/user";
import { notify } from "@/lib/notify";
import CostEditPage from "@/pages/CostEditPage";
import { useSession } from "@/providers/AuthProvider";
import { getCostEntryById, updateCostEntry } from "@/services/costService";
import { makeCostEntry, makeProfile } from "@/test/factories";
import { renderWithRouter } from "@/test/render";

vi.mock("@/providers/AuthProvider", () => ({ useSession: vi.fn() }));
vi.mock("@/lib/notify", () => ({ notify: vi.fn() }));
vi.mock("@/services/costService", () => ({
  getCostEntryById: vi.fn(),
  updateCostEntry: vi.fn(),
}));

const mockedUseSession = vi.mocked(useSession);
const mockedGet = vi.mocked(getCostEntryById);
const mockedUpdate = vi.mocked(updateCostEntry);
const mockedNotify = vi.mocked(notify);

function setup(role: UserRole = "standard") {
  const profile = makeProfile(role);
  mockedUseSession.mockReturnValue({ profile, firebaseUser: {} as never });
  return {
    profile,
    ...renderWithRouter(<CostEditPage />, {
      route: "/costs/cost-9/edit",
      path: "/costs/:costId/edit",
    }),
  };
}

describe("CostEditPage", () => {
  beforeEach(() => {
    mockedUpdate.mockResolvedValue(undefined);
  });

  it("carrega o custo e salva alteracoes", async () => {
    mockedGet.mockResolvedValue(
      makeCostEntry({
        id: "cost-9",
        accountName: "Academia",
        amount: 120,
        costType: "variavel",
        category: "saude",
      }),
    );
    const { user, profile } = setup();

    const accountInput = await screen.findByLabelText("Conta");
    expect(mockedGet).toHaveBeenCalledWith(profile.userId, "cost-9");
    expect(accountInput).toHaveValue("Academia");
    expect(screen.getByLabelText("Valor")).toHaveValue("R$ 120,00");
    expect(screen.getByLabelText("Categoria")).toHaveValue("saude");

    await user.clear(accountInput);
    await user.type(accountInput, "Academia premium");
    await user.selectOptions(screen.getByLabelText("Categoria"), "lazer");
    await user.click(screen.getByRole("button", { name: "Salvar alterações" }));

    await waitFor(() =>
      expect(mockedUpdate).toHaveBeenCalledWith(profile.userId, "cost-9", {
        accountName: "Academia premium",
        amount: 120,
        costType: "variavel",
        category: "lazer",
        description: "",
        installmentsTotal: 1,
      }),
    );
    expect(mockedNotify).toHaveBeenCalledWith(
      "success",
      "Custo atualizado com sucesso.",
    );
    expect(screen.getByTestId("location")).toHaveTextContent("/costs");
  });

  it("edita a descricao (cenario 2)", async () => {
    mockedGet.mockResolvedValue(
      makeCostEntry({ accountName: "Notebook", description: "parcela 1" }),
    );
    const { user, profile } = setup();

    const description = await screen.findByLabelText("Descrição (opcional)");
    expect(description).toHaveValue("parcela 1");
    await user.clear(description);
    await user.type(description, "parcela 2");
    await user.click(screen.getByRole("button", { name: "Salvar alterações" }));

    await waitFor(() =>
      expect(mockedUpdate).toHaveBeenCalledWith(
        profile.userId,
        "cost-9",
        expect.objectContaining({ description: "parcela 2" }),
      ),
    );
  });

  it("mostra parcelas apenas quando a frente e fixa", async () => {
    mockedGet.mockResolvedValue(
      makeCostEntry({ costType: "fixo", installmentsTotal: 6 }),
    );
    const { user } = setup();

    expect(await screen.findByLabelText("Parcelas")).toHaveValue(6);

    const frente = screen.getByRole("group", { name: "Frente do custo" });
    await user.click(within(frente).getByRole("button", { name: "Variável" }));

    expect(screen.queryByLabelText("Parcelas")).not.toBeInTheDocument();
  });

  it("volta para a listagem quando o custo nao existe", async () => {
    mockedGet.mockResolvedValue(null);
    setup();

    await waitFor(() =>
      expect(screen.getByTestId("location")).toHaveTextContent("/costs"),
    );
    expect(mockedNotify).toHaveBeenCalledWith(
      "warning",
      "Custo não encontrado para edição.",
    );
  });

  it("valida o formulario antes de salvar", async () => {
    mockedGet.mockResolvedValue(makeCostEntry({ accountName: "Luz" }));
    const { user } = setup();

    await user.clear(await screen.findByLabelText("Conta"));
    await user.click(screen.getByRole("button", { name: "Salvar alterações" }));

    expect(mockedUpdate).not.toHaveBeenCalled();
    expect(mockedNotify).toHaveBeenCalledWith(
      "warning",
      "Informe o nome da conta.",
    );
  });

  it("volta para a competencia do lancamento e exige categoria em legado", async () => {
    mockedGet.mockResolvedValue(
      makeCostEntry({
        accountName: "Antigo",
        category: "outros",
        competenceYear: 2025,
        competenceMonth: 2,
      }),
    );
    const { user } = setup();

    expect(await screen.findByLabelText("Categoria")).toHaveValue("outros");
    await user.click(screen.getByRole("button", { name: "Salvar alterações" }));

    await waitFor(() =>
      expect(mockedUpdate).toHaveBeenCalledWith(
        expect.any(String),
        "cost-9",
        expect.objectContaining({ category: "outros" }),
      ),
    );
    expect(screen.getByTestId("location")).toHaveTextContent(
      "/costs?mes=2025-02",
    );
  });

  it("mantem o formulario e exibe erro quando a gravacao falha", async () => {
    mockedGet.mockResolvedValue(makeCostEntry({ accountName: "Luz" }));
    mockedUpdate.mockRejectedValueOnce(
      Object.assign(new Error("x"), { code: "unavailable" }),
    );
    const { user } = setup();

    await screen.findByLabelText("Conta");
    await user.click(screen.getByRole("button", { name: "Salvar alterações" }));

    await waitFor(() =>
      expect(mockedNotify).toHaveBeenCalledWith(
        "error",
        "Firestore indisponível no momento. Verifique sua conexão.",
      ),
    );
    expect(screen.getByLabelText("Conta")).toHaveValue("Luz");
    expect(screen.getByRole("button", { name: "Salvar alterações" })).toBeEnabled();
  });

  it("bloqueia edicao para guest", () => {
    setup("guest");

    expect(
      screen.getByText("Você não possui permissão para editar custos."),
    ).toBeInTheDocument();
    expect(mockedGet).not.toHaveBeenCalled();
  });
});
