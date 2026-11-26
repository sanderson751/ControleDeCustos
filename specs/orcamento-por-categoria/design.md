# Design - Orçamento mensal por categoria e alertas

## Visão de solução

Orçamentos ficam em `users/{uid}/budgetLimits` com id determinístico `AAAA-MM-categoria`
(garante unicidade por mês + categoria sem consulta prévia). Status e alertas são derivados
no client, combinando os lançamentos da competência (`useMonthCosts`) com os limites
(`useMonthBudgets`), por funções puras.

## Modelo de domínio

- `BudgetLimit { id, category, year, month, limit }`
- `BudgetStatus = "sem-orcamento" | "ok" | "atencao" | "estourado"`
- `CategoryBudgetSummary { category, spent, limit | null, percent | null, remaining | null, status }`

## Regras de negócio (`budgetRules.ts`)

- `BUDGET_WARNING_RATIO = 0.8`, `MAX_BUDGET_LIMIT = 1_000_000_000`.
- `getBudgetStatus(spent, limit)` — comparação em centavos inteiros (`spent*100 >= limit*80`), imune a erro de ponto flutuante.
- `getConsumedPercent` — percentual arredondado para baixo, coerente com o status (99,5% exibe 99%).
- `summarizeBudgets(entries, limits)` → um resumo por categoria (todas as 7), ordenado por status (estourado → atenção → ok → sem orçamento) e gasto.
- `getBudgetAlerts(summaries)` → resumos em atenção/estourado.
- `findWorsenedBudgets(before, after)` → categorias cujo status piorou (para o snackbar pós-cadastro).
- `buildBudgetDocId(year, month, category)`.
- `validateBudgetInput(value)` (> 0 e <= máximo).
- `planBudgetChanges(current, desired)` → listas `creates`, `updates` e `removals` (somente o que mudou).

## Componentes e hooks

- `useMonthBudgets(uid, competence)` → `{ limits, isLoading, error, reload }`.
- `BudgetsPage` (`/budgets`): `CompetencePicker`, tabela por categoria com input de moeda,
  `BudgetStatusBadge`, `Progress` colorido por status, "Copiar do mês anterior", "Salvar orçamentos".
- `BudgetAlerts` (Início): lista de alertas com ícone, texto e percentual.
- `CategoryBreakdown` (Início): consolidado por categoria + percentual do orçamento.
- `CostsPage`: após cadastrar, recarrega e chama `findWorsenedBudgets` → `notify("warning", …)`.
- Navegação: item "Orçamentos" visível para todos os papéis (guest somente leitura).

## Compatibilidade de tema e contraste

- Status: `bg-success|warning|danger` com `text-*-foreground` (contraste ≥ 7:1 nos dois temas).
- Status sempre com rótulo textual (acessibilidade para daltonismo).

## Feedback de operação

- Salvar: sucesso (verde), falha (vermelho), validação (amarelo). Cópia sem dados no mês anterior: amarelo.
- Alerta pós-cadastro: amarelo.

## Persistência e integrações

- Leitura: `where(year ==) + where(month ==)` (igualdade, sem índice composto novo).
- Escrita: `writeBatch` com `set` (novo, inclui `createdAt`), `update` (limite alterado) e `delete` (limite removido).
- Regras: dono + papel `admin|standard`; validação de categoria, ano, mês e limite; id obrigatoriamente igual a `AAAA-MM-categoria`; campos de identidade imutáveis.
- Falha ao carregar orçamentos: Início exibe aviso (alertas podem estar incompletos) e Custos avisa que os alertas não serão calculados.

## Fluxo principal

1. Usuário abre Orçamentos na competência da URL → carrega lançamentos e limites.
2. Edita os valores (ou copia do mês anterior) → "Salvar orçamentos".
3. `planBudgetChanges` gera o batch → Firestore → recarrega → snackbar.
4. Início e Custos refletem status/alertas da competência.
