# Design - Controle de Custos Inicial

## Visao de solucao

A feature sera implementada no frontend React com separacao entre:
- componentes de interface;
- hooks de orquestracao;
- regras de negocio puras;
- servico de persistencia no Firestore.

## Modelo de dominio

- CostEntry
  - id: string
  - date: string (ISO)
  - amount: number
  - category: CostCategory
  - description?: string
- BudgetLimit
  - id: string
  - month: number
  - year: number
  - category: CostCategory
  - limit: number

## Regras de negocio

- totalDaCategoria = soma dos lancamentos filtrados por mes/ano/categoria.
- percentualConsumido = totalDaCategoria / limiteDaCategoria * 100.
- statusAlerta:
  - NORMAL quando < 80
  - ATENCAO quando >= 80 e < 100
  - ESTOURO quando >= 100

## Componentes propostos

- CostEntryForm
- CostEntryTable
- BudgetLimitForm
- CategoryBudgetCard
- MonthlySummary

## Hooks propostos

- useCostEntries(month, year)
- useBudgetLimits(month, year)
- useMonthlySummary(month, year)

## Estrategia de persistencia

- Persistencia principal: Firebase Firestore com colecoes por usuario.
- Escritas com `serverTimestamp()` para `createdAt` e `updatedAt`.
- Leitura por consultas indexadas por `userId`, `year`, `month` e `category`.
- Estrutura detalhada em `specs/controle-de-custos-inicial/firestore-structure.md`.

## Exemplo de fluxo

1. Usuario salva novo custo no formulario.
2. Hook `useCostEntries` persiste e atualiza estado.
3. Hook `useMonthlySummary` recalcula totais por categoria.
4. `CategoryBudgetCard` renderiza alerta conforme percentual.
