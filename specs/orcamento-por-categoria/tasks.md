# Tasks - Orçamento mensal por categoria e alertas

> Referência obrigatória: usar e manter alinhado com `specs/_template/dod-checklist.md`.

## Fase 1 - Domínio

- [x] `BudgetLimit`, `BudgetStatus`, `CategoryBudgetSummary` em `src/domain/entities/budget.ts`.
- [x] `budgetRules.ts`: status (80%/100%), resumo por categoria, alertas, piora de status, id determinístico, validação e plano de alterações.
- [x] Testes unitários (inclui o cenário do steering: R$ 980 de R$ 1.200 = 82%).
- [x] `firestore-structure.md` da feature.

## Fase 2 - Aplicação

- [x] `budgetService` (listar por competência; batch de create/update/delete).
- [x] `useMonthBudgets`.
- [x] Tela `/budgets` com limites, consumo, status, "Copiar do mês anterior" e "Salvar orçamentos"; guest somente leitura.
- [x] Alertas no Início (`BudgetAlerts`) e consumo no consolidado por categoria.
- [x] Snackbar de alerta após cadastrar custo que piora o status da categoria.
- [x] Item "Orçamentos" no menu (todos os papéis).

## Fase 3 - Qualidade

- [x] Regras do Firestore para `budgetLimits` com testes no emulador.
- [x] Testes de serviço e de página (Orçamentos, Início, Custos).
- [x] `npm run verify` sem erros.
- [x] Validação visual em `light` e `dark`; status sempre com rótulo textual.

## Definição de pronto

- [x] Checklist DoD transversal aplicado conforme `specs/_template/dod-checklist.md`.
