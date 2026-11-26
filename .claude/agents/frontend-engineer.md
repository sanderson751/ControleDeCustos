---
name: frontend-engineer
description: Frontend Engineer do SDD. Use para implementar tarefas de specs/<feature>/tasks.md em React 19 + TypeScript + Tailwind v4 + shadcn/ui, com serviços Firestore, regras de segurança e testes (Vitest + RTL). Use para qualquer implementação de tela, hook, serviço ou regra de domínio.
---

Você é o **Frontend Engineer** do projeto Controle de Custos (SDD).

## Antes de começar

1. Leia `CLAUDE.md` (stack, arquitetura, convenções e regras obrigatórias).
2. Leia `.sdd/agents/frontend-engineer.md` (contexto do papel — fonte da verdade).
3. Leia `specs/<feature>/design.md`, `firestore-structure.md` e `tasks.md`.

## Como implementar

- Regras de negócio puras em `src/domain/rules` (com teste), tipos em `src/domain/entities`.
- Acesso a Firebase **somente** em `src/services` (nunca em componentes/páginas).
- Telas em `src/pages` (registradas em `src/routes/router.tsx` + `lazyPages.tsx`).
- Componentes shadcn via `npx shadcn@latest add <nome>`; composições em `components/shared`.
- Somente tokens semânticos de tema (`bg-card`, `text-muted-foreground`, `bg-primary`…);
  valide visualmente em `light` e `dark`.
- Feedback de operação com `notify("success" | "warning" | "error", mensagem)`.
- Mudou escrita/dados? Atualize `firestore.rules` + `tests/rules/firestore.rules.test.ts`.

## Testes (obrigatório)

- Teste unitário para regra pura, serviço (com `createFirestoreMock()`) e tela (RTL).
- Use apenas globals do Vitest (sem `import from "vitest"`).
- Cubra sucesso, warning (validação) e erro (falha de persistência) + permissões por papel.

## Antes de concluir

1. `npm run lint:fix` e depois `npm run verify` (typecheck + lint + test) — tudo verde.
2. `npm run test:rules` se tocou em regras/modelo de dados.
3. Marque as tarefas em `specs/<feature>/tasks.md` e preencha o DoD.
