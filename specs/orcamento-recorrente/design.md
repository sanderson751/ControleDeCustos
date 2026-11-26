# Design - Orçamento recorrente

## Visão de solução

Vigências recorrentes são registros imutáveis no tempo: cada alteração grava um documento
`AAAA-MM-categoria` ("a partir deste mês"), com `limit` numérico ou `null` (encerramento).
O limite efetivo de um mês é resolvido no client: exceção mensal (`budgetLimits`) →
vigência recorrente mais recente com início ≤ mês → sem orçamento. Isso preserva o histórico
sem reescrever meses passados e sem jobs agendados (plano Spark, sem Cloud Functions).

## Modelo de domínio

- `RecurringBudget { id, category, year, month, limit: number | null }` — vigência a partir de `year/month`.
- `BudgetSource = "mensal" | "recorrente"`.
- `EffectiveBudget = BudgetLimit & { source; recurringFrom?: Competence; recurringLimit?: number | null }`.
- `BudgetMode = "mensal" | "recorrente"` (modo de aplicação escolhido no formulário).
- `MonthBudgetState { monthLimits, recurring, effective }`.

## Regras de negócio (`recurringBudgetRules.ts`)

- `resolveRecurringFor(recurring, category, competence)` → vigência ativa (mais recente com início ≤ competência) ou `null`.
- `resolveEffectiveBudgets(monthLimits, recurring, competence)` → limites efetivos por categoria (mensal prevalece).
- `defaultBudgetMode(category, state)` → `"recorrente"` quando o limite efetivo vem da recorrência; senão `"mensal"`.
- `futureRecurringFor(recurring, category, competence)` → vigências que começam depois do mês.
- `planMonthBudgetChanges(state, competence, desired)` → `{ monthly: BudgetChangePlan, recurring: RecurringChange[], ignored: CostCategory[] }`:
  - modo mensal + valor: cria/atualiza exceção (inclusive igual ao recorrente, fixando o mês);
  - modo mensal + vazio: remove exceção; sem exceção e com recorrência ativa → `ignored` (aviso na tela);
  - modo recorrente: remove exceção do mês; grava vigência no mês quando o valor difere da recorrência ativa (valor `null` encerra; só grava encerramento se houver recorrência ativa) e remove (`delete`) as vigências futuras da categoria;
  - vigência no mesmo mês já existente → `update`; senão `create`. Cada mudança carrega `start` (mês da vigência afetada).
- "Copiar do mês anterior" preenche apenas categorias em modo "Só este mês".
- Legenda (`describeDraftOrigin`) calculada a partir do rascunho (modo + valor), vigência ativa e futuras.

> Decisões oriundas da revisão de QA: evitar que a cópia encerre/altere recorrências sem aviso,
> alinhar "Este mês em diante" ao rótulo (substitui o futuro) e dar feedback para operações sem efeito.

## Componentes e hooks

- `useMonthBudgets` passa a carregar `{ monthLimits, recurring }` e expõe `limits` = limites efetivos (Início e Custos sem mudança de contrato) e `state` (tela Orçamentos).
- `useCompetenceResource` generalizado para qualquer tipo de dado (valor vazio estável por parâmetro).
- `BudgetsPage`: coluna "Aplicação" (`NativeSelect`: "Só este mês" / "Este mês em diante") e legenda de origem por linha.

## Compatibilidade de tema e contraste

- Legendas de origem com `text-muted-foreground`; nenhuma cor nova.

## Feedback de operação

- Sucesso/erro/validação como na feature `orcamento-por-categoria`.

## Persistência e integrações

- Leitura: `recurringBudgets` inteira do usuário (poucos documentos: ≤ 7 categorias × alterações).
- Escrita: um `writeBatch` com operações de `budgetLimits` e `recurringBudgets`.
- Regras: espelham `budgetLimits`, aceitando `limit == null` (encerramento).

## Fluxo principal

1. Abrir Orçamentos na competência → carregar exceções do mês + vigências → resolver limites efetivos.
2. Usuário ajusta valor e modo por categoria → `planMonthBudgetChanges` → batch → recarregar.
3. Início/Custos usam os limites efetivos para status e alertas.
