# Design - Login com Firestore

## Visao de solucao

Implementar autenticacao com Auth.js em dois provedores (credentials com Firebase Identity Toolkit e Google), sincronizando dados minimos do usuario no Firestore via servicos server-side e redirecionando para a aplicacao principal em `/home` apos sucesso.

Padrao visual transversal:

- utilizar Material Design Icons Community (`@mdi/react` + `@mdi/js`) em controles de navegacao globais.
- quando houver menu retraido, usar tooltip com `react-tooltip` para itens icon-only.
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
- `AuthConfig` (`src/auth.ts`):
  - providers `credentials` e `google`
  - callbacks `signIn`, `jwt` e `session`
- `UserProfileService` server-side:
  - `upsertUserProfile(authUser)`
- `Middleware` + layout protegido:
  - bloqueia acesso nao autenticado
  - libera e redireciona autenticado para `/home`

## Fluxo principal

1. Usuario acessa tela de login.
2. Usuario autentica por email/senha ou Google.
3. Auth.js recebe `uid` e dados do provedor autenticado.
4. Sistema executa upsert em `users/{uid}` no Firestore no callback de `signIn`.
5. Sistema cria sessao JWT e redireciona para `/home`.

## Fluxo de erro

1. Firebase retorna erro de autenticacao.
2. Sistema mapeia erro tecnico para mensagem amigavel.
3. Usuario permanece na tela de login sem redirecionamento.

## Modelo de dados no Firestore

Colecao:

- `users/{uid}`

Campos:

- `uid`: string
- `displayName`: string
- `email`: string
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
- toda escrita em Firestore deve ocorrer no servidor Next.js.

## Compatibilidade de tema e contraste

- Formularios e mensagens de erro de autenticacao devem permanecer legiveis em `light` e `dark`.
- Evitar cores fixas para texto critico em mensagens, botoes e estados de foco.
- Garantir contraste minimo AA para campos, botoes e alertas.
- Snackbar deve usar cores semanticas por status: vermelho (erro), verde (sucesso), amarelo (warning).

## Roteamento esperado

- rota publica: `/login`
- rotas protegidas: `/home`, `/costs`, `/costs/[costId]/edit`, `/userProfiles`
- em autenticacao valida, navegar para `/home`.
