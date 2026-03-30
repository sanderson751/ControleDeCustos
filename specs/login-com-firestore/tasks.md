# Tasks - Login com Firestore

## Fase 1 - Setup Firebase

- [ ] Configurar Firebase App e Firebase Auth.
- [ ] Configurar Firestore.
- [ ] Definir variaveis de ambiente para chaves do Firebase.

## Fase 2 - Dominio e servicos

- [ ] Criar tipo `AuthenticatedUser` em `src/domain/entities`.
- [ ] Criar `authService` com login por email/senha e Google.
- [ ] Criar `userProfileService` com upsert em `users/{uid}`.
- [ ] Garantir regras de timestamp (`createdAt`, `updatedAt`, `lastLoginAt`).

## Fase 3 - Interface e navegacao

- [ ] Criar `LoginPage` com formulario email/senha.
- [ ] Adicionar botao "Entrar com Google".
- [ ] Criar `ProtectedRoute` para rotas autenticadas.
- [ ] Redirecionar login valido para a rota principal carregada por `App.tsx`.

## Fase 4 - Qualidade

- [ ] Testar login com email/senha (sucesso e falha).
- [ ] Testar login com Google (sucesso e falha).
- [ ] Testar redirecionamento para `App.tsx` apos autenticacao.
- [ ] Testar que falhas de login nao redirecionam.

## Definicao de pronto

- [ ] Login por email/senha funcionando.
- [ ] Login por Google funcionando.
- [ ] Documento `users/{uid}` criado/atualizado no Firestore.
- [ ] Redirecionamento para app principal funcionando.
- [ ] Testes de fluxo critico passando.
