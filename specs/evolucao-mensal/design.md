# Design - Evolução mensal

## Visão de solução

Tela `/evolution` com filtros em uma linha → indicadores (stat tiles) → card com gráfico SVG
próprio (sem biblioteca de gráficos, para controlar as especificações de marcas e o bundle)
e alternância para tabela. Os dados vêm de uma carga única por período (custos por ano de
competência + orçamentos mensais dos anos + vigências recorrentes) e são agregados no client.

## Escolha de forma (guia de visualização)

- Trabalho: tendência ao longo do tempo com comparação a um limite → **colunas** (gasto) +
  **linha** (orçamento), **um único eixo** (mesma unidade, R$). Nunca eixo duplo.
- 7 categorias empilhadas excederiam o recomendado de séries; a categoria vira filtro.
- Rótulo direto só no último mês; demais valores no eixo, tooltip e tabela.

## Paleta (validada)

| Papel | Light (superfície `#ffffff`) | Dark (superfície `#1b1c1d`) |
| --- | --- | --- |
| Gasto (colunas) | `#6c63f2` | `#847dff` (Iris Gleam) |
| Orçamento (linha) | `#0a92b8` | `#0aa6cf` (Cyan Signal ajustado) |

Validador: faixa de luminosidade, croma, separação CVD (ΔE 12,4 light / 10,0 dark), visão
normal e contraste ≥ 3:1 — todos PASS. Tokens `--chart-spent` e `--chart-budget` em `index.css`.

## Modelo de domínio (`evolutionRules.ts`)

- `MonthlyPoint { competence, spent, budget | null, isOverBudget }`.
- `listCompetences(end, count)` → competências em ordem cronológica.
- `buildMonthlyEvolution({ entries, monthLimits, recurring, competences, category, costType })`:
  soma por competência com filtros; orçamento via `resolveEffectiveBudgets` por mês (soma
  das categorias ou a categoria filtrada); `null` quando frente ≠ todos ou sem orçamento.
- `summarizeEvolution(points)` → `{ average, peak, lastChange, monthsOverBudget, monthsWithBudget }`.
- `niceStep`/`buildAxisTicks(max)` → escala com valores redondos e eixo mínimo de R$ 10 (sem ticks duplicados/sub-centavo; rótulos com centavos quando o passo não é inteiro).

## Persistência

- `listCostsByCompetenceRange(uid, from, to)`: `where("competenceYear", "in", anos)` + filtro de meses no client.
- `listBudgetLimitsByYears(uid, anos)`: `where("year", "in", anos)`.
- `loadEvolutionData(uid, from, to)`: as duas consultas + `listRecurringBudgets` em paralelo.
- Sem novas coleções, regras ou índices (filtros de igualdade/`in` em campo único).

## Componentes e hooks

- `useEvolutionData(uid, end, months)`: baseado em `useCompetenceResource` (proteção contra corridas).
- Revisão de QA incorporada: período faz parte da chave de carregamento (troca limpa dados/erro), estado de erro explícito e indicadores em "—" sem dados válidos; rótulo do último mês só quando cabe na faixa; rótulos de mês alternados em faixas estreitas; tooltip limitado à largura; hover e foco independentes; alvos com `role="img"`.
- `MonthlyEvolutionChart`: SVG responsivo (largura medida por `ResizeObserver`), colunas ≤ 24px
  com topo arredondado 4px, linha 2px com marcadores r=4 e anel de 2px, grade sólida fina,
  eixo Y com valores compactos, legenda (retângulo = gasto, traço = orçamento), alvo de hover
  por coluna (faixa inteira, focável por teclado) e tooltip com valor em destaque.
- `EvolutionTable`: visão em tabela (gêmeo acessível do gráfico).
- `EvolutionPage`: filtros, indicadores (`StatTile` neutros), card com gráfico/tabela.

## Tema e acessibilidade

- Texto sempre em tokens de texto (nunca na cor da série).
- Situação "acima do orçamento" com texto (não só cor).
- `role="img"` + `aria-label` descritivo no SVG; colunas como botões focáveis com rótulo.
