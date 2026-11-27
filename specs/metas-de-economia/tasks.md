# Tasks - Metas de economia

> Referência obrigatória: usar e manter alinhado com `specs/_template/dod-checklist.md`.

## Fase 1 - Domínio

- [x] Entidades `SavingsGoal`, `GoalContribution`, `GoalSummary` e limites.
- [x] `savingsGoalRules`: validação de meta e movimentação, resumo (guardado, falta, %, situação, valor mensal), guardado no mês, ordenação e destaques do Início — em centavos.
- [x] Testes unitários.

## Fase 2 - Aplicação

- [x] `savingsGoalService` (assinaturas, criar/editar meta, registrar/excluir movimentação, excluir meta com movimentações em lotes) e caminhos/conversores.
- [x] `useSavingsGoals` (tempo real, ignora movimentações de meta excluída).
- [x] Tela **Metas** (`/goals`): criação, cartões com progresso, depósito/retirada, histórico, edição e exclusão com confirmação; `guest` somente leitura; item no menu.
- [x] Resumo "Metas de economia" no Início.

## Fase 3 - Qualidade

- [x] Regras do Firestore: `savingsGoals` e `goalContributions` (movimentação só em meta existente do usuário, imutável) com testes no emulador.
- [x] `npm run verify` e `npm run test:rules` sem erros.
- [x] Validação visual light/dark.
- [x] Revisão de QA.

## Definição de pronto

- [x] Checklist DoD transversal aplicado conforme `specs/_template/dod-checklist.md`.
- [ ] Publicar as regras (`npm run firestore:deploy`) antes do deploy do Hosting.
