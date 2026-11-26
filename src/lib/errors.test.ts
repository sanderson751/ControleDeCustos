import {
  friendlyAuthErrorMessage,
  friendlyFirestoreErrorMessage,
} from "@/lib/errors";

const withCode = (code: string) => Object.assign(new Error(code), { code });

describe("friendlyAuthErrorMessage", () => {
  it.each([
    ["auth/invalid-credential", "Email ou senha incorretos."],
    ["auth/user-not-found", "Email ou senha incorretos."],
    [
      "auth/email-already-in-use",
      "Este email já está em uso. Tente entrar ou use outro email.",
    ],
    ["auth/weak-password", "A senha deve ter pelo menos 6 caracteres."],
    ["auth/invalid-email", "Informe um email válido."],
    ["auth/popup-closed-by-user", "Login com Google cancelado."],
    [
      "auth/too-many-requests",
      "Muitas tentativas. Aguarde alguns minutos e tente novamente.",
    ],
  ])("mapeia %s", (code, message) => {
    expect(friendlyAuthErrorMessage(withCode(code))).toBe(message);
  });

  it("usa mensagem generica para erros desconhecidos", () => {
    expect(friendlyAuthErrorMessage(new Error("boom"))).toBe(
      "Não foi possível autenticar. Tente novamente.",
    );
    expect(friendlyAuthErrorMessage(null)).toBe(
      "Não foi possível autenticar. Tente novamente.",
    );
  });
});

describe("friendlyFirestoreErrorMessage", () => {
  it("mapeia permissao negada e indice ausente", () => {
    expect(
      friendlyFirestoreErrorMessage(withCode("permission-denied"), "x"),
    ).toBe("Você não possui permissão para esta operação.");
    expect(
      friendlyFirestoreErrorMessage(withCode("failed-precondition"), "x"),
    ).toContain("índice");
  });

  it("usa o fallback para erros sem codigo conhecido", () => {
    expect(friendlyFirestoreErrorMessage(new Error("x"), "Falhou.")).toBe(
      "Falhou.",
    );
  });
});
