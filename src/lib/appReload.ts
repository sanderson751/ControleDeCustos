/**
 * Recarrega o app na tela de login (fim da sessao): o Firestore encerrado no
 * logout so volta com uma pagina nova. Isolado para os testes (jsdom nao navega).
 */
export function reloadToLogin(): void {
  window.location.replace("/login");
}
