import { act, screen, waitFor } from "@testing-library/react";
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
import {
  COMPETENCE_CHECK_INTERVAL_MS,
  SYNC_BLOCK_TIMEOUT_MS,
} from "@/hooks/useRecurringSync";
import { syncRecurringCosts } from "@/services/recurringCostService";
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
vi.mock("@/services/recurringCostService", () => ({
  syncRecurringCosts: vi.fn(async () => ({ created: 0, failed: 0 })),
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
  beforeEach(() => {
    vi.mocked(syncRecurringCosts).mockResolvedValue({ created: 0, failed: 0 });
  });

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

describe("AppShell - lancamentos recorrentes", () => {
  const result = (created: number, failed = 0) => ({ created, failed });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("gera os pendentes ao abrir, segura a rota ate terminar e avisa a quantidade", async () => {
    let finish: (value: ReturnType<typeof result>) => void = () => undefined;
    vi.mocked(syncRecurringCosts).mockImplementationOnce(
      () => new Promise((resolve) => { finish = resolve; }),
    );
    setup("standard");

    expect(await screen.findByText("Atualizando lançamentos recorrentes...")).toBeInTheDocument();
    finish(result(3));

    await waitFor(() =>
      expect(screen.queryByText("Atualizando lançamentos recorrentes...")).not.toBeInTheDocument(),
    );
    expect(syncRecurringCosts).toHaveBeenCalledWith("uid-standard");
    expect(notify).toHaveBeenCalledWith("success", "3 lançamentos recorrentes gerados.");
  });

  it("regressao: geracao travada (offline) libera as telas apos o tempo-limite", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.mocked(syncRecurringCosts).mockImplementationOnce(() => new Promise(() => undefined));
    setup("standard");

    expect(await screen.findByText("Atualizando lançamentos recorrentes...")).toBeInTheDocument();
    await act(async () => {
      vi.advanceTimersByTime(SYNC_BLOCK_TIMEOUT_MS);
    });

    expect(screen.queryByText("Atualizando lançamentos recorrentes...")).not.toBeInTheDocument();
  });

  it("sem aviso quando nada foi gerado; falhas parciais avisam", async () => {
    vi.mocked(syncRecurringCosts).mockResolvedValueOnce(result(1, 1));
    setup("admin");

    await waitFor(() =>
      expect(notify).toHaveBeenCalledWith("warning", expect.stringContaining("recorrentes")),
    );
    expect(notify).toHaveBeenCalledWith("success", "1 lançamento recorrente gerado.");
  });

  it("falha total avisa sem bloquear", async () => {
    vi.mocked(syncRecurringCosts).mockRejectedValueOnce(new Error("offline"));
    setup("standard");

    await waitFor(() =>
      expect(notify).toHaveBeenCalledWith("warning", expect.stringContaining("recorrentes")),
    );
    expect(screen.queryByText("Atualizando lançamentos recorrentes...")).not.toBeInTheDocument();
  });

  it("virada do mes com o app aberto gera de novo", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    setup("standard");
    await waitFor(() => expect(syncRecurringCosts).toHaveBeenCalledTimes(1));

    vi.setSystemTime(new Date(new Date().getFullYear(), new Date().getMonth() + 1, 2, 9));
    await act(async () => {
      vi.advanceTimersByTime(COMPETENCE_CHECK_INTERVAL_MS);
    });

    await waitFor(() => expect(syncRecurringCosts).toHaveBeenCalledTimes(2));
  });

  it("guest nao dispara geracao", async () => {
    setup("guest");
    await screen.findByText("Carla Dias");
    expect(syncRecurringCosts).not.toHaveBeenCalled();
  });
});
