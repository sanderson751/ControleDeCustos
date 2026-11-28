import { screen, waitFor, within } from "@testing-library/react";
import type { GroceryInvite, GroceryList } from "@/domain/entities/grocery";
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
import { refreshEmailVerification, sendVerificationEmail } from "@/services/authService";
import {
  acceptInvite,
  declineInvite,
  listShareCleanup,
  subscribeToMyInvites,
  subscribeToSharedLists,
} from "@/services/groceryShareService";
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
vi.mock("@/services/groceryShareService", () => ({
  subscribeToSharedLists: vi.fn(),
  subscribeToMyInvites: vi.fn(),
  acceptInvite: vi.fn(),
  declineInvite: vi.fn(),
  listShareCleanup: vi.fn(),
}));
vi.mock("@/services/authService", () => ({
  sendVerificationEmail: vi.fn(),
  refreshEmailVerification: vi.fn(),
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

function setup(
  role: UserRole = "standard",
  lists: GroceryList[] = [OPEN, DONE],
  share: { verified?: boolean; invites?: GroceryInvite[]; shared?: GroceryList[] } = {},
) {
  vi.mocked(useSession).mockReturnValue({
    profile: makeProfile(role),
    firebaseUser: { email: `${role}@exemplo.com`, emailVerified: share.verified ?? true } as never,
  });
  vi.mocked(subscribeToSharedLists).mockImplementation((_uid, onData) => {
    onData(share.shared ?? []);
    return () => undefined;
  });
  vi.mocked(subscribeToMyInvites).mockImplementation((_email, onData) => {
    onData(share.invites ?? []);
    return () => undefined;
  });
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
    vi.mocked(listShareCleanup).mockResolvedValue({ inviteIds: [], memberUids: [], complete: true });
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

    await waitFor(() =>
      expect(deleteList).toHaveBeenCalledWith("uid-standard", "feita", { inviteIds: [], memberUids: [] }),
    );
    expect(notify).toHaveBeenCalledWith("success", 'Lista "Mês passado" excluída.');
  });

  it("vazio e guest sem acoes", () => {
    setup("guest", []);

    expect(screen.getByText("Nenhuma lista aberta.")).toBeInTheDocument();
    expect(screen.queryByRole("form", { name: "Nova lista" })).not.toBeInTheDocument();
  });
});

describe("GroceryPage - compartilhamento", () => {
  const INVITE: GroceryInvite = {
    id: "uid-ana_l9_standard@exemplo.com",
    ownerId: "uid-ana",
    ownerName: "Ana",
    ownerEmail: "ana@exemplo.com",
    listId: "l9",
    listName: "Churrasco",
    email: "standard@exemplo.com",
    status: "pendente",
    memberUid: null,
    createdAt: now,
  };

  beforeEach(() => {
    vi.mocked(acceptInvite).mockResolvedValue(undefined);
    vi.mocked(declineInvite).mockResolvedValue(undefined);
    vi.mocked(deleteList).mockResolvedValue(undefined);
  });

  it("aceita convite e abre a lista compartilhada", async () => {
    const { user } = setup("standard", [], { invites: [INVITE] });
    const card = screen.getByRole("region", { name: "Convites para listas" });
    expect(card).toHaveTextContent('Ana (ana@exemplo.com) convidou você para a lista "Churrasco"');

    await user.click(within(card).getByRole("button", { name: "Aceitar convite para Churrasco" }));

    await waitFor(() =>
      expect(acceptInvite).toHaveBeenCalledWith(INVITE, {
        uid: "uid-standard",
        name: expect.any(String),
        email: "standard@exemplo.com",
      }),
    );
    expect(vi.mocked(notify)).toHaveBeenCalledWith("success", 'Você agora participa da lista "Churrasco".');
  });

  it("recusa convite", async () => {
    const { user } = setup("standard", [], { invites: [INVITE] });
    await user.click(screen.getByRole("button", { name: "Recusar convite para Churrasco" }));
    await waitFor(() => expect(declineInvite).toHaveBeenCalledWith(INVITE.id));
  });

  it("sem e-mail confirmado nao busca convites e oferece a confirmacao", async () => {
    vi.mocked(sendVerificationEmail).mockResolvedValue(undefined);
    vi.mocked(refreshEmailVerification).mockResolvedValue(false);
    const { user } = setup("standard", [], { verified: false, invites: [INVITE] });

    expect(subscribeToMyInvites).not.toHaveBeenCalled();
    const card = screen.getByRole("region", { name: "Confirme seu e-mail para receber convites" });
    await user.click(within(card).getByRole("button", { name: "Enviar e-mail de confirmação" }));
    await waitFor(() =>
      expect(vi.mocked(notify)).toHaveBeenCalledWith("success", "Enviamos o link de confirmação para standard@exemplo.com."),
    );

    await user.click(within(card).getByRole("button", { name: "Já confirmei" }));
    await waitFor(() =>
      expect(vi.mocked(notify)).toHaveBeenCalledWith(
        "warning",
        "O e-mail ainda não foi confirmado. Abra o link que enviamos.",
      ),
    );

    vi.mocked(refreshEmailVerification).mockResolvedValue(true);
    await user.click(within(card).getByRole("button", { name: "Já confirmei" }));
    await waitFor(() => expect(subscribeToMyInvites).toHaveBeenCalledWith("standard@exemplo.com", expect.any(Function), expect.any(Function)));
    expect(await screen.findByRole("region", { name: "Convites para listas" })).toBeInTheDocument();
  });

  it("mostra listas compartilhadas comigo e quantos participam das minhas", () => {
    const shared: GroceryList = { ...OPEN, id: "l9", name: "Churrasco", ownerId: "uid-ana", ownerName: "Ana" };
    setup("standard", [{ ...OPEN, memberIds: ["uid-bia", "uid-caio"] }], { shared: [shared] });

    const card = screen.getByRole("region", { name: "Lista compartilhada Churrasco" });
    expect(card).toHaveTextContent("De Ana · 2 itens");
    expect(within(card).getByRole("link", { name: "Abrir lista" })).toHaveAttribute(
      "href",
      "/grocery/compartilhada/uid-ana/l9",
    );
    expect(screen.getByRole("region", { name: "Lista Feira" })).toHaveTextContent("compartilhada com 2 pessoas");
  });

  it("aceite negado (lista concluida, excluida ou cheia): mensagem especifica", async () => {
    vi.mocked(acceptInvite).mockRejectedValueOnce(Object.assign(new Error("denied"), { code: "permission-denied" }));
    const { user } = setup("standard", [], { invites: [INVITE] });
    await user.click(screen.getByRole("button", { name: "Aceitar convite para Churrasco" }));
    await waitFor(() =>
      expect(vi.mocked(notify)).toHaveBeenCalledWith(
        "error",
        "Não foi possível aceitar: a lista foi concluída, excluída, está cheia ou o convite foi cancelado. Você pode recusar o convite.",
      ),
    );
  });

  it("sem sinal nao tenta aceitar", async () => {
    Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
    try {
      const { user } = setup("standard", [], { invites: [INVITE] });
      await user.click(screen.getByRole("button", { name: "Aceitar convite para Churrasco" }));
      expect(acceptInvite).not.toHaveBeenCalled();
      expect(vi.mocked(notify)).toHaveBeenCalledWith("warning", "Sem conexão: conecte-se para responder ao convite.");
    } finally {
      Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
    }
  });

  it("sem conferir os convites, nao exclui lista com participantes", async () => {
    vi.mocked(listShareCleanup).mockResolvedValue({ inviteIds: [], memberUids: ["uid-bia"], complete: false });
    const { user } = setup("standard", [{ ...OPEN, memberIds: ["uid-bia"] }]);

    await user.click(screen.getByRole("button", { name: "Excluir Feira" }));
    await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Excluir" }));

    await waitFor(() =>
      expect(vi.mocked(notify)).toHaveBeenCalledWith(
        "error",
        "Não foi possível conferir os convites da lista compartilhada. Verifique a conexão e tente novamente.",
      ),
    );
    expect(deleteList).not.toHaveBeenCalled();
  });

  it("excluir lista compartilhada leva convites e acessos no mesmo lote", async () => {
    vi.mocked(listShareCleanup).mockResolvedValue({ inviteIds: ["aberta_bia@x.com"], memberUids: ["uid-bia"], complete: true });
    const shared = { ...OPEN, memberIds: ["uid-bia"] };
    const { user } = setup("standard", [shared]);

    await user.click(screen.getByRole("button", { name: "Excluir Feira" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveTextContent("será removida também para quem participa dela");
    await user.click(within(dialog).getByRole("button", { name: "Excluir" }));

    await waitFor(() =>
      expect(deleteList).toHaveBeenCalledWith("uid-standard", "aberta", {
        inviteIds: ["aberta_bia@x.com"],
        memberUids: ["uid-bia"],
      }),
    );
  });
});
