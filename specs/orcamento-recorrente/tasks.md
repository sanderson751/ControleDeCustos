# Tasks - Orçamento recorrente

> Referência obrigatória: usar e manter alinhado com `specs/_template/dod-checklist.md`.

## Fase 1 - Domínio

- [x] `RecurringBudget`, `EffectiveBudget`, `BudgetMode`, `MonthBudgetState` em `src/domain/entities/budget.ts`.
- [x] `recurringBudgetRules.ts`: vigência ativa, limites efetivos, modo padrão e plano de gravação.
- [x] Testes unitários cobrindo os cenários 1 a 4 (criar, alterar a partir de um mês, exceção, encerrar) e virada de ano.
- [x] Correções da revisão de QA: cópia não altera recorrentes, substituição de vigências futuras, aviso para "Só este mês" vazio, legenda do rascunho, `recurringBudgets` na matriz de permissões.
- [x] `firestore-structure.md` da feature.

## Fase 2 - Aplicação

- [x] `budgetService`: `listRecurringBudgets`, `loadMonthBudgetState`, `applyMonthBudgetChanges` (batch único).
- [x] `useCompetenceResource` generalizado; `useMonthBudgets` expõe limites efetivos e estado bruto.
- [x] Tela Orçamentos: coluna "Aplicação" e legenda de origem; guest somente leitura.
- [x] Início/Custos passam a usar limites efetivos (alertas com recorrência).

## Fase 3 - Qualidade

- [x] Regras do Firestore para `recurringBudgets` (inclui `limit: null`) com testes no emulador.
- [x] Testes de serviço e de página (Orçamentos, Início).
- [x] `npm run verify` e `npm run test:rules` sem erros.
- [x] Validação visual em `light` e `dark`.

## Definição de pronto

- [x] Checklist DoD transversal aplicado conforme `specs/_template/dod-checklist.md`.
