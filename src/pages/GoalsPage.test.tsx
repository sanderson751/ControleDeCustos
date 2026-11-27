import { act, screen, waitFor, within } from "@testing-library/react";
import type { GoalContribution, SavingsGoal } from "@/domain/entities/savingsGoal";
import type { UserRole } from "@/domain/entities/user";
import { notify } from "@/lib/notify";
import GoalsPage from "@/pages/GoalsPage";
import { useSession } from "@/providers/AuthProvider";
import {
  addContribution,
  createGoal,
  deleteContribution,
  deleteGoal,
  subscribeToContributions,
  subscribeToGoals,
  updateGoal,
} from "@/services/savingsGoalService";
import { makeProfile } from "@/test/factories";
import { renderWithRouter } from "@/test/render";

vi.mock("@/providers/AuthProvider", () => ({ useSession: vi.fn() }));
vi.mock("@/lib/notify", () => ({ notify: vi.fn() }));
vi.mock("@/services/savingsGoalService", () => ({
  subscribeToGoals: vi.fn(),
  subscribeToContributions: vi.fn(),
  createGoal: vi.fn(),
  updateGoal: vi.fn(),
  addContribution: vi.fn(),
  deleteContribution: vi.fn(),
  deleteGoal: vi.fn(),
}));

const mockedNotify = vi.mocked(notify);
const nextYear = new Date().getFullYear() + 1;

const VIAGEM: SavingsGoal = {
  id: "g1",
  name: "Viagem",
  targetAmount: 6000,
  deadline: { year: nextYear, month: 12 },
};
const CARRO: SavingsGoal = { id: "g2", name: "Carro", targetAmount: 1000, deadline: null };
const MOVES: GoalContribution[] = [
  { id: "c1", goalId: "g1", amount: 1500, date: new Date(2026, 9, 5, 12), note: "bônus" },
  { id: "c2", goalId: "g1", amount: -300, date: new Date(2026, 9, 20, 12), note: "" },
  { id: "c3", goalId: "g2", amount: 1000, date: new Date(2026, 9, 1, 12), note: "" },
];

let pushGoals: (items: SavingsGoal[]) => void = () => undefined;

function setup(
  role: UserRole = "standard",
  goals: SavingsGoal[] = [VIAGEM, CARRO],
  moves: GoalContribution[] = MOVES,
) {
  vi.mocked(useSession).mockReturnValue({
    profile: makeProfile(role),
    firebaseUser: {} as never,
  });
  vi.mocked(subscribeToGoals).mockImplementation((_uid, onData) => {
    pushGoals = onData;
    onData(goals);
    return () => undefined;
  });
  vi.mocked(subscribeToContributions).mockImplementation((_uid, onData) => {
    onData(moves);
    return () => undefined;
  });
  return renderWithRouter(<GoalsPage />);
}

const card = (name: string) => screen.getByRole("region", { name: `Meta ${name}` });

describe("GoalsPage", () => {
  beforeEach(() => {
    vi.mocked(createGoal).mockResolvedValue("novo");
    vi.mocked(updateGoal).mockResolvedValue(undefined);
    vi.mocked(addContribution).mockResolvedValue(undefined);
    vi.mocked(deleteContribution).mockResolvedValue(undefined);
    vi.mocked(deleteGoal).mockResolvedValue(undefined);
  });

  it("mostra progresso, falta, situacao e orientacao de cada meta", () => {
    setup();

    const viagem = card("Viagem");
    expect(within(viagem).getByText("R$ 1.200,00")).toBeInTheDocument();
    expect(within(viagem).getByText("20%")).toBeInTheDocument();
    expect(within(viagem).getByText("Falta R$ 4.800,00")).toBeInTheDocument();
    expect(within(viagem).getByText("Em andamento")).toBeInTheDocument();
    expect(within(viagem).getByText("Em andamento")).toHaveAttribute("data-variant", "secondary");
    expect(within(viagem).getByText(/^Guardar R\$ [\d.,]+ por mês até dez\//)).toBeInTheDocument();
    expect(within(viagem).getByRole("progressbar")).toBeInTheDocument();

    const carro = card("Carro");
    expect(within(carro).getByText("Concluída")).toBeInTheDocument();
    expect(within(carro).getByText("Meta atingida!")).toBeInTheDocument();
  });

  it("cria meta com prazo e limpa o formulario", async () => {
    const { user } = setup();
    const form = screen.getByRole("form", { name: "Nova meta" });

    await user.type(within(form).getByLabelText("Nome da meta"), "Reserva");
    await user.type(within(form).getByLabelText("Valor-alvo"), "1000000");
    await user.click(within(form).getByLabelText("Definir prazo"));
    await user.selectOptions(within(form).getByLabelText("Mês do prazo"), "6");
    await user.selectOptions(within(form).getByLabelText("Ano do prazo"), String(nextYear));
    await user.click(screen.getByRole("button", { name: "Criar meta" }));

    await waitFor(() =>
      expect(createGoal).toHaveBeenCalledWith("uid-standard", {
        name: "Reserva",
        targetAmount: 10000,
        deadline: { year: nextYear, month: 6 },
      }),
    );
    expect(mockedNotify).toHaveBeenCalledWith("success", 'Meta "Reserva" criada.');
    expect(within(form).getByLabelText("Nome da meta")).toHaveValue("");
  });

  it("recusa nome repetido sem gravar", async () => {
    const { user } = setup();
    const form = screen.getByRole("form", { name: "Nova meta" });

    await user.type(within(form).getByLabelText("Nome da meta"), "viagem");
    await user.type(within(form).getByLabelText("Valor-alvo"), "100");
    await user.click(screen.getByRole("button", { name: "Criar meta" }));

    expect(mockedNotify).toHaveBeenCalledWith("warning", 'Já existe uma meta chamada "Viagem".');
    expect(createGoal).not.toHaveBeenCalled();
  });

  it("registra deposito com data e observacao", async () => {
    const { user } = setup();

    await user.click(within(card("Viagem")).getByRole("button", { name: "Depositar" }));
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText("Valor"), "25050");
    await user.type(within(dialog).getByLabelText("Observação (opcional)"), "13º");
    await user.click(within(dialog).getByRole("button", { name: "Registrar" }));

    await waitFor(() =>
      expect(addContribution).toHaveBeenCalledWith("uid-standard", {
        goalId: "g1",
        amount: 250.5,
        date: expect.any(Date),
        note: "13º",
      }),
    );
    expect(mockedNotify).toHaveBeenCalledWith(
      "success",
      'Depósito de R$ 250,50 registrado em "Viagem".',
    );
  });

  it("retirada acima do guardado e recusada; dentro do limite grava valor negativo", async () => {
    const { user } = setup();

    await user.click(within(card("Viagem")).getByRole("button", { name: "Retirar" }));
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText("Valor"), "150000");
    await user.click(within(dialog).getByRole("button", { name: "Registrar" }));

    expect(mockedNotify).toHaveBeenCalledWith(
      "warning",
      "A retirada não pode ser maior que o valor guardado (R$ 1.200,00).",
    );
    expect(addContribution).not.toHaveBeenCalled();

    await user.clear(within(dialog).getByLabelText("Valor"));
    await user.type(within(dialog).getByLabelText("Valor"), "20000");
    await user.click(within(dialog).getByRole("button", { name: "Registrar" }));

    await waitFor(() =>
      expect(addContribution).toHaveBeenCalledWith(
        "uid-standard",
        expect.objectContaining({ goalId: "g1", amount: -200 }),
      ),
    );
  });

  it("historico lista movimentacoes e exclui com confirmacao", async () => {
    const { user } = setup();

    await user.click(within(card("Viagem")).getByRole("button", { name: "Histórico de Viagem" }));
    const dialog = await screen.findByRole("dialog");
    const list = within(dialog).getByRole("list", { name: "Movimentações" });
    expect(within(list).getAllByRole("listitem")).toHaveLength(2);
    expect(within(list).getByText(/bônus/)).toBeInTheDocument();

    // Retirada pode ser excluida.
    await user.click(within(list).getAllByRole("button", { name: /Excluir movimentação/ })[1]);
    const confirm = await screen.findByRole("alertdialog");
    expect(confirm).toHaveTextContent("Retirada de R$ 300,00 em 20/10/2026 será removida.");
    await user.click(within(confirm).getByRole("button", { name: "Excluir" }));

    await waitFor(() => expect(deleteContribution).toHaveBeenCalledWith("uid-standard", "c2"));
    expect(mockedNotify).toHaveBeenCalledWith("success", "Movimentação excluída.");
  });

  it("regressao: excluir deposito que deixaria o saldo negativo e bloqueado", async () => {
    const { user } = setup();

    await user.click(within(card("Viagem")).getByRole("button", { name: "Histórico de Viagem" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getAllByRole("button", { name: /Excluir movimentação/ })[0]);
    await user.click(
      within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Excluir" }),
    );

    expect(mockedNotify).toHaveBeenCalledWith(
      "warning",
      expect.stringContaining("o saldo ficaria negativo"),
    );
    expect(deleteContribution).not.toHaveBeenCalled();
  });

  it("regressao: meta excluida em outra aba fecha a edicao aberta e avisa", async () => {
    const { user } = setup();

    await user.click(within(card("Carro")).getByRole("button", { name: "Editar Carro" }));
    await screen.findByRole("dialog");
    act(() => pushGoals([VIAGEM]));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(mockedNotify).toHaveBeenCalledWith("warning", "A meta foi excluída em outro dispositivo.");
    expect(updateGoal).not.toHaveBeenCalled();
  });

  it("falha ao registrar movimentacao mantem o dialogo e mostra erro", async () => {
    vi.mocked(addContribution).mockRejectedValueOnce(
      Object.assign(new Error("x"), { code: "permission-denied" }),
    );
    const { user } = setup();

    await user.click(within(card("Viagem")).getByRole("button", { name: "Depositar" }));
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText("Valor"), "1000");
    await user.click(within(dialog).getByRole("button", { name: "Registrar" }));

    await waitFor(() => expect(mockedNotify).toHaveBeenCalledWith("error", expect.any(String)));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("edita a meta e exclui com suas movimentacoes", async () => {
    const { user } = setup();

    await user.click(within(card("Carro")).getByRole("button", { name: "Editar Carro" }));
    const dialog = await screen.findByRole("dialog");
    const target = within(dialog).getByLabelText("Valor-alvo");
    await user.clear(target);
    await user.type(target, "300000");
    await user.click(within(dialog).getByRole("button", { name: "Salvar" }));

    await waitFor(() =>
      expect(updateGoal).toHaveBeenCalledWith("uid-standard", "g2", {
        name: "Carro",
        targetAmount: 3000,
        deadline: null,
      }),
    );

    await user.click(within(card("Viagem")).getByRole("button", { name: "Excluir Viagem" }));
    const confirm = await screen.findByRole("alertdialog");
    expect(confirm).toHaveTextContent('"Viagem" e 2 movimentações serão removidas');
    await user.click(within(confirm).getByRole("button", { name: "Excluir" }));

    await waitFor(() => expect(deleteGoal).toHaveBeenCalledWith("uid-standard", "g1", MOVES));
  });

  it("dialogo de movimentacao some se a meta for excluida em outra aba", async () => {
    const { user } = setup();

    await user.click(within(card("Viagem")).getByRole("button", { name: "Depositar" }));
    await screen.findByRole("dialog");
    act(() => pushGoals([CARRO]));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(mockedNotify).toHaveBeenCalledWith("warning", "A meta foi excluída em outro dispositivo.");
  });

  it("estado vazio e erro de carregamento", () => {
    const { unmount } = setup("standard", [], []);
    expect(screen.getByText("Nenhuma meta criada ainda.")).toBeInTheDocument();
    unmount();

    vi.mocked(subscribeToGoals).mockImplementation((_uid, _onData, onError) => {
      onError(Object.assign(new Error("x"), { code: "permission-denied" }));
      return () => undefined;
    });
    renderWithRouter(<GoalsPage />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("guest apenas visualiza (sem criar, movimentar, editar ou excluir)", async () => {
    const { user } = setup("guest");

    expect(screen.queryByRole("form", { name: "Nova meta" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Depositar|Retirar|Editar|Excluir/ })).toBeNull();

    await user.click(within(card("Viagem")).getByRole("button", { name: "Histórico de Viagem" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).queryByRole("button", { name: /Excluir/ })).toBeNull();
  });
});
