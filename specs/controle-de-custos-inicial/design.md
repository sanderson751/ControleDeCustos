# Design - Controle de Custos Inicial

## Visao de solucao

A feature sera implementada no frontend React com separacao entre:
- componentes de interface;
- hooks de orquestracao;
- regras de negocio puras;
- servico de persistencia no Firestore.

Padrao visual transversal:
- usar Material Design Icons Community (`@mdi/react` + `@mdi/js`) para controles de navegacao.
- em menu lateral retraido, apresentar tooltip com `react-tooltip` para manter legibilidade.
- aplicar controle de acesso: Admin e Standard podem editar/adicionar/remover, Guest apenas visualiza.

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
- permissoes:
  - Admin: canAdd, canEdit, canDelete (tudo verdadeiro)
  - Standard: canAdd, canEdit, canDelete (tudo verdadeiro)
  - Guest: canView apenas (outros false)
  - Elementos UI de acao devem ser ocultos (nao apenas desabilitados) para usuarios Guest

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
- useCanAccess(resource='costEntries', action='add|edit|delete') [integrado com controle-de-acesso]

## Estrategia de persistencia

- Persistencia principal: Firebase Firestore com colecoes por usuario.
- Escritas com `serverTimestamp()` para `createdAt` e `updatedAt`.
- Leitura por consultas indexadas por `userId`, `year`, `month` e `category`.
- Estrutura detalhada em `specs/controle-de-custos-inicial/firestore-structure.md`.
- Controle de acesso aplicado em frontend: botoes e formularios ocultos/habilitados conforme role (integrado com controle-de-acesso).

## Exemplo de fluxo

1. Usuario salva novo custo no formulario.
2. Hook `useCostEntries` persiste e atualiza estado.
3. Hook `useMonthlySummary` recalcula totais por categoria.
4. `CategoryBudgetCard` renderiza alerta conforme percentual.
