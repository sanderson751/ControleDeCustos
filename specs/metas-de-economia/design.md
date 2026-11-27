# Design - Metas de economia

## Visão geral

```
GoalsPage (/goals) ─┐
HomePage (resumo) ──┴─► useSavingsGoals(userId)
                          ├─ subscribeToGoals          users/{uid}/savingsGoals
                          └─ subscribeToContributions  users/{uid}/goalContributions
                          ▼
                    summarizeGoal / savedInCompetence (puros)
```

Movimentações ficam numa coleção única do usuário (`goalContributions`, com `goalId`) para que
uma assinatura atenda todas as metas e o resumo do Início.

## Domínio

`src/domain/entities/savingsGoal.ts`: `SavingsGoal`, `GoalContribution` (valor com sinal:
depósito > 0, retirada < 0), `GoalSummary`, `GoalStatus` e limites (`MAX_GOAL_NAME_LENGTH = 60`,
`MAX_CONTRIBUTION_NOTE_LENGTH = 200`, `MAX_GOAL_AMOUNT = 1.000.000.000`).

`src/domain/rules/savingsGoalRules.ts` (puro, centavos inteiros):

| Função | Responsabilidade |
| ------ | ---------------- |
| `validateGoalForm(values, goals, now, { editingId, originalDeadline })` | Nome 1–60 e único (sem acento/caixa), alvo > 0, prazo a partir do mês atual (na edição, o prazo salvo continua aceito). |
| `validateContribution(values, saved, now)` | Valor > 0, data até hoje (desde 2000), observação ≤ 200, retirada ≤ guardado. |
| `summarizeGoal(goal, contributions, now)` | Guardado, falta, %, situação, meses restantes e valor mensal sugerido. |
| `savedInCompetence(contributions, competence)` | Depósitos − retiradas no mês. |
| `homeGoalHighlights(summaries)` | Até 3 em andamento/atrasadas, prazo mais próximo primeiro. |

## Serviço (`src/services/savingsGoalService.ts`)

`subscribeToGoals`, `subscribeToContributions`, `createGoal`, `updateGoal`, `addContribution`,
`deleteContribution` e `deleteGoal` (exclui movimentações + meta em lotes via `commitInChunks`;
a meta é excluída por último, então uma falha no meio nunca deixa movimentação sem meta visível).

## UI

- Hook `useSavingsGoals(userId)`: assina metas e movimentações; expõe `goals`, `contributions`,
  `summaries`, `isLoading`, `error`.
- `GoalsPage`: card "Nova meta"; grade de `GoalCard` (progresso com `Progress`, situação em badge
  com texto, ações: Movimentar, Histórico, Editar, Excluir); diálogos `GoalFormDialog`,
  `ContributionDialog`, `GoalHistoryDialog`; confirmação de exclusão.
- `HomePage`: `GoalsSummary` (guardado no mês + destaques), oculto quando não há metas.
- Menu: "Metas" (`TargetIcon`).

## Decisões

- Movimentações imutáveis (sem edição): simplifica regras e histórico; corrigir = excluir + registrar.
- Retirada limitada ao guardado no cliente (as regras não somam documentos).
- Sem vínculo automático com custos/receitas: guardar dinheiro é um registro explícito.
