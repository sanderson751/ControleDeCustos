# Design - Login com Firestore

## Visao de solucao

Implementar autenticacao com Firebase Auth em dois provedores (email/senha e Google), sincronizando dados minimos do usuario no Firestore e redirecionando para a aplicacao principal apos sucesso.

## Componentes e modulos

- `LoginPage`:
  - formulario de email/senha
  - botao de login com Google
  - exibicao de erros
- `AuthService`:
  - `loginWithEmailPassword(email, password)`
  - `loginWithGoogle()`
- `UserProfileService`:
  - `upsertUserProfile(authUser)`
- `ProtectedRoute`:
  - bloqueia acesso nao autenticado
  - libera e redireciona autenticado para `App.tsx`

## Fluxo principal

1. Usuario acessa tela de login.
2. Usuario autentica por email/senha ou Google.
3. Sistema recebe `uid` e dados do Firebase Auth.
4. Sistema executa upsert em `users/{uid}` no Firestore.
5. Sistema redireciona para a rota principal da aplicacao (`App.tsx`).

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

## Roteamento esperado

- rota publica: `/login`
- rota protegida: `/`
- em autenticacao valida, navegar para `/` (entrada carregada por `App.tsx`).
