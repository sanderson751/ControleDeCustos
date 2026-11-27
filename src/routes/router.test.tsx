import { render, screen } from "@testing-library/react";
import { createMemoryRouter } from "react-router";
import { RouterProvider } from "react-router/dom";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/providers/AuthProvider";
import { appRoutes } from "@/routes/router";

vi.mock("@/providers/AuthProvider", () => ({
  useAuth: vi.fn(),
  useSession: vi.fn(),
}));
vi.mock("@/services/authService", () => ({
  loginWithEmailAndPassword: vi.fn(),
  loginWithGoogle: vi.fn(),
  registerWithEmailAndPassword: vi.fn(),
  logout: vi.fn(),
}));

function renderAt(path: string) {
  const router = createMemoryRouter(appRoutes, { initialEntries: [path] });
  render(
    <TooltipProvider>
      <RouterProvider router={router} />
    </TooltipProvider>,
  );
  return router;
}

describe("appRoutes", () => {
  beforeEach(() => {
    vi.mocked(useAuth).mockReturnValue({
      status: "unauthenticated",
      firebaseUser: null,
      profile: null,
      error: null,
    });
  });

  it("visitante em rota protegida cai na tela de login (lazy)", async () => {
    const router = renderAt("/costs");

    expect(
      await screen.findByRole("heading", { name: "Entrar" }, { timeout: 5000 }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/login");
  });

  it("rotas desconhecidas e raiz redirecionam para /home (e dai ao login)", async () => {
    const router = renderAt("/rota-inexistente");

    await screen.findByRole("heading", { name: "Entrar" }, { timeout: 5000 });
    expect(router.state.location.pathname).toBe("/login");
  });
});
