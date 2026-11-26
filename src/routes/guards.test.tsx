import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { type AuthContextValue, useAuth } from "@/providers/AuthProvider";
import {
  ProtectedRoute,
  PublicOnlyRoute,
  RequireRole,
} from "@/routes/guards";
import { makeProfile } from "@/test/factories";
import { LocationProbe } from "@/test/render";

vi.mock("@/providers/AuthProvider", () => ({ useAuth: vi.fn() }));
vi.mock("@/services/authService", () => ({ logout: vi.fn() }));

const mockedUseAuth = vi.mocked(useAuth);

function authState(partial: Partial<AuthContextValue>): AuthContextValue {
  return {
    status: "loading",
    firebaseUser: null,
    profile: null,
    error: null,
    ...partial,
  };
}

function renderRoutes(initialPath: string) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route element={<PublicOnlyRoute />}>
          <Route path="/login" element={<p>tela de login</p>} />
        </Route>
        <Route element={<ProtectedRoute />}>
          <Route path="/home" element={<p>tela home</p>} />
          <Route path="/costs" element={<p>tela custos</p>} />
          <Route
            path="/userProfiles"
            element={
              <RequireRole roles={["admin"]}>
                <p>tela admin</p>
              </RequireRole>
            }
          />
        </Route>
      </Routes>
      <LocationProbe />
    </MemoryRouter>,
  );
}

describe("guards de rota", () => {
  it("exibe loader enquanto a sessao carrega", () => {
    mockedUseAuth.mockReturnValue(authState({ status: "loading" }));
    renderRoutes("/home");
    expect(screen.getByTestId("full-page-loader")).toBeInTheDocument();
  });

  it("redireciona visitante para o login", () => {
    mockedUseAuth.mockReturnValue(authState({ status: "unauthenticated" }));
    renderRoutes("/costs");
    expect(screen.getByText("tela de login")).toBeInTheDocument();
    expect(screen.getByTestId("location")).toHaveTextContent("/login");
  });

  it("usuario autenticado acessa rota protegida", () => {
    mockedUseAuth.mockReturnValue(
      authState({ status: "authenticated", profile: makeProfile() }),
    );
    renderRoutes("/costs");
    expect(screen.getByText("tela custos")).toBeInTheDocument();
  });

  it("usuario autenticado no login vai para /home", () => {
    mockedUseAuth.mockReturnValue(
      authState({ status: "authenticated", profile: makeProfile() }),
    );
    renderRoutes("/login");
    expect(screen.getByTestId("location")).toHaveTextContent("/home");
  });

  it("exibe tela de erro quando o perfil nao carrega", () => {
    mockedUseAuth.mockReturnValue(
      authState({ status: "error", error: "Falha ao carregar perfil." }),
    );
    renderRoutes("/home");
    expect(screen.getByText("Falha ao carregar perfil.")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Voltar ao login" }),
    ).toBeInTheDocument();
  });

  it("RequireRole bloqueia nao-admin e libera admin", () => {
    mockedUseAuth.mockReturnValue(
      authState({ status: "authenticated", profile: makeProfile("standard") }),
    );
    const { unmount } = renderRoutes("/userProfiles");
    expect(screen.getByTestId("location")).toHaveTextContent("/home");
    unmount();

    mockedUseAuth.mockReturnValue(
      authState({ status: "authenticated", profile: makeProfile("admin") }),
    );
    renderRoutes("/userProfiles");
    expect(screen.getByText("tela admin")).toBeInTheDocument();
  });
});
