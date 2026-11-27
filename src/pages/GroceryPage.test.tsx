import { screen, waitFor, within } from "@testing-library/react";
import type { GroceryList } from "@/domain/entities/grocery";
import type { UserRole } from "@/domain/entities/user";
import { notify } from "@/lib/notify";
import GroceryPage from "@/pages/GroceryPage";
import { useSession } from "@/providers/AuthProvider";
import {
  createList,
  deleteList,
  subscribeToLists,
  subscribeToProducts,
} from "@/services/groceryService";
import { makeProfile } from "@/test/factories";
import { renderWithRouter } from "@/test/render";

vi.mock("@/providers/AuthProvider", () => ({ useSession: vi.fn() }));
vi.mock("@/lib/notify", () => ({ notify: vi.fn() }));
vi.mock("@/services/groceryService", () => ({
  subscribeToProducts: vi.fn(),
  subscribeToLists: vi.fn(),
  createList: vi.fn(),
  deleteList: vi.fn(),
}));

const now = new Date(2026, 10, 27, 12);
const OPEN: GroceryList = {
  id: "aberta",
  name: "Feira",
  status: "aberta",
  items: [
    { id: "i1", productId: "arroz", name: "Arroz", quantity: 2, checked: false },
    { id: "i2", productId: "cafe", name: "Café", quantity: 1, checked: false },
  ],
  purchaseId: null,
  paidTotal: null,
  createdAt: now,
  completedAt: null,
};
const DONE: GroceryList = { ...OPEN, id: "feita", name: "Mês passado", status: "concluida", completedAt: now, purchaseId: "g1", paidTotal: 58.4 };

function setup(role: UserRole = "standard", lists: GroceryList[] = [OPEN, DONE]) {
  vi.mocked(useSession).mockReturnValue({ profile: makeProfile(role), firebaseUser: {} as never });
  vi.mocked(subscribeToProducts).mockImplementation((_uid, onData) => {
    onData([
      {
        id: "arroz",
        name: "Arroz",
        normalizedName: "arroz",
        unit: "un",
        lastUnitPrice: 25.9,
        previousUnitPrice: null,
        lastPurchasedAt: now,
        lastStore: "",
        purchaseCount: 1,
        avgIntervalDays: null,
        intervalCount: 0,
        aliases: [],
      },
    ]);
    return () => undefined;
  });
  vi.mocked(subscribeToLists).mockImplementation((_uid, onData) => {
    onData(lists);
    return () => undefined;
  });
  return renderWithRouter(<GroceryPage />, { route: "/grocery", path: "/grocery" });
}

describe("GroceryPage", () => {
  beforeEach(() => {
    vi.mocked(createList).mockReturnValue({ id: "nova", written: Promise.resolve() });
    vi.mocked(deleteList).mockResolvedValue(undefined);
  });

  it("lista abertas com previsao e concluidas com data", () => {
    setup();

    const card = screen.getByRole("region", { name: "Lista Feira" });
    expect(card).toHaveTextContent("2 itens · previsto R$ 51,80 · 1 sem histórico");
    expect(screen.getByText("Mês passado")).toBeInTheDocument();
    expect(screen.getByText(/concluída em 27\/11\/2026 · total pago R\$ 58,40/)).toBeInTheDocument();
  });

  it("cria lista e abre a pagina dela", async () => {
    const { user } = setup();
    const input = screen.getByLabelText("Nome da lista");
    expect((input as HTMLInputElement).value).toMatch(/^Compra de \d{2}\/\d{2}$/);

    await user.clear(input);
    await user.type(input, "Churrasco");
    await user.click(screen.getByRole("button", { name: "Criar lista" }));

    await waitFor(() => expect(createList).toHaveBeenCalledWith("uid-standard", { name: "Churrasco" }));
    expect(screen.getByTestId("location")).toHaveTextContent("/grocery/nova");
  });

  it("usar novamente cria lista com os itens da concluida", async () => {
    const { user } = setup();

    await user.click(screen.getByRole("button", { name: "Usar novamente Mês passado" }));
    await waitFor(() =>
      expect(createList).toHaveBeenCalledWith("uid-standard", {
        name: expect.any(String),
        items: [expect.objectContaining({ productId: "arroz" }), expect.objectContaining({ productId: "cafe" })],
      }),
    );
  });

  it("exclui com confirmacao", async () => {
    const { user } = setup();

    await user.click(screen.getByRole("button", { name: "Excluir Mês passado" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveTextContent("O lançamento e o histórico de preços da compra continuam.");
    await user.click(within(dialog).getByRole("button", { name: "Excluir" }));

    await waitFor(() => expect(deleteList).toHaveBeenCalledWith("uid-standard", "feita"));
    expect(notify).toHaveBeenCalledWith("success", 'Lista "Mês passado" excluída.');
  });

  it("vazio e guest sem acoes", () => {
    setup("guest", []);

    expect(screen.getByText("Nenhuma lista aberta.")).toBeInTheDocument();
    expect(screen.queryByRole("form", { name: "Nova lista" })).not.toBeInTheDocument();
  });
});
