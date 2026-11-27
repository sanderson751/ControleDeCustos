import { act, screen, waitFor, within } from "@testing-library/react";
import { Route, Routes } from "react-router";
import type { GroceryList, GroceryProduct } from "@/domain/entities/grocery";
import type { UserRole } from "@/domain/entities/user";
import { notify } from "@/lib/notify";
import GroceryListPage from "@/pages/GroceryListPage";
import { useSession } from "@/providers/AuthProvider";
import { listMonthBudgets, listRecurringBudgets } from "@/services/budgetService";
import { listMonthCosts } from "@/services/costService";
import {
  completeList,
  createList,
  createProduct,
  subscribeToLists,
  subscribeToProducts,
  updateListItems,
} from "@/services/groceryService";
import { makeBudget, makeCostEntry, makeProfile } from "@/test/factories";
import { renderWithRouter } from "@/test/render";

vi.mock("@/providers/AuthProvider", () => ({ useSession: vi.fn() }));
vi.mock("@/lib/notify", () => ({ notify: vi.fn() }));
vi.mock("@/services/costService", () => ({ listMonthCosts: vi.fn() }));
vi.mock("@/services/budgetService", async () =>
  (await import("@/test/budgetServiceMock")).createBudgetServiceMock(),
);
vi.mock("@/services/groceryService", () => ({
  subscribeToProducts: vi.fn(),
  subscribeToLists: vi.fn(),
  createProduct: vi.fn(),
  createList: vi.fn(),
  updateListItems: vi.fn(),
  completeList: vi.fn(),
}));

const mockedNotify = vi.mocked(notify);
const now = new Date();
const competence = { year: now.getFullYear(), month: now.getMonth() + 1 };

const ARROZ: GroceryProduct = {
  id: "arroz",
  name: "Arroz 5kg",
  normalizedName: "arroz 5kg",
  unit: "un",
  lastUnitPrice: 25.9,
  previousUnitPrice: null,
  lastPurchasedAt: now,
  lastStore: "Assaí",
  purchaseCount: 1,
  avgIntervalDays: null,
  intervalCount: 0,
  aliases: [],
};
const CAFE: GroceryProduct = { ...ARROZ, id: "cafe", name: "Café", normalizedName: "cafe", lastUnitPrice: null, purchaseCount: 0 };
const LIST: GroceryList = {
  id: "l1",
  name: "Feira de sábado",
  status: "aberta",
  items: [
    { id: "i1", productId: "arroz", name: "Arroz 5kg", quantity: 2, checked: false },
    { id: "i2", productId: "cafe", name: "Café", quantity: 1, checked: false },
  ],
  purchaseId: null,
  paidTotal: null,
  createdAt: now,
  completedAt: null,
};

function setup(role: UserRole = "standard", list: GroceryList = LIST) {
  vi.mocked(useSession).mockReturnValue({ profile: makeProfile(role), firebaseUser: {} as never });
  vi.mocked(subscribeToProducts).mockImplementation((_uid, onData) => {
    onData([ARROZ, CAFE]);
    return () => undefined;
  });
  vi.mocked(subscribeToLists).mockImplementation((_uid, onData) => {
    onData([list]);
    return () => undefined;
  });
  return renderWithRouter(
    <Routes>
      <Route path="/grocery/:listId" element={<GroceryListPage />} />
    </Routes>,
    { route: `/grocery/${list.id}` },
  );
}

const row = (name: string) => screen.getByRole("row", { name: new RegExp(name) });

describe("GroceryListPage", () => {
  beforeEach(() => {
    vi.mocked(listMonthCosts).mockResolvedValue([
      makeCostEntry({ category: "alimentacao", amount: 420 }),
      makeCostEntry({ category: "lazer", amount: 999 }),
    ]);
    vi.mocked(listMonthBudgets).mockResolvedValue([makeBudget("alimentacao", 500, competence)]);
    vi.mocked(listRecurringBudgets).mockResolvedValue([]);
    vi.mocked(updateListItems).mockResolvedValue(undefined);
    vi.mocked(createProduct).mockReturnValue({ id: "novo", written: Promise.resolve() });
    vi.mocked(completeList).mockResolvedValue({ costEntryId: "c1", purchaseId: "g1" });
    vi.mocked(createList).mockReturnValue({ id: "l2", written: Promise.resolve() });
  });

  it("mostra previsao pelo ultimo preco, sem historico e total previsto", async () => {
    setup();

    expect(within(row("Arroz 5kg")).getByText("R$ 25,90")).toBeInTheDocument();
    expect(within(row("Arroz 5kg")).getByText("R$ 51,80")).toBeInTheDocument();
    expect(within(row("Café")).getByText("sem histórico")).toBeInTheDocument();
    const footer = screen.getByRole("row", { name: /^Total previsto/ });
    expect(footer).toHaveTextContent("(1 item sem histórico)");
    expect(footer).toHaveTextContent("R$ 51,80");
  });

  it("lista x orcamento: gasto do mes + previsto da lista (cenario 4)", async () => {
    setup();

    expect(await screen.findByText(/R\$ 471,80 de R\$ 500,00 \(94%\)/)).toBeInTheDocument();
    expect(screen.getByText("Sobram R$ 28,20 depois desta compra.")).toBeInTheDocument();
  });

  it("adiciona produto do catalogo pela sugestao e produto novo com unidade", async () => {
    const { user } = setup("standard", { ...LIST, items: [] });
    const form = screen.getByRole("form", { name: "Adicionar item" });

    await user.type(within(form).getByLabelText("Produto"), "arr");
    await user.click(within(form).getByRole("button", { name: /Arroz 5kg/ }));
    await user.clear(within(form).getByLabelText("Quantidade"));
    await user.type(within(form).getByLabelText("Quantidade"), "3");
    await user.click(within(form).getByRole("button", { name: "Adicionar" }));

    await waitFor(() =>
      expect(updateListItems).toHaveBeenCalledWith("uid-standard", "l1", [
        expect.objectContaining({ productId: "arroz", name: "Arroz 5kg", quantity: 3, checked: false }),
      ]),
    );
    expect(createProduct).not.toHaveBeenCalled();

    await user.type(within(form).getByLabelText("Produto"), "Carne moída");
    await user.selectOptions(within(form).getByLabelText("Unidade do produto novo"), "kg");
    await user.clear(within(form).getByLabelText("Quantidade"));
    await user.type(within(form).getByLabelText("Quantidade"), "1,5");
    await user.click(within(form).getByRole("button", { name: "Adicionar" }));

    await waitFor(() =>
      expect(createProduct).toHaveBeenCalledWith("uid-standard", { name: "Carne moída", unit: "kg" }),
    );
    expect(updateListItems).toHaveBeenLastCalledWith("uid-standard", "l1", [
      expect.objectContaining({ productId: "novo", name: "Carne moída", quantity: 1.5 }),
    ]);
  });

  it("valida quantidade invalida para unidade", async () => {
    const { user } = setup("standard", { ...LIST, items: [] });
    const form = screen.getByRole("form", { name: "Adicionar item" });

    await user.type(within(form).getByLabelText("Produto"), "Café");
    await user.clear(within(form).getByLabelText("Quantidade"));
    await user.type(within(form).getByLabelText("Quantidade"), "1,5");
    await user.click(within(form).getByRole("button", { name: "Adicionar" }));

    expect(mockedNotify).toHaveBeenCalledWith("warning", "Use uma quantidade inteira para esta unidade.");
    expect(updateListItems).not.toHaveBeenCalled();
  });

  it("marca no carrinho, altera quantidade e remove item", async () => {
    const { user } = setup();

    await user.click(within(row("Café")).getByRole("checkbox"));
    expect(updateListItems).toHaveBeenLastCalledWith("uid-standard", "l1", [
      LIST.items[0],
      { ...LIST.items[1], checked: true },
    ]);

    const quantity = within(row("Arroz 5kg")).getByLabelText("Quantidade de Arroz 5kg");
    await user.clear(quantity);
    await user.type(quantity, "4{Enter}");
    expect(updateListItems).toHaveBeenLastCalledWith("uid-standard", "l1", [
      { ...LIST.items[0], quantity: 4 },
      LIST.items[1],
    ]);

    await user.click(within(row("Café")).getByRole("button", { name: "Remover Café" }));
    expect(updateListItems).toHaveBeenLastCalledWith("uid-standard", "l1", [LIST.items[0]]);
  });

  it("conclui a compra com total e preco pago por item (cenario 2)", async () => {
    const { user } = setup();

    await user.click(screen.getByRole("button", { name: "Concluir compra" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByLabelText("Total pago")).toHaveValue("R$ 51,80");

    await user.type(within(dialog).getByLabelText("Loja"), "Assaí");
    await user.clear(within(dialog).getByLabelText("Total pago"));
    await user.type(within(dialog).getByLabelText("Total pago"), "6000");
    await user.type(within(dialog).getByLabelText("Preço pago de Arroz 5kg"), "2590");
    await user.type(within(dialog).getByLabelText("Preço pago de Café"), "820");
    await user.click(within(dialog).getByRole("button", { name: "Concluir e lançar" }));

    await waitFor(() => expect(completeList).toHaveBeenCalled());
    const [, list, plan] = vi.mocked(completeList).mock.calls[0];
    expect(list.id).toBe("l1");
    expect(plan.cost).toMatchObject({ accountName: "Mercado — Assaí", amount: 60 });
    expect(plan.productUpdates.map((item) => [item.productId, item.lastUnitPrice])).toEqual([
      ["arroz", 25.9],
      ["cafe", 8.2],
    ]);
    expect(mockedNotify).toHaveBeenCalledWith(
      "success",
      "Compra concluída: R$ 60,00 lançados em Alimentação. Preço de 2 produtos atualizados para a próxima lista.",
    );
  });

  it("conclusao sem total e recusada", async () => {
    const { user } = setup();

    await user.click(screen.getByRole("button", { name: "Concluir compra" }));
    const dialog = await screen.findByRole("dialog");
    await user.clear(within(dialog).getByLabelText("Total pago"));
    await user.click(within(dialog).getByRole("button", { name: "Concluir e lançar" }));

    expect(mockedNotify).toHaveBeenCalledWith("warning", "Informe o total pago na compra.");
    expect(completeList).not.toHaveBeenCalled();
  });

  it("lista concluida e somente leitura e pode ser usada novamente", async () => {
    const { user } = setup("standard", { ...LIST, status: "concluida", completedAt: now, purchaseId: "g1", paidTotal: 58.4 });
    expect(screen.getByText(/total pago R\$ 58,40/)).toBeInTheDocument();

    expect(screen.queryByRole("form", { name: "Adicionar item" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Concluir compra" })).not.toBeInTheDocument();
    expect(within(row("Café")).getByRole("checkbox")).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Usar novamente" }));
    await waitFor(() =>
      expect(createList).toHaveBeenCalledWith("uid-standard", {
        name: expect.stringMatching(/^Compra de /),
        items: [
          expect.objectContaining({ productId: "arroz", quantity: 2, checked: false }),
          expect.objectContaining({ productId: "cafe", quantity: 1, checked: false }),
        ],
      }),
    );
  });

  it("guest apenas visualiza", () => {
    setup("guest");

    expect(screen.queryByRole("form", { name: "Adicionar item" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Concluir compra" })).not.toBeInTheDocument();
    expect(within(row("Arroz 5kg")).getByText("R$ 51,80")).toBeInTheDocument();
  });

  it("lista inexistente mostra aviso", () => {
    vi.mocked(useSession).mockReturnValue({ profile: makeProfile("standard"), firebaseUser: {} as never });
    vi.mocked(subscribeToProducts).mockImplementation((_uid, onData) => {
      onData([]);
      return () => undefined;
    });
    vi.mocked(subscribeToLists).mockImplementation((_uid, onData) => {
      onData([]);
      return () => undefined;
    });
    renderWithRouter(
      <Routes>
        <Route path="/grocery/:listId" element={<GroceryListPage />} />
      </Routes>,
      { route: "/grocery/sumiu" },
    );

    expect(screen.getByText("Lista não encontrada. Ela pode ter sido excluída.")).toBeInTheDocument();
  });
});

describe("GroceryListPage - regressoes da revisao", () => {
  beforeEach(() => {
    vi.mocked(listMonthCosts).mockResolvedValue([]);
    vi.mocked(listMonthBudgets).mockResolvedValue([]);
    vi.mocked(listRecurringBudgets).mockResolvedValue([]);
    // Servidor lento (4G): a gravacao so confirma bem depois.
    vi.mocked(updateListItems).mockImplementation(() => new Promise(() => undefined));
    vi.mocked(createProduct).mockReturnValue({ id: "leite", written: new Promise(() => undefined) });
  });

  it("alterar quantidade e marcar outro item em seguida preserva as duas edicoes", async () => {
    const { user } = setup();

    const quantity = within(row("Arroz 5kg")).getByLabelText("Quantidade de Arroz 5kg");
    await user.clear(quantity);
    await user.type(quantity, "3");
    // Sem Enter: o clique no checkbox dispara o blur (grava) e depois o clique.
    await user.click(within(row("Café")).getByRole("checkbox"));

    expect(updateListItems).toHaveBeenLastCalledWith("uid-standard", "l1", [
      { ...LIST.items[0], quantity: 3 },
      { ...LIST.items[1], checked: true },
    ]);
  });

  it("duplo toque no mesmo item alterna corretamente", async () => {
    const { user } = setup();
    const checkbox = within(row("Café")).getByRole("checkbox");

    await user.click(checkbox);
    await user.click(checkbox);

    expect(vi.mocked(updateListItems).mock.calls.map(([, , items]) => items[1].checked)).toEqual([true, false]);
  });

  it("produto novo entra na hora sem desfazer marcacoes feitas durante a gravacao", async () => {
    const { user } = setup();
    const form = screen.getByRole("form", { name: "Adicionar item" });

    await user.type(within(form).getByLabelText("Produto"), "Leite");
    await user.click(within(form).getByRole("button", { name: "Adicionar" }));
    expect(await screen.findByRole("row", { name: /Leite/ })).toBeInTheDocument();
    expect(within(form).getByLabelText("Produto")).toHaveValue("");

    await user.click(within(row("Arroz 5kg")).getByRole("checkbox"));
    const [, , items] = vi.mocked(updateListItems).mock.calls.at(-1)!;
    expect(items.map((item) => [item.productId, item.checked])).toEqual([
      ["arroz", true],
      ["cafe", false],
      ["leite", false],
    ]);
  });

  it("dialogo de conclusao fecha se a lista for concluida em outro dispositivo", async () => {
    const { user } = setup();

    await user.click(screen.getByRole("button", { name: "Concluir compra" }));
    await screen.findByRole("dialog");
    // Outro dispositivo conclui: a assinatura da pagina recebe a lista concluida.
    const pushLists = vi.mocked(subscribeToLists).mock.calls[0][1];
    act(() => pushLists([{ ...LIST, status: "concluida", purchaseId: "gx", paidTotal: 10, completedAt: now }]));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(mockedNotify).toHaveBeenCalledWith("warning", "Esta lista já foi concluída em outro dispositivo.");
  });

  it("avisa diferenca entre a soma dos itens e o total pago", async () => {
    const { user } = setup();

    await user.click(screen.getByRole("button", { name: "Concluir compra" }));
    const dialog = await screen.findByRole("dialog");
    await user.clear(within(dialog).getByLabelText("Total pago"));
    await user.type(within(dialog).getByLabelText("Total pago"), "10000");
    await user.type(within(dialog).getByLabelText("Preço pago de Arroz 5kg"), "2590");
    await user.type(within(dialog).getByLabelText("Preço pago de Café"), "820");

    expect(within(dialog).getByRole("status")).toHaveTextContent("A soma dos itens (R$ 60,00) difere do total pago.");
  });

  it("orcamento indisponivel mostra erro em vez de R$ 0,00", async () => {
    vi.mocked(listMonthCosts).mockRejectedValue(Object.assign(new Error("x"), { code: "unavailable" }));
    setup();

    expect(await screen.findByText(/Não foi possível comparar a lista com o orçamento agora/)).toBeInTheDocument();
  });
});
