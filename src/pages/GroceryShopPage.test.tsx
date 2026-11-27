import { act, screen, waitFor, within } from "@testing-library/react";
import { Route, Routes } from "react-router";
import type { GroceryList, GroceryProduct } from "@/domain/entities/grocery";
import type { UserRole } from "@/domain/entities/user";
import GroceryShopPage from "@/pages/GroceryShopPage";
import { useSession } from "@/providers/AuthProvider";
import { subscribeToLists, subscribeToProducts, updateListItems } from "@/services/groceryService";
import { makeProfile } from "@/test/factories";
import { renderWithRouter } from "@/test/render";

vi.mock("@/providers/AuthProvider", () => ({ useSession: vi.fn() }));
vi.mock("@/lib/notify", () => ({ notify: vi.fn() }));
vi.mock("@/services/groceryService", () => ({
  subscribeToProducts: vi.fn(),
  subscribeToLists: vi.fn(),
  updateListItems: vi.fn(),
  completeList: vi.fn(),
  findPurchaseByReceiptKey: vi.fn(),
}));

const now = new Date();
const ARROZ: GroceryProduct = {
  id: "arroz",
  name: "Arroz 5kg",
  normalizedName: "arroz 5kg",
  unit: "un",
  lastUnitPrice: 25.9,
  previousUnitPrice: null,
  lastPurchasedAt: now,
  lastStore: "",
  purchaseCount: 1,
  avgIntervalDays: null,
  intervalCount: 0,
  aliases: [],
};
const CAFE: GroceryProduct = { ...ARROZ, id: "cafe", name: "Café", normalizedName: "cafe", lastUnitPrice: null };
const LIST: GroceryList = {
  id: "l1",
  name: "Feira",
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
      <Route path="/grocery/:listId/shop" element={<GroceryShopPage />} />
    </Routes>,
    { route: `/grocery/${list.id}/shop` },
  );
}

const summary = () => screen.getByRole("status", { name: "Resumo do carrinho" });

describe("GroceryShopPage", () => {
  beforeEach(() => {
    // Gravacao pendente (como no 4G do mercado): a tela segue o estado local.
    vi.mocked(updateListItems).mockReturnValue(new Promise(() => undefined));
  });

  afterEach(() => {
    delete (navigator as { wakeLock?: unknown }).wakeLock;
    Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
  });

  it("marca itens grandes e soma o previsto do carrinho em tempo real", async () => {
    const { user } = setup();
    expect(summary()).toHaveTextContent("R$ 0,00");
    expect(summary()).toHaveTextContent("0 de 2 itens · previsto da lista R$ 51,80");

    await user.click(screen.getByRole("checkbox", { name: /Arroz 5kg/ }));
    expect(screen.getByRole("checkbox", { name: /Arroz 5kg/ })).toBeChecked();
    expect(summary()).toHaveTextContent("R$ 51,80");
    expect(updateListItems).toHaveBeenLastCalledWith(expect.any(String), "l1", [
      expect.objectContaining({ id: "i1", checked: true }),
      expect.objectContaining({ id: "i2", checked: false }),
    ]);

    await user.click(screen.getByRole("checkbox", { name: /Café/ }));
    expect(summary()).toHaveTextContent("2 de 2 itens");
    expect(summary()).toHaveTextContent("1 item sem histórico fora da soma");
    expect(screen.getByRole("button", { name: "Concluir compra" })).toBeEnabled();
  });

  it("sem conexao avisa que as marcacoes sincronizam depois", async () => {
    setup();
    expect(screen.queryByText(/Sem conexão/)).not.toBeInTheDocument();

    act(() => {
      Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
      window.dispatchEvent(new Event("offline"));
    });
    expect(screen.getByText(/Sem conexão: as marcações ficam salvas no aparelho/)).toBeInTheDocument();

    act(() => {
      Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
      window.dispatchEvent(new Event("online"));
    });
    expect(screen.queryByText(/Sem conexão/)).not.toBeInTheDocument();
  });

  it("mantem a tela ligada e solta ao sair", async () => {
    const release = vi.fn(async () => undefined);
    const request = vi.fn(async () => ({ released: false, release, addEventListener: vi.fn() }));
    Object.defineProperty(navigator, "wakeLock", { configurable: true, value: { request } });

    const { unmount } = setup();
    expect(await screen.findByText("Tela mantida ligada")).toBeInTheDocument();
    expect(request).toHaveBeenCalledWith("screen");

    unmount();
    await waitFor(() => expect(release).toHaveBeenCalled());
  });

  it("wake lock negado nao quebra a tela", async () => {
    Object.defineProperty(navigator, "wakeLock", {
      configurable: true,
      value: { request: vi.fn(async () => Promise.reject(new Error("NotAllowedError"))) },
    });
    setup();
    await waitFor(() => expect(screen.getByRole("checkbox", { name: /Arroz 5kg/ })).toBeInTheDocument());
    expect(screen.queryByText("Tela mantida ligada")).not.toBeInTheDocument();
  });

  it("guest e lista concluida ficam somente para consulta", () => {
    setup("guest");
    expect(screen.getByRole("checkbox", { name: /Arroz 5kg/ })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Concluir compra" })).not.toBeInTheDocument();
  });

  it("lista concluida mostra aviso", () => {
    setup("standard", { ...LIST, status: "concluida", purchaseId: "g1", paidTotal: 50, completedAt: now });
    expect(screen.getByText(/já foi concluída/)).toBeInTheDocument();
    expect(within(screen.getByRole("list", { name: "Itens da lista" })).getAllByRole("checkbox")[0]).toBeDisabled();
  });
});
