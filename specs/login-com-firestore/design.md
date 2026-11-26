# Design - Login com Firestore

## Visao de solucao

Implementar autenticacao com Firebase Authentication no client (email/senha e Google via popup), sincronizando dados minimos do usuario em `users/{uid}` com uma transacao do Firestore (validada por `firestore.rules`) e redirecionando para a aplicacao principal em `/home` apos sucesso. (Atualizado em 2026-11: a versao anterior usava Auth.js + servicos server-side no Next.js.)

Padrao visual transversal:

- utilizar icones `lucide-react` em controles de navegacao globais.
- quando houver menu retraido, usar `Tooltip` do shadcn/ui para itens icon-only.
- aplicar tokens semanticos de tema para textos e estados de feedback (erro/alerta).

## Componentes e modulos

- `LoginPage`:
  - formulario de email/senha
  - botao de login com Google
  - exibicao de erros
- `GlobalSnackbar`:
  - feedback para erro/sucesso/warning no canto superior direito
  - auto-dismiss em 3 segundos
  - fechamento manual com icone `X`
- `AuthService`:
  - `loginWithEmailPassword(email, password)`
  - `loginWithGoogle()`
- `AuthProvider` (`src/providers/AuthProvider.tsx`):
  - estado `loading`/`authenticated`/`unauthenticated`/`error`
  - perfil e role em tempo real via `onSnapshot`
- `userService` (client):
  - `ensureUserProfile(user)` e `subscribeToUserProfile(uid)`
  - unicidade de email garantida pelo Firebase Auth ("uma conta por email")
- Guards de rota (`src/routes/guards.tsx`):
  - bloqueia acesso nao autenticado
  - libera e redireciona autenticado para `/home`

## Fluxo principal

1. Usuario acessa tela de login.
2. Usuario autentica por email/senha ou Google.
3. `onAuthStateChanged` (AuthProvider) recebe o usuario do Firebase Auth.
4. `ensureUserProfile` cria (role `standard`) ou atualiza `users/{uid}` em transacao, sem alterar `role`/`createdAt`.
5. O AuthProvider assina o perfil em tempo real e o `PublicOnlyRoute` redireciona para `/home`.

## Fluxo de erro

1. Firebase retorna erro de autenticacao.
2. Sistema classifica erro de credenciais:

- credenciais invalidas (email inexistente ou senha incorreta) -> "Email ou senha incorretos."
- demais erros mapeados em `src/lib/errors.ts` (`friendlyAuthErrorMessage`).

3. Sistema mapeia erro tecnico para mensagem amigavel.
4. Usuario permanece na tela de login sem redirecionamento.

## Unicidade de email

- A unicidade de email e garantida pelo Firebase Auth; `emailNormalized` continua salvo em `users/{uid}` para consultas.
- Cadastro por email/senha e login por Google nao podem criar duas contas com o mesmo email.
- Quando detectar conflito entre provedores para o mesmo email, o fluxo e bloqueado com mensagem amigavel de email ja em uso.

## Modelo de dados no Firestore

Colecao:

- `users/{uid}`

Campos:

- `uid`: string
- `displayName`: string
- `email`: string
- `emailNormalized`: string (lowercase para unicidade)
- `photoURL`: string
- `provider`: string (`password` ou `google.com`)
- `createdAt`: Timestamp
- `updatedAt`: Timestamp
- `lastLoginAt`: Timestamp

## Regras tecnicas

- usar `serverTimestamp()` para `createdAt`, `updatedAt` e `lastLoginAt`.
- preservar `createdAt` em atualizacoes.
- armazenar apenas dados necessarios para perfil basico.
- abstrair chamada de auth/firestore em servicos para facilitar testes.
- toda escrita em Firestore ocorre via `src/services` no client e e autorizada/validada por `firestore.rules`.

## Compatibilidade de tema e contraste

- Formularios e mensagens de erro de autenticacao devem permanecer legiveis em `light` e `dark`.
- Evitar cores fixas para texto critico em mensagens, botoes e estados de foco.
- Garantir contraste minimo AA para campos, botoes e alertas.
- Snackbar deve usar cores semanticas por status: vermelho (erro), verde (sucesso), amarelo (warning).

## Roteamento esperado

- rota publica: `/login`
- rotas protegidas: `/home`, `/costs`, `/costs/:costId/edit`, `/reports`, `/userProfiles` (admin)
- em autenticacao valida, navegar para `/home`.
