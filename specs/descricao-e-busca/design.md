# Design - Descrição do lançamento e busca

## Visão de solução

Campo opcional `description` em `CostEntry`, gravado no create (todas as parcelas) e no
update. A busca é local (sobre os lançamentos da competência já carregados), com
normalização sem acentos e sem caixa — nenhuma consulta ou índice novo.

## Modelo de domínio

- `CostEntry.description: string` (vazio quando ausente).
- `NewCostInput.description?: string`, `UpdateCostInput.description: string`.
- `MAX_DESCRIPTION_LENGTH = 500`.

## Regras puras (`costRules.ts`)

- `normalizeSearchText(value)` → minúsculas, sem acentos (NFD), espaços colapsados.
- `matchesSearch(entry, term)` → termo normalizado contido na conta **ou** na descrição (campos avaliados separadamente).
- Exportação CSV: `neutralizeFormula` prefixa com apóstrofo células iniciadas por `=`, `+`, `-`, `@`, tab ou CR (evita injeção de fórmulas).
- `filterCosts(entries, { costType, category, search })`.
- `validateCostForm` → descrição até 500 caracteres (`"A descrição pode ter no máximo 500 caracteres."`).

## Componentes

- `CostFormFields`: `Textarea` "Descrição (opcional)" com contador `n/500`.
- `CostsPage`: campo "Buscar" (ícone de lupa) na linha de filtros da listagem; descrição em
  texto secundário (`text-muted-foreground`) abaixo da conta.
- `ReportsPage` e exportações: coluna "Descrição".

## Persistência

- `toCostEntry`: `description` ausente/inválida → `""`.
- Regras: `isValidCost` passa a exigir `data.get('description', '') is string` e tamanho ≤ 500.

## Tema e acessibilidade

- Busca com `aria-label`; descrição em token de texto secundário; contador ligado ao campo por `aria-describedby`, contando o texto aparado e com `aria-invalid` acima do limite.
