import { screen, waitFor } from "@testing-library/react";
import { AppShell } from "@/components/layout/AppShell";
import type { UserRole } from "@/domain/entities/user";
import { notify } from "@/lib/notify";
import { useSession } from "@/providers/AuthProvider";
import { ThemeProvider } from "@/providers/ThemeProvider";
import { logout } from "@/services/authService";
import {
  getUiPreferences,
  updateUiPreferences,
} from "@/services/uiPreferenceService";
import { makeProfile } from "@/test/factories";
import { renderWithRouter } from "@/test/render";

vi.mock("@/providers/AuthProvider", () => ({ useSession: vi.fn() }));
vi.mock("@/lib/notify", () => ({ notify: vi.fn() }));
vi.mock("@/services/authService", () => ({ logout: vi.fn() }));
vi.mock("@/services/categoryService", () => ({
  subscribeToCategories: vi.fn((_userId: string, onData: (items: never[]) => void) => {
    onData([]);
    return () => undefined;
  }),
}));
vi.mock("@/services/uiPreferenceService", () => ({
  getUiPreferences: vi.fn(),
  updateUiPreferences: vi.fn(),
}));

function setup(role: UserRole, route = "/home") {
  vi.mocked(useSession).mockReturnValue({
    profile: makeProfile(role, { displayName: "Carla Dias" }),
    firebaseUser: {} as never,
  });
  vi.mocked(getUiPreferences).mockResolvedValue({
    theme: "dark",
    sidebarCollapsed: false,
  });
  vi.mocked(updateUiPreferences).mockResolvedValue(undefined);

  return renderWithRouter(
    <ThemeProvider initialTheme="dark">
      <AppShell />
    </ThemeProvider>,
    { route },
  );
}

describe("AppShell", () => {
  it("exibe menu completo para admin com item ativo", async () => {
    setup("admin", "/reports");

    expect(
      await screen.findByRole("link", { name: "Perfis de usuários" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Relatórios" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByText("Carla Dias")).toBeInTheDocument();
  });

  it("exibe Orcamentos e preserva a competencia nos links mensais", async () => {
    setup("guest", "/home?mes=2026-02");

    expect(
      await screen.findByRole("link", { name: "Orçamentos" }),
    ).toHaveAttribute("href", "/budgets?mes=2026-02");
    expect(screen.getByRole("link", { name: "Custos" })).toHaveAttribute(
      "href",
      "/costs?mes=2026-02",
    );
    expect(screen.getByRole("link", { name: "Relatórios" })).toHaveAttribute(
      "href",
      "/reports",
    );
  });

  it("oculta gestao de usuarios para standard e guest", async () => {
    setup("standard");
    expect(await screen.findByRole("link", { name: "Custos" })).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Perfis de usuários" }),
    ).not.toBeInTheDocument();
  });

  it("alterna o tema e persiste a preferencia", async () => {
    const { user } = setup("standard");
    await waitFor(() => expect(getUiPreferences).toHaveBeenCalled());

    await user.click(screen.getByTestId("theme-toggle-button"));

    expect(updateUiPreferences).toHaveBeenCalledWith("uid-standard", {
      theme: "light",
    });
    expect(document.documentElement).not.toHaveClass("dark");
  });

  it("recolhe o menu lateral e persiste a preferencia", async () => {
    const { user } = setup("standard");
    await waitFor(() => expect(getUiPreferences).toHaveBeenCalled());

    await user.click(screen.getByRole("button", { name: "Alternar menu lateral" }));

    expect(updateUiPreferences).toHaveBeenCalledWith("uid-standard", {
      sidebarCollapsed: true,
    });
  });

  it("sai do sistema pelo menu do usuario e avisa em caso de falha", async () => {
    vi.mocked(logout).mockRejectedValueOnce(new Error("offline"));
    const { user } = setup("standard");

    await user.click(screen.getByRole("button", { name: "Menu do usuário" }));
    await user.click(
      await screen.findByRole("menuitem", { name: /Sair do sistema/ }),
    );

    expect(logout).toHaveBeenCalledTimes(1);
    await waitFor(() =>
      expect(notify).toHaveBeenCalledWith(
        "error",
        "Não foi possível sair da conta. Tente novamente.",
      ),
    );
  });
});
