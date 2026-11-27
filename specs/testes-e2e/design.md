# Design - Testes E2E

- **Playwright** (`playwright.config.ts`): `testDir` `tests/e2e`, 1 worker (emuladores compartilhados),
  `webServer` com `vite` em modo dev na porta 5180 e variáveis `VITE_*` do projeto demo (variáveis de
  processo têm prioridade sobre o `.env.local`).
- **`src/lib/firebase.ts`**: com `VITE_USE_EMULATORS=true`, conecta Auth (9099) e Firestore (8080).
- **`tests/e2e/support/emulators.ts`**: REST dos emuladores — limpar dados, criar conta (Auth) e
  perfil com papel (Firestore com `Bearer owner`, sem passar pelas regras), listar documentos para
  verificar persistência.
- **`tests/e2e/support/app.ts`**: fixture `seedUser` (reseta os emuladores por teste), `login`,
  `typeCurrency`, `seedCost`, datas do mês atual.
- **Specs**: `auth`, `costs`, `automation` (importação, recorrentes, metas) e `access`
  (relatório CSV e guest).
- Seletores por papel/rótulo acessível (nomes exatos nos links do menu) e ids estáveis onde o rótulo
  se repete na tela.

## Achado ao implementar

O log do app mostrou a barra de progresso recebendo valores acima de 100 (orçamento estourado); o
consolidado do Início e a tela de Orçamentos passaram a limitar a barra em 100% (o texto mantém o
percentual real), com teste de regressão.
