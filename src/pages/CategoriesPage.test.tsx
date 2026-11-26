import { screen, waitFor, within } from "@testing-library/react";
import type { UserRole } from "@/domain/entities/user";
import { MAX_CUSTOM_CATEGORIES } from "@/domain/entities/category";
import { buildCategoryCatalog } from "@/domain/rules/categoryRules";
import { notify } from "@/lib/notify";
import CategoriesPage from "@/pages/CategoriesPage";
import { useSession } from "@/providers/AuthProvider";
import { useCategories } from "@/providers/CategoriesProvider";
import {
  createCategory,
  renameCategory,
  setCategoryArchived,
} from "@/services/categoryService";
import { makeProfile } from "@/test/factories";
import { renderWithRouter } from "@/test/render";

vi.mock("@/providers/AuthProvider", () => ({ useSession: vi.fn() }));
vi.mock("@/providers/CategoriesProvider", () => ({ useCategories: vi.fn() }));
vi.mock("@/lib/notify", () => ({ notify: vi.fn() }));
vi.mock("@/services/categoryService", () => ({
  createCategory: vi.fn(),
  renameCategory: vi.fn(),
  setCategoryArchived: vi.fn(),
}));

const mockedNotify = vi.mocked(notify);
const CUSTOMS = [
  { id: "pets1", name: "Pets", archived: false },
  { id: "old1", name: "Assinaturas", archived: true },
];

function setup(
  role: UserRole = "standard",
  customs = CUSTOMS,
  status: { isLoading?: boolean; error?: string | null } = {},
) {
  vi.mocked(useSession).mockReturnValue({
    profile: makeProfile(role),
    firebaseUser: {} as never,
  });
  vi.mocked(useCategories).mockReturnValue({
    catalog: buildCategoryCatalog(customs),
    customs,
    isLoading: status.isLoading ?? false,
    error: status.error ?? null,
  });
  return renderWithRouter(<CategoriesPage />);
}

function rowOf(name: string) {
  return screen.getByRole("row", { name: new RegExp(name) });
}

describe("CategoriesPage", () => {
  beforeEach(() => {
    vi.mocked(createCategory).mockResolvedValue("novo");
    vi.mocked(renameCategory).mockResolvedValue(undefined);
    vi.mocked(setCategoryArchived).mockResolvedValue(undefined);
  });

  it("lista padrao (somente leitura) e personalizadas com situacao", () => {
    setup();

    expect(within(rowOf("Moradia")).getByText("Padrão")).toBeInTheDocument();
    expect(
      within(rowOf("Moradia")).queryByRole("button"),
    ).not.toBeInTheDocument();
    expect(within(rowOf("Pets")).getByText("Ativa")).toBeInTheDocument();
    expect(within(rowOf("Assinaturas")).getByText("Arquivada")).toBeInTheDocument();
    expect(
      screen.getByText(`2 de ${MAX_CUSTOM_CATEGORIES} categorias personalizadas em uso.`),
    ).toBeInTheDocument();
  });

  it("cria categoria com nome normalizado e limpa o campo", async () => {
    const { user } = setup();
    const input = screen.getByLabelText("Nome");

    await user.type(input, "  Filhos  ");
    await user.click(screen.getByRole("button", { name: "Adicionar categoria" }));

    await waitFor(() =>
      expect(createCategory).toHaveBeenCalledWith("uid-standard", "Filhos"),
    );
    expect(mockedNotify).toHaveBeenCalledWith(
      "success",
      'Categoria "Filhos" criada com sucesso.',
    );
    expect(input).toHaveValue("");
  });

  it("avisa nome vazio ou duplicado sem gravar", async () => {
    const { user } = setup();

    await user.click(screen.getByRole("button", { name: "Adicionar categoria" }));
    expect(mockedNotify).toHaveBeenCalledWith(
      "warning",
      "Informe o nome da categoria.",
    );

    await user.type(screen.getByLabelText("Nome"), "lazer");
    await user.click(screen.getByRole("button", { name: "Adicionar categoria" }));
    expect(mockedNotify).toHaveBeenCalledWith(
      "warning",
      'Já existe uma categoria chamada "Lazer".',
    );
    expect(createCategory).not.toHaveBeenCalled();
  });

  it("bloqueia a criacao ao atingir o limite", async () => {
    const many = Array.from({ length: MAX_CUSTOM_CATEGORIES }, (_, index) => ({
      id: `c${index}`,
      name: `Cat ${index}`,
      archived: false,
    }));
    const { user } = setup("standard", many);

    await user.type(screen.getByLabelText("Nome"), "Mais uma");
    await user.click(screen.getByRole("button", { name: "Adicionar categoria" }));

    expect(mockedNotify).toHaveBeenCalledWith(
      "warning",
      expect.stringContaining(`limite de ${MAX_CUSTOM_CATEGORIES}`),
    );
    expect(createCategory).not.toHaveBeenCalled();
  });

  it("mostra erro amigavel quando a criacao falha", async () => {
    vi.mocked(createCategory).mockRejectedValueOnce(
      Object.assign(new Error("x"), { code: "permission-denied" }),
    );
    const { user } = setup();

    await user.type(screen.getByLabelText("Nome"), "Filhos");
    await user.click(screen.getByRole("button", { name: "Adicionar categoria" }));

    await waitFor(() =>
      expect(mockedNotify).toHaveBeenCalledWith("error", expect.any(String)),
    );
    expect(screen.getByLabelText("Nome")).toHaveValue("Filhos");
  });

  it("renomeia pelo dialogo", async () => {
    const { user } = setup();

    await user.click(screen.getByRole("button", { name: "Renomear Pets" }));
    const dialog = await screen.findByRole("dialog");
    const input = within(dialog).getByLabelText("Nome");
    await user.clear(input);
    await user.type(input, "Animais");
    await user.click(within(dialog).getByRole("button", { name: "Salvar" }));

    await waitFor(() =>
      expect(renameCategory).toHaveBeenCalledWith("uid-standard", "pets1", "Animais"),
    );
    expect(mockedNotify).toHaveBeenCalledWith(
      "success",
      "Categoria renomeada com sucesso.",
    );
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
  });

  it("renomear para nome de outra categoria e recusado", async () => {
    const { user } = setup();

    await user.click(screen.getByRole("button", { name: "Renomear Pets" }));
    const dialog = await screen.findByRole("dialog");
    const input = within(dialog).getByLabelText("Nome");
    await user.clear(input);
    await user.type(input, "assinaturas");
    await user.click(within(dialog).getByRole("button", { name: "Salvar" }));

    expect(mockedNotify).toHaveBeenCalledWith(
      "warning",
      'Já existe uma categoria chamada "Assinaturas".',
    );
    expect(renameCategory).not.toHaveBeenCalled();
  });

  it("arquiva e reativa categorias personalizadas", async () => {
    const { user } = setup();

    await user.click(screen.getByRole("button", { name: "Arquivar Pets" }));
    await waitFor(() =>
      expect(setCategoryArchived).toHaveBeenCalledWith("uid-standard", "pets1", true),
    );

    await user.click(screen.getByRole("button", { name: "Reativar Assinaturas" }));
    await waitFor(() =>
      expect(setCategoryArchived).toHaveBeenCalledWith("uid-standard", "old1", false),
    );
    expect(mockedNotify).toHaveBeenCalledWith(
      "success",
      'Categoria "Assinaturas" reativada.',
    );
  });

  it("guest apenas visualiza", () => {
    setup("guest");

    expect(screen.queryByLabelText("Nome")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Renomear|Arquivar/ })).toBeNull();
    expect(screen.getByText("Pets")).toBeInTheDocument();
  });
});

describe("CategoriesPage - catalogo indisponivel", () => {
  it("bloqueia a criacao enquanto carrega", () => {
    setup("standard", [], { isLoading: true });

    expect(screen.getByLabelText("Nome")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Adicionar categoria" })).toBeDisabled();
    expect(screen.getByText("Carregando categorias...")).toBeInTheDocument();
  });

  it("bloqueia a criacao e exibe o erro quando a assinatura falha", () => {
    setup("standard", [], { error: "Sem permissão." });

    expect(screen.getByLabelText("Nome")).toBeDisabled();
    expect(screen.getByRole("alert")).toHaveTextContent("Sem permissão.");
    expect(createCategory).not.toHaveBeenCalled();
  });
});
