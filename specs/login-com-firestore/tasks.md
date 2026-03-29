# Tasks - Login com Firestore

## Fase 1 - Setup Firebase

- [x] Configurar Next.js App Router e Auth.js.
- [x] Configurar Firebase Identity Toolkit para login por credenciais.
- [x] Configurar Firestore via Firebase Admin no servidor Next.
- [x] Definir variaveis de ambiente `NEXT_PUBLIC_*`, `AUTH_*` e credenciais Admin.

## Fase 2 - Dominio e servicos

- [x] Adaptar `authService` para Auth.js (`credentials` + `google`).
- [x] Criar `src/auth.ts` com callbacks de sessao e sincronizacao de perfil.
- [x] Criar `services/server/userProfileService` com upsert em `users/{uid}`.
- [x] Garantir regras de timestamp (`createdAt`, `updatedAt`, `lastLoginAt`) no backend.

## Fase 3 - Interface e navegacao

- [x] Criar rota publica `/login` com `LoginPage` em client component.
- [x] Adicionar botao "Entrar com Google" via Auth.js.
- [x] Criar `middleware.ts` e layout protegido para rotas autenticadas.
- [x] Redirecionar login valido para `/home`.
- [x] Integrar snackbar para feedback de erro/sucesso/warning (top-right, 3s, fechar com `X`).

## Fase 4 - Qualidade

- [ ] Testar login com email/senha (sucesso e falha).
- [ ] Testar login com Google (sucesso e falha).
- [ ] Testar redirecionamento para `/home` apos autenticacao.
- [ ] Testar que falhas de login nao redirecionam.
- [ ] Validar legibilidade e contraste (AA) de formularios e mensagens em tema `light` e `dark`.
- [ ] Testar comportamento do snackbar (auto-dismiss 3s, fechamento por `X`, cor por status).

## Definicao de pronto

- [x] Login por email/senha funcionando na camada Auth.js.
- [x] Login por Google configurado na camada Auth.js.
- [x] Documento `users/{uid}` criado/atualizado no Firestore.
- [x] Redirecionamento para app principal funcionando.
- [ ] Testes de fluxo critico passando.
- [ ] Fluxo de falha de persistencia em Firestore validado sem inconsistencias de estado.
