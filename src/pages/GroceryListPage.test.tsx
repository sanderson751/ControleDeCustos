import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { Route, Routes } from "react-router";
import type { GroceryList, GroceryProduct } from "@/domain/entities/grocery";
import type { UserRole } from "@/domain/entities/user";
import { notify } from "@/lib/notify";
import { readReceipt, ReceiptReadCancelled } from "@/lib/receiptReader";
import GroceryListPage from "@/pages/GroceryListPage";
import { useSession } from "@/providers/AuthProvider";
import { listMonthBudgets, listRecurringBudgets } from "@/services/budgetService";
import { listMonthCosts } from "@/services/costService";
import {
  completeList,
  createList,
  findPurchaseByReceiptKey,
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
  findPurchaseByReceiptKey: vi.fn(),
}));
vi.mock("@/lib/receiptReader", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  readReceipt: vi.fn(),
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

function setup(role: UserRole = "standard", list: GroceryList = LIST, products: GroceryProduct[] = [ARROZ, CAFE]) {
  vi.mocked(useSession).mockReturnValue({ profile: makeProfile(role), firebaseUser: {} as never });
  vi.mocked(subscribeToProducts).mockImplementation((_uid, onData) => {
    onData(products);
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
      ], expect.any(Array), []),
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
    ], expect.any(Array), []);
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
    ], expect.any(Array), []);

    const quantity = within(row("Arroz 5kg")).getByLabelText("Quantidade de Arroz 5kg");
    await user.clear(quantity);
    await user.type(quantity, "4{Enter}");
    expect(updateListItems).toHaveBeenLastCalledWith("uid-standard", "l1", [
      { ...LIST.items[0], quantity: 4 },
      LIST.items[1],
    ], expect.any(Array), []);

    await user.click(within(row("Café")).getByRole("button", { name: "Remover Café" }));
    expect(updateListItems).toHaveBeenLastCalledWith("uid-standard", "l1", [LIST.items[0]], expect.any(Array), []);
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
    ], expect.any(Array), []);
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

describe("GroceryListPage - inteligencia", () => {
  beforeEach(() => {
    vi.mocked(listMonthCosts).mockResolvedValue([]);
    vi.mocked(listMonthBudgets).mockResolvedValue([]);
    vi.mocked(listRecurringBudgets).mockResolvedValue([]);
    vi.mocked(updateListItems).mockReturnValue(new Promise(() => undefined));
  });

  it("mostra a variacao do preco ao lado do previsto", () => {
    setup("standard", LIST, [{ ...ARROZ, previousUnitPrice: 23 }, CAFE]);
    expect(within(row("Arroz 5kg")).getByText("+12,6%")).toBeInTheDocument();
    expect(within(row("Arroz 5kg")).getByText(/Preço subiu/)).toBeInTheDocument();
  });

  it("sugere repor produtos perto do fim e adiciona a lista", async () => {
    const day = 24 * 60 * 60 * 1000;
    const LEITE: GroceryProduct = {
      ...ARROZ,
      id: "leite",
      name: "Leite",
      normalizedName: "leite",
      lastUnitPrice: 4.79,
      purchaseCount: 4,
      avgIntervalDays: 7,
      intervalCount: 3,
      lastPurchasedAt: new Date(Date.now() - 9 * day),
    };
    const { user } = setup("standard", LIST, [ARROZ, CAFE, LEITE]);

    const card = screen.getByRole("region", { name: "Talvez esteja acabando" });
    expect(card).toHaveTextContent("comprado a cada ~7 dias · última há 9 dias · último R$ 4,79");
    await user.click(within(card).getByRole("button", { name: "Adicionar Leite à lista" }));

    expect(updateListItems).toHaveBeenLastCalledWith(
      expect.any(String),
      "l1",
      expect.arrayContaining([expect.objectContaining({ productId: "leite", quantity: 1 })]),
      expect.any(Array), [],
    );
    expect(mockedNotify).toHaveBeenCalledWith("success", "Leite adicionado à lista.");
    // Ja na lista: some das sugestoes.
    expect(screen.queryByRole("region", { name: "Talvez esteja acabando" })).not.toBeInTheDocument();
  });

  it("concluir sem sinal salva no aparelho, fecha o dialogo e avisa", async () => {
    vi.mocked(completeList).mockReturnValueOnce(new Promise(() => undefined));
    Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
    try {
      const { user } = setup();
      await user.click(screen.getByRole("button", { name: "Concluir compra" }));
      const dialog = await screen.findByRole("dialog");
      await user.click(within(dialog).getByRole("button", { name: "Concluir e lançar" }));

      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
      expect(mockedNotify).toHaveBeenCalledWith(
        "warning",
        "Sem conexão: a compra de R$ 51,80 foi salva no aparelho e o lançamento sincroniza quando a conexão voltar.",
      );
    } finally {
      Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
    }
  });

  it("abre o modo mercado", () => {
    setup();
    expect(screen.getByRole("link", { name: "Modo mercado" })).toHaveAttribute("href", "/grocery/l1/shop");
  });

  it("guest nao recebe sugestoes de reposicao", () => {
    setup("guest", LIST, [
      { ...ARROZ, id: "leite", name: "Leite", purchaseCount: 3, avgIntervalDays: 1, lastPurchasedAt: new Date(2020, 0, 1) },
    ]);
    expect(screen.queryByRole("region", { name: "Talvez esteja acabando" })).not.toBeInTheDocument();
  });
});

describe("GroceryListPage - foto da comanda", () => {
  const RECEIPT = [
    "ASSAI ATACADISTA",
    "CNPJ: 06.057.223/0001-71",
    "001 7896006716112 ARROZ TIPO 1 TIO JOAO 5KG 2 UN X 25,90 51,80",
    "002 7891910000197 PO DE CAFE SAO BRAZ 500G 1 UN X 17,50 17,50",
    "003 7891024134702 DETERGENTE YPE 500ML 3 UN X 2,79 8,37",
    "VALOR A PAGAR R$ 77,67",
    "Emissao 26/11/2026 18:32:10",
  ].join("\n");

  beforeEach(() => {
    vi.mocked(listMonthCosts).mockResolvedValue([]);
    vi.mocked(listMonthBudgets).mockResolvedValue([]);
    vi.mocked(listRecurringBudgets).mockResolvedValue([]);
    vi.mocked(completeList).mockResolvedValue({ costEntryId: "c1", purchaseId: "g1" });
    vi.mocked(findPurchaseByReceiptKey).mockResolvedValue(null);
    vi.mocked(readReceipt).mockImplementation(async (_file, options) => {
      options?.onProgress?.(0.5, "recognizing");
      return { text: RECEIPT, confidence: 88, qrAccessKey: null };
    });
  });

  async function openAndRead() {
    const result = setup();
    await result.user.click(screen.getByRole("button", { name: "Concluir compra" }));
    const dialog = await screen.findByRole("dialog");
    await result.user.upload(
      within(dialog).getByLabelText("Foto da comanda"),
      new File(["imagem"], "comanda.jpg", { type: "image/jpeg" }),
    );
    return { ...result, dialog };
  }

  it("preenche loja, data, total e precos; revisao associa os itens", async () => {
    const { dialog } = await openAndRead();

    await waitFor(() => expect(within(dialog).getByLabelText("Total pago")).toHaveValue("R$ 77,67"));
    expect(within(dialog).getByLabelText("Loja")).toHaveValue("ASSAI ATACADISTA");
    expect(within(dialog).getByLabelText("Data da compra")).toHaveValue("2026-11-26");
    expect(within(dialog).getByLabelText("Preço pago de Arroz 5kg")).toHaveValue("R$ 25,90");
    expect(within(dialog).getByLabelText("Destino de ARROZ TIPO 1 TIO JOAO 5KG")).toHaveValue("list:i1");
    expect(within(dialog).getByLabelText("Destino de DETERGENTE YPE 500ML")).toHaveValue("ignore");
    expect(mockedNotify).toHaveBeenCalledWith("success", "Comanda lida: 3 itens. Confira antes de concluir.");
  });

  it("concluir com a leitura grava chave, apelidos e produto novo", async () => {
    const { user, dialog } = await openAndRead();
    await waitFor(() => expect(within(dialog).getByLabelText("Total pago")).toHaveValue("R$ 77,67"));

    // Café não foi reconhecido sozinho (nome diferente): associa à lista; detergente vira produto novo.
    await user.selectOptions(within(dialog).getByLabelText("Destino de PO DE CAFE SAO BRAZ 500G"), "list:i2");
    expect(within(dialog).getByLabelText("Preço pago de Café")).toHaveValue("R$ 17,50");
    await user.selectOptions(within(dialog).getByLabelText("Destino de DETERGENTE YPE 500ML"), "new");
    await user.click(within(dialog).getByRole("button", { name: "Concluir e lançar" }));

    await waitFor(() => expect(completeList).toHaveBeenCalled());
    const [, , plan] = vi.mocked(completeList).mock.calls[0];
    expect(plan.cost).toMatchObject({ accountName: "Mercado — ASSAI ATACADISTA", amount: 77.67 });
    // Chave pelo CNPJ do emissor + dia + total.
    expect(plan.receipt).toEqual({ key: "h-06057223000171-20261126-7767", confidence: 88 });
    // Arroz foi sugestão automática sem certeza (não vira apelido); café foi escolhido pelo usuário.
    expect(plan.productUpdates.map((item) => [item.productId, item.lastUnitPrice, item.aliases[0]])).toEqual([
      ["arroz", 25.9, undefined],
      ["cafe", 17.5, "podecafesaobraz500g"],
    ]);
    expect(plan.newProducts).toEqual([
      expect.objectContaining({ name: "Detergente Ype 500ml", lastUnitPrice: 2.79 }),
    ]);
  });

  it("comanda ja lancada bloqueia a conclusao ate descartar a leitura", async () => {
    vi.mocked(findPurchaseByReceiptKey).mockResolvedValue({ id: "g0", purchasedAt: new Date(2026, 10, 26), total: 77.67 });
    const { user, dialog } = await openAndRead();

    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Esta comanda já foi lançada em 26/11/2026");
    await user.click(within(dialog).getByRole("button", { name: "Concluir e lançar" }));
    expect(completeList).not.toHaveBeenCalled();

    await user.click(within(dialog).getByRole("button", { name: "Descartar leitura" }));
    await user.click(within(dialog).getByRole("button", { name: "Concluir e lançar" }));
    await waitFor(() => expect(completeList).toHaveBeenCalled());
    expect(vi.mocked(completeList).mock.calls[0][2].receipt).toBeNull();
  });

  it("descartar a leitura volta os valores de antes, mas preserva o que o usuario editou", async () => {
    const { user, dialog } = await openAndRead();
    await waitFor(() => expect(within(dialog).getByLabelText("Total pago")).toHaveValue("R$ 77,67"));

    await user.clear(within(dialog).getByLabelText("Loja"));
    await user.type(within(dialog).getByLabelText("Loja"), "Assaí Penha");
    await user.click(within(dialog).getByRole("button", { name: "Descartar leitura" }));

    // Total previsto volta; loja editada fica; preço lido sai.
    expect(within(dialog).getByLabelText("Total pago")).toHaveValue("R$ 51,80");
    expect(within(dialog).getByLabelText("Loja")).toHaveValue("Assaí Penha");
    expect(within(dialog).getByLabelText("Preço pago de Arroz 5kg")).toHaveValue("");
    expect(within(dialog).queryByRole("list", { name: "Itens lidos na comanda" })).not.toBeInTheDocument();
  });

  it("tirar uma linha do item da lista volta o preco; preco editado a mao e mantido", async () => {
    const { user, dialog } = await openAndRead();
    await waitFor(() => expect(within(dialog).getByLabelText("Preço pago de Arroz 5kg")).toHaveValue("R$ 25,90"));

    await user.selectOptions(within(dialog).getByLabelText("Destino de ARROZ TIPO 1 TIO JOAO 5KG"), "ignore");
    expect(within(dialog).getByLabelText("Preço pago de Arroz 5kg")).toHaveValue("");

    await user.selectOptions(within(dialog).getByLabelText("Destino de ARROZ TIPO 1 TIO JOAO 5KG"), "list:i1");
    expect(within(dialog).getByLabelText("Preço pago de Arroz 5kg")).toHaveValue("R$ 25,90");

    await user.clear(within(dialog).getByLabelText("Preço pago de Arroz 5kg"));
    await user.type(within(dialog).getByLabelText("Preço pago de Arroz 5kg"), "2600");
    await user.selectOptions(within(dialog).getByLabelText("Destino de ARROZ TIPO 1 TIO JOAO 5KG"), "ignore");
    expect(within(dialog).getByLabelText("Preço pago de Arroz 5kg")).toHaveValue("R$ 26,00");
  });

  it("data corrigida na revisao gera nova chave e confere duplicidade de novo", async () => {
    const { user, dialog } = await openAndRead();
    await waitFor(() => expect(within(dialog).getByLabelText("Total pago")).toHaveValue("R$ 77,67"));
    vi.mocked(findPurchaseByReceiptKey).mockResolvedValue({ id: "g0", purchasedAt: new Date(2026, 10, 25), total: 77.67 });

    const dateInput = within(dialog).getByLabelText("Data da compra");
    fireEvent.change(dateInput, { target: { value: "2026-11-25" } });
    await user.click(within(dialog).getByRole("button", { name: "Concluir e lançar" }));

    await waitFor(() =>
      expect(findPurchaseByReceiptKey).toHaveBeenLastCalledWith(expect.any(String), "h-06057223000171-20261125-7767"),
    );
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Esta comanda já foi lançada em 25/11/2026");
    expect(completeList).not.toHaveBeenCalled();
  });

  it("comanda lancada em outro aparelho no mesmo instante: a gravacao falha e avisa a duplicidade", async () => {
    vi.mocked(completeList).mockRejectedValueOnce(Object.assign(new Error("denied"), { code: "permission-denied" }));
    const { user, dialog } = await openAndRead();
    await waitFor(() => expect(within(dialog).getByLabelText("Total pago")).toHaveValue("R$ 77,67"));
    vi.mocked(findPurchaseByReceiptKey).mockResolvedValue({ id: "g0", purchasedAt: new Date(2026, 10, 26), total: 77.67 });

    await user.click(within(dialog).getByRole("button", { name: "Concluir e lançar" }));

    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Esta comanda já foi lançada em 26/11/2026");
    expect(mockedNotify).toHaveBeenCalledWith("warning", expect.stringContaining("Descarte a leitura"));
  });

  it("leitura pode ser cancelada", async () => {
    vi.mocked(readReceipt).mockImplementationOnce(
      (_file, options) =>
        new Promise((_, reject) => {
          options?.signal?.addEventListener("abort", () => reject(new ReceiptReadCancelled()));
        }),
    );
    const { user, dialog } = await openAndRead();

    expect(within(dialog).getByText(/Preparando a leitura/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Cancelar leitura" }));

    await waitFor(() => expect(mockedNotify).toHaveBeenCalledWith("warning", "Leitura da comanda cancelada."));
    expect(within(dialog).getByRole("button", { name: "Fotografar comanda" })).toBeEnabled();
  });

  it("progresso que chega depois do cancelamento nao trava o dialogo", async () => {
    vi.mocked(readReceipt).mockImplementationOnce(
      (_file, options) =>
        new Promise((_, reject) => {
          options?.signal?.addEventListener("abort", () => {
            reject(new ReceiptReadCancelled());
            // Carga do OCR ainda em andamento emite progresso.
            setTimeout(() => options.onProgress?.(0.2, "preparing"), 0);
          });
        }),
    );
    const { user, dialog } = await openAndRead();
    await user.click(within(dialog).getByRole("button", { name: "Cancelar leitura" }));

    await waitFor(() => expect(mockedNotify).toHaveBeenCalledWith("warning", "Leitura da comanda cancelada."));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(within(dialog).queryByText(/Preparando a leitura/)).not.toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Concluir e lançar" })).toBeEnabled();
    expect(within(dialog).getByLabelText("Total pago")).toBeEnabled();
  });

  it("comanda sem data legivel nao gera chave (a data padrao nao identifica a compra)", async () => {
    vi.mocked(readReceipt).mockResolvedValueOnce({
      text: RECEIPT.replace("Emissao 26/11/2026 18:32:10", ""),
      confidence: 88,
      qrAccessKey: null,
    });
    const { user, dialog } = await openAndRead();
    await waitFor(() => expect(within(dialog).getByLabelText("Total pago")).toHaveValue("R$ 77,67"));
    expect(findPurchaseByReceiptKey).not.toHaveBeenCalled();

    await user.click(within(dialog).getByRole("button", { name: "Concluir e lançar" }));
    await waitFor(() => expect(completeList).toHaveBeenCalled());
    expect(vi.mocked(completeList).mock.calls[0][2].receipt).toEqual({ key: null, confidence: 88 });
  });

  it("duplicidade marcada: corrigir o total gera outra chave e libera a conclusao", async () => {
    vi.mocked(findPurchaseByReceiptKey).mockResolvedValueOnce({ id: "g0", purchasedAt: new Date(2026, 10, 26), total: 77.67 });
    const { user, dialog } = await openAndRead();
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Esta comanda já foi lançada");

    await user.clear(within(dialog).getByLabelText("Total pago"));
    await user.type(within(dialog).getByLabelText("Total pago"), "7867");
    await user.click(within(dialog).getByRole("button", { name: "Concluir e lançar" }));

    await waitFor(() => expect(completeList).toHaveBeenCalled());
    expect(findPurchaseByReceiptKey).toHaveBeenLastCalledWith(expect.any(String), "h-06057223000171-20261126-7867");
  });

  it("foto ilegivel ou falha na leitura avisam e mantem o preenchimento manual", async () => {
    vi.mocked(readReceipt).mockResolvedValueOnce({ text: "???", confidence: 12, qrAccessKey: null });
    const { user, dialog } = await openAndRead();

    await waitFor(() =>
      expect(mockedNotify).toHaveBeenCalledWith("warning", expect.stringContaining("Não foi possível ler a comanda")),
    );
    expect(within(dialog).queryByRole("list", { name: "Itens lidos na comanda" })).not.toBeInTheDocument();

    vi.mocked(readReceipt).mockRejectedValueOnce(new Error("wasm"));
    await user.upload(within(dialog).getByLabelText("Foto da comanda"), new File(["x"], "b.jpg", { type: "image/jpeg" }));
    await waitFor(() =>
      expect(mockedNotify).toHaveBeenCalledWith("error", "Não foi possível ler a foto da comanda. Preencha os valores manualmente."),
    );
  });
});
