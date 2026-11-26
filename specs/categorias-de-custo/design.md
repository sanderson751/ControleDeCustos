# Design - Categorias de custo e visão mensal por categoria

## Visão de solução

A categoria entra como campo obrigatório de `CostEntry`, validada no client (regra pura) e nas
regras do Firestore. A competência visualizada passa a ser estado de URL (`?mes=AAAA-MM`),
compartilhado por Início, Custos e Orçamentos via hook `useCompetenceParam`.

## Modelo de domínio

- `COST_CATEGORIES = ["moradia", "alimentacao", "transporte", "saude", "educacao", "lazer", "outros"]`
- `CostCategory` (union dos valores acima) e `COST_CATEGORY_LABELS` (rótulos acentuados).
- `CostEntry.category: CostCategory`; `NewCostInput.category`; `UpdateCostInput.category`.
- `Competence { year: number; month: number }`.

## Regras de negócio (funções puras)

- `costRules.ts`
  - `normalizeCategory(value)` → categoria válida ou `"outros"` (legado).
  - `filterCosts(entries, { costType, category })`.
  - `sumByCategory(entries)` → `CategoryTotal[]` com `{ category, total, share }`, ordenado desc, sem categorias zeradas.
  - `validateCostForm` passa a exigir categoria (`"Selecione uma categoria."`).
- `competence.ts`
  - `parseCompetenceParam("2026-11")`, `toCompetenceParam`, `shiftCompetence(c, ±n)`,
    `isSameCompetence`, `formatCompetenceLong` ("novembro de 2026"),
    `defaultDateForCompetence(c, now)` (hoje se for o mês atual; senão o mesmo dia limitado ao fim do mês).

## Componentes e hooks

- `useCompetenceParam()` → `{ competence, isCurrent, setCompetence }` (URL search param; "Mês atual" = `setCompetence(getCurrentCompetence())`).
- `useCompetenceResource` (base de `useMonthCosts`/`useMonthBudgets`): descarta respostas fora de ordem e `reload` de closures antigas, e limpa os dados ao trocar de competência.
- `CompetencePicker` → botões "Mês anterior", "Próximo mês" (com `Tooltip`, desabilitados fora de 2000-01..2100-12), "Mês atual" + rótulo longo.
- Ao sair da edição, a navegação volta para a competência do lançamento (`withCompetence`).
- `CostFormFields` ganha o campo Categoria (`NativeSelect` do shadcn/ui).
- `CostQuickAddForm` (extraído de `CostsPage`): remontado por `key` ao trocar competência; data manual pré-ativada fora do mês atual.
- `CategoryBreakdown` (Início): lista com valor, participação e barra (`Progress`), combinada ao orçamento (ver spec `orcamento-por-categoria`).
- Relatórios: filtro de categoria aplicado no client sobre o resultado da consulta (evita novo índice composto).

## Padrão visual de ícones

- `lucide-react`; botões icon-only com `aria-label` e `Tooltip` do shadcn/ui.

## Compatibilidade de tema e contraste

- Somente tokens semânticos; barras de participação usam `bg-primary` (neutro) e cores de status do orçamento.

## Feedback de operação

- `notify()` para sucesso/erro/warning (validação de categoria é warning).

## Persistência e integrações

- Escrita: `category` incluído em create (todas as parcelas) e update.
- Leitura: `toCostEntry` normaliza categoria ausente/ inválida para `"outros"`.
- Regras: `isValidCost` exige `category` na lista padrão.
- Índices: sem novos índices (filtro de categoria no client).

## Fluxo principal

1. Usuário escolhe a competência (URL) → `useMonthCosts(uid, year, month)`.
2. Preenche o cadastro com categoria → `createCostEntry` (batch de parcelas).
3. Lista e Início recalculam totais e consolidado por categoria a partir do Firestore.
