# Tasks - Migração para SPA (Vite + React) com shadcn/ui

## Fase 1 - Base

- [x] Remover Next.js, NextAuth, API routes, middleware e Firebase Admin do runtime.
- [x] Configurar Vite 8 + React 19 + TypeScript + alias `@/`.
- [x] Configurar Tailwind CSS v4 + shadcn/ui (`components.json`) e adicionar componentes base.
- [x] Aplicar tokens do estilo Origin Financial (dark) + variante light em `src/index.css`.
- [x] Configurar ESLint 10 (flat config) com regras de hooks.
- [x] Configurar Vitest + RTL (setup, factories, mock do Firestore, helper de render).

## Fase 2 - Domínio e serviços

- [x] Extrair regras puras: totais, filtro, ordenação, parcelas (fim de mês seguro), validação, paginação, permissões.
- [x] Reescrever serviços com Firestore client: custos (batch de parcelas), relatórios, preferências, perfis.
- [x] Firebase Auth no client: email/senha, cadastro com nome, Google (popup), logout.
- [x] `AuthProvider` com perfil/role em tempo real; `ThemeProvider` com cache local.

## Fase 3 - Segurança

- [x] Reescrever `firestore.rules` (papéis, dono, validação de custos, admin não altera o próprio papel).
- [x] Testes de regras no emulador (`tests/rules`, `npm run test:rules`).
- [x] Script de migração de usuários Google legados (`scripts/migrate-legacy-google-users.mjs`).

## Fase 4 - UI

- [x] Shell com sidebar shadcn (retrátil, preferência persistida), app bar com tema e menu do usuário.
- [x] Telas: login, início, custos, edição, relatórios (CSV/PDF sob demanda), perfis de usuários.
- [x] Guards de rota (protegida, pública, por papel) e lazy loading por rota.
- [x] Snackbar padrão via Sonner (`notify`).

## Fase 5 - Publicação e processo

- [x] `firebase.json` para Hosting estático (SPA rewrite + cache).
- [x] `.env.example`, `.firebaserc.example`.
- [x] `CLAUDE.md`, agentes (`.claude/agents`) e skills (`.claude/skills`).
- [x] Atualizar steering, agentes SDD, specs afetadas e README.
- [x] Proteger a `main` no GitHub (merge somente via PR).

## Pendências operacionais (responsável pelo projeto)

Passo a passo detalhado em [`docs/pendencias-deploy.md`](../../docs/pendencias-deploy.md).

- [ ] Habilitar provedor Google no Firebase Authentication (antes era via OAuth do NextAuth).
- [ ] `npm run firestore:deploy` para publicar as novas regras.
- [ ] Rodar `npm run migrate:legacy-google-users` (simulação) e, se houver usuários, `-- --apply`.
- [ ] `npm run deploy` e validação manual em light/dark.

## Definição de pronto

- [x] `npm run verify` sem erros.
- [x] `npm run test:rules` sem erros.
- [x] Checklist `specs/_template/dod-checklist.md` aplicado.
