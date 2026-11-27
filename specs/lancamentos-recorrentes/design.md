# Design - Lançamentos recorrentes automáticos

## Visão geral

```
AppShell ─► useRecurringSync (admin/standard; ao abrir e na virada do mês)
              │ listRecurringCosts → pendingCompetences (puro) filtra quem tem pendência
              └► generateRecurring (transação por recorrência):
                   get recurringCosts/<id> (cursor do servidor)
                   set costEntries/rec-<id>-<AAAA-MM>  (id determinístico)
                   update recurringCosts/<id>.lastGenerated (cursor)

RecurringPage (/recurring) ─► subscribeToRecurringCosts (tempo real)
                           ─► create/update/pause/resume/delete + geração imediata
```

Na primeira sincronização as rotas esperam por no máximo 4 s (rede lenta/offline nunca trava o
app). Quando lançamentos são criados, `RecurringSyncContext` incrementa uma versão e
`useMonthCosts` recarrega o mês já aberto. A sincronização roda de novo na virada do mês (checagem
horária) e uma falha apenas avisa.

## Domínio

`src/domain/entities/recurringCost.ts`: `RecurringCost`, `RecurringCostInput`,
`MAX_CATCH_UP_MONTHS = 24`, `MAX_RECURRING_DAY = 28`, `START_WINDOW_MONTHS = 12`.

`src/domain/rules/recurringCostRules.ts` (puro):

| Função | Responsabilidade |
| ------ | ---------------- |
| `validateRecurringForm(values, now)` | Conta, valor, categoria, dia 1–28, início na janela de ±12 meses, descrição ≤ 500. |
| `pendingCompetences(template, current)` | Meses de `max(início, cursor + 1)` até a competência atual, só se ativa; mantém os últimos 24. |
| `buildOccurrenceId(id, competence)` | `rec-<id>-<AAAA-MM>`. |
| `occurrenceDate(competence, day)` | Data ao meio-dia local no dia configurado. |
| `resumeCursor(template, current)` | Ao reativar: cursor = máximo(cursor, mês anterior ao atual). |

## Serviço (`src/services/recurringCostService.ts`)

- `listRecurringCosts`, `subscribeToRecurringCosts`, `createRecurringCost`, `updateRecurringCost`,
  `setRecurringCostActive` (reativar ajusta o cursor), `deleteRecurringCost`.
- `generateRecurring(userId, id)`: **transação por recorrência** — lê a recorrência no servidor,
  recalcula os meses a partir do cursor atual e grava ocorrências (id determinístico) + cursor de
  forma atômica (≤ 25 escritas). Outra aba/dispositivo que gerou antes faz a transação recalcular
  sem regravar; um mês excluído nunca volta; não há lote dividido entre ocorrências e cursor.
- `syncRecurringCosts(userId)`: lista, filtra quem tem pendência e gera cada uma isolando falhas;
  retorna `{ created, failed }`.
- Pausar grava só `active: false`; reativar calcula o cursor numa transação (dados do servidor).

## UI

- `useRecurringSync` (em `AppShell`): para quem pode editar custos, executa `syncRecurringCosts`
  ao abrir e na virada do mês; na primeira vez exibe "Atualizando lançamentos recorrentes..." por
  no máximo 4 s e notifica o resultado.
- Edição: o primeiro mês fica travado quando já há meses gerados; seletores de mês/ano (o
  `input type="month"` não existe no Firefox/Safari desktop) limitados à janela de ±12 meses.
- `RecurringPage`: formulário de criação (card) e tabela com ações (editar em diálogo,
  pausar/reativar, excluir com confirmação). `guest` sem ações.
- Custos: badge "Recorrente" nos lançamentos com `recurringId`.
- Menu: "Recorrentes" (`RepeatIcon`).

## Decisões

- **Geração no cliente** (sem Cloud Functions no plano Spark) com id determinístico + cursor.
- **Cursor em vez de verificar existência**: permite excluir um mês sem que ele volte.
- **Dia 1–28**: evita meses sem o dia (29–31) e mantém a regra simples.
- **Sem data de término**: pausar ou excluir encerra; parcelamento continua existindo para contas com fim.
