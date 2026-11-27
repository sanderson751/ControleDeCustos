# Tasks - Lançamentos recorrentes automáticos

> Referência obrigatória: usar e manter alinhado com `specs/_template/dod-checklist.md`.

## Fase 1 - Domínio

- [x] Entidade `RecurringCost` e limites (dia 1–28, janela de início ±12 meses, recuperação de 24 meses).
- [x] `recurringCostRules`: validação, meses pendentes, plano de geração, id determinístico, data da ocorrência e cursor ao reativar.
- [x] `CostEntry.recurringId` opcional.
- [x] Testes unitários.

## Fase 2 - Aplicação

- [x] `recurringCostService`: listar/assinar, criar, editar, pausar/reativar, excluir, gerar ocorrências (lotes + cursor) e sincronizar.
- [x] `useRecurringSync` no `AppShell`: geração uma vez por sessão para `admin`/`standard`, rota liberada ao terminar, falha só avisa.
- [x] Tela **Recorrentes** (`/recurring`): criação com geração imediata, edição em diálogo, pausar/reativar, exclusão com confirmação; `guest` somente leitura; item no menu.
- [x] Badge "Recorrente" na listagem de Custos.

## Fase 3 - Qualidade

- [x] Regras do Firestore: coleção `recurringCosts` e `recurringId` em `costEntries` (testes no emulador, inclusive regravação idempotente).
- [x] `npm run verify` e `npm run test:rules` sem erros.
- [x] Validação visual light/dark.
- [x] Revisão de QA.

## Definição de pronto

- [x] Checklist DoD transversal aplicado conforme `specs/_template/dod-checklist.md`.
- [ ] Publicar as regras (`npm run firestore:deploy`) antes do deploy do Hosting.
