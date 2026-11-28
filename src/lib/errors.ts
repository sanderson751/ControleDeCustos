export function getErrorCode(error: unknown): string {
  if (error && typeof error === "object" && "code" in error) {
    return String((error as { code: unknown }).code);
  }

  return "";
}

/** Mensagens amigaveis para erros do Firebase Authentication. */
export function friendlyAuthErrorMessage(error: unknown): string {
  switch (getErrorCode(error)) {
    case "auth/invalid-credential":
    case "auth/invalid-login-credentials":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "Email ou senha incorretos.";
    case "auth/email-already-in-use":
      return "Este email já está em uso. Tente entrar ou use outro email.";
    case "auth/invalid-email":
      return "Informe um email válido.";
    case "auth/missing-password":
      return "Informe a senha.";
    case "auth/weak-password":
      return "A senha deve ter pelo menos 6 caracteres.";
    case "auth/user-disabled":
      return "Esta conta está desativada.";
    case "auth/too-many-requests":
      return "Muitas tentativas. Aguarde alguns minutos e tente novamente.";
    case "auth/network-request-failed":
      return "Falha de conexão. Verifique sua internet e tente novamente.";
    case "auth/popup-closed-by-user":
    case "auth/cancelled-popup-request":
      return "Login com Google cancelado.";
    case "auth/popup-blocked":
      return "O navegador bloqueou a janela de login. Permita pop-ups e tente novamente.";
    case "auth/account-exists-with-different-credential":
      return "Já existe uma conta com este email usando outro método de login.";
    case "auth/operation-not-allowed":
      return "Este método de login não está habilitado no Firebase.";
    case "auth/invalid-api-key":
    case "auth/api-key-not-valid.-please-pass-a-valid-api-key.":
      return "Configuração inválida do Firebase (API Key). Verifique o arquivo .env.local.";
    default:
      return "Não foi possível autenticar. Tente novamente.";
  }
}

/** Mensagens amigaveis para erros do Firestore com fallback contextual. */
export function friendlyFirestoreErrorMessage(
  error: unknown,
  fallbackMessage: string,
): string {
  switch (getErrorCode(error)) {
    case "permission-denied":
      return "Você não possui permissão para esta operação.";
    case "unauthenticated":
      return "Sua sessão expirou. Entre novamente.";
    case "failed-precondition":
      return "A consulta exige um índice no Firestore. Execute npm run firestore:deploy.";
    case "unavailable":
      return "Firestore indisponível no momento. Verifique sua conexão.";
    case "not-found":
      return "Registro não encontrado.";
    default:
      return fallbackMessage;
  }
}
