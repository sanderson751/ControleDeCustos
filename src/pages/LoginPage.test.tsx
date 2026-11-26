import { screen, waitFor } from "@testing-library/react";
import { notify } from "@/lib/notify";
import LoginPage from "@/pages/LoginPage";
import {
  loginWithEmailAndPassword,
  loginWithGoogle,
  registerWithEmailAndPassword,
} from "@/services/authService";
import { renderWithRouter } from "@/test/render";

vi.mock("@/lib/notify", () => ({ notify: vi.fn() }));
vi.mock("@/services/authService", () => ({
  loginWithEmailAndPassword: vi.fn(),
  loginWithGoogle: vi.fn(),
  registerWithEmailAndPassword: vi.fn(),
}));

const mockedLogin = vi.mocked(loginWithEmailAndPassword);
const mockedRegister = vi.mocked(registerWithEmailAndPassword);
const mockedGoogle = vi.mocked(loginWithGoogle);
const mockedNotify = vi.mocked(notify);

const authError = (code: string) => Object.assign(new Error(code), { code });

describe("LoginPage", () => {
  it("entra com email e senha", async () => {
    mockedLogin.mockResolvedValue({} as never);
    const { user } = renderWithRouter(<LoginPage />);

    await user.type(screen.getByLabelText("Email"), "ana@exemplo.com");
    await user.type(screen.getByLabelText("Senha"), "123456");
    await user.click(screen.getByRole("button", { name: /^Entrar$/ }));

    expect(mockedLogin).toHaveBeenCalledWith("ana@exemplo.com", "123456");
  });

  it("exibe mensagem amigavel quando as credenciais estao incorretas", async () => {
    mockedLogin.mockRejectedValue(authError("auth/invalid-credential"));
    const { user } = renderWithRouter(<LoginPage />);

    await user.type(screen.getByLabelText("Email"), "ana@exemplo.com");
    await user.type(screen.getByLabelText("Senha"), "errada");
    await user.click(screen.getByRole("button", { name: /^Entrar$/ }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Email ou senha incorretos.",
    );
    expect(mockedNotify).toHaveBeenCalledWith(
      "error",
      "Email ou senha incorretos.",
    );
    expect(screen.getByRole("button", { name: /^Entrar$/ })).toBeEnabled();
  });

  it("exige email e senha antes de chamar o Firebase", async () => {
    const { user } = renderWithRouter(<LoginPage />);

    await user.click(screen.getByRole("button", { name: /^Entrar$/ }));

    expect(mockedLogin).not.toHaveBeenCalled();
    expect(mockedNotify).toHaveBeenCalledWith(
      "warning",
      "Informe email e senha.",
    );
  });

  it("cria conta no modo de cadastro", async () => {
    mockedRegister.mockResolvedValue({} as never);
    const { user } = renderWithRouter(<LoginPage />);

    await user.click(screen.getByRole("button", { name: "Quero criar conta" }));
    await user.type(screen.getByLabelText("Nome"), "Ana Lima");
    await user.type(screen.getByLabelText("Email"), "ana@exemplo.com");
    await user.type(screen.getByLabelText("Senha"), "123456");
    await user.click(screen.getByRole("button", { name: /^Criar conta$/ }));

    await waitFor(() =>
      expect(mockedRegister).toHaveBeenCalledWith(
        "Ana Lima",
        "ana@exemplo.com",
        "123456",
      ),
    );
    expect(mockedNotify).toHaveBeenCalledWith(
      "success",
      "Conta criada com sucesso.",
    );
  });

  it("informa email ja em uso no cadastro", async () => {
    mockedRegister.mockRejectedValue(authError("auth/email-already-in-use"));
    const { user } = renderWithRouter(<LoginPage />);

    await user.click(screen.getByRole("button", { name: "Quero criar conta" }));
    await user.type(screen.getByLabelText("Email"), "ana@exemplo.com");
    await user.type(screen.getByLabelText("Senha"), "123456");
    await user.click(screen.getByRole("button", { name: /^Criar conta$/ }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Este email já está em uso.",
    );
  });

  it("entra com Google", async () => {
    mockedGoogle.mockResolvedValue({} as never);
    const { user } = renderWithRouter(<LoginPage />);

    await user.click(screen.getByRole("button", { name: "Entrar com Google" }));

    expect(mockedGoogle).toHaveBeenCalledTimes(1);
  });
});
