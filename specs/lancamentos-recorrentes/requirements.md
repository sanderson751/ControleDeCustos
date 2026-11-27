# Requirements - Lançamentos recorrentes automáticos

## Contexto

Contas que se repetem todo mês (aluguel, condomínio, internet, assinaturas, escola) hoje precisam
ser lançadas manualmente a cada competência — ou parceladas, o que exige saber o fim. O usuário
quer cadastrar a conta uma vez e vê-la aparecer sozinha em todo mês.

Restrição: não há backend nem agendador (plano Spark). "Automático" significa que o próprio app
gera os lançamentos pendentes quando o usuário o abre, de forma idempotente.

## Requisitos funcionais

- RF-01: nova tela **Recorrentes** (`/recurring`) lista as recorrências do usuário: conta, valor, categoria, frente, dia do mês, início, situação (ativa/pausada) e último mês gerado.
- RF-02: criar recorrência com conta (1–200), valor (> 0), categoria ativa, frente (padrão **Fixo**), **dia do mês** (1–28), **mês de início** (de 12 meses atrás até 12 meses à frente) e descrição opcional (até 500).
- RF-03: **geração automática**: ao abrir o app, para cada recorrência ativa, são criados os lançamentos de todos os meses desde o início (ou desde o último mês gerado) até a competência atual. Meses futuros só são gerados quando chegarem.
- RF-04: cada lançamento gerado é um custo comum (1 parcela) na competência do mês, com data no dia configurado, os dados da recorrência e a marca "Recorrente" na listagem de Custos. Pode ser editado ou excluído como qualquer custo.
- RF-05: **idempotência**: abrir o app várias vezes, em várias abas ou dispositivos, nunca duplica um mês. Um lançamento gerado e excluído pelo usuário **não** é recriado.
- RF-06: ao criar (ou reativar) uma recorrência cujo início já chegou, os lançamentos pendentes são gerados na hora.
- RF-07: **editar** uma recorrência altera apenas os meses gerados dali em diante; lançamentos já gerados não mudam. Depois que há meses gerados, o **primeiro mês não pode ser alterado**; recorrências antigas (início fora da janela de 12 meses) continuam editáveis.
- RF-08: **pausar** interrompe a geração; **reativar** retoma a partir do mês atual (meses pausados não são gerados retroativamente).
- RF-09: **excluir** a recorrência (com confirmação) mantém os lançamentos já gerados.
- RF-10: após uma geração automática, snackbar de sucesso com a quantidade ("3 lançamentos recorrentes gerados."). Em falha, aviso amigável sem bloquear o uso do app: as telas esperam a geração por no máximo 4 segundos e recarregam o mês quando ela termina depois. Com o app aberto na virada do mês, o novo mês é gerado sem recarregar.
- RF-11: recuperação limitada a 24 meses por recorrência (quem fica muito tempo sem abrir o app não recebe uma avalanche de lançamentos antigos; os meses mais antigos são pulados).
- RF-12: `guest` visualiza as recorrências, sem criar, editar, pausar ou excluir, e não dispara geração.

## Requisitos não funcionais

- RNF-01: cálculo dos meses pendentes, validação e montagem dos lançamentos em funções puras testadas.
- RNF-02: `firestore.rules`: recorrências com dono, papel `admin|standard` para escrita, campos e tipos validados, categoria válida do próprio usuário; `costEntries` aceita `recurringId` opcional (texto curto).
- RNF-03: id determinístico `rec-<recorrência>-<AAAA-MM>` para os lançamentos gerados e cursor (`lastGenerated`) gravado no mesmo lote.
- RNF-04: tema light/dark com contraste AA; snackbar padrão; `npm run verify` e `npm run test:rules` sem erros.

## Critérios de aceite (Given/When/Then)

### Cenário 1 — criação com início no passado
- Given hoje é 27/11/2026
- When o usuário cria "Aluguel", R$ 2.000, dia 5, início 09/2026
- Then são gerados lançamentos em 09, 10 e 11/2026, datados no dia 5, e a recorrência mostra "Último gerado: 11/2026"

### Cenário 2 — virada do mês
- Given a recorrência gerou até 11/2026
- When o usuário abre o app em 03/12/2026
- Then o lançamento de 12/2026 é criado e aparece "1 lançamento recorrente gerado."

### Cenário 3 — sem duplicar
- Given o app já gerou 12/2026
- When o usuário abre o app em outra aba
- Then nenhum lançamento novo é criado

### Cenário 4 — exclusão de um mês
- Given o usuário excluiu o lançamento de 12/2026
- When reabre o app
- Then o lançamento não é recriado

### Cenário 5 — pausar e reativar
- Given a recorrência foi pausada em 12/2026 e reativada em 03/2027
- When o app gera os pendentes
- Then só 03/2027 é criado (01 e 02 não)

### Cenário 6 — editar
- Given o aluguel subiu para R$ 2.100 em 01/2027
- When o usuário edita a recorrência
- Then os meses seguintes saem com R$ 2.100 e os já gerados mantêm R$ 2.000

### Cenário 7 — guest
- Given um usuário `guest`
- When acessa `/recurring`
- Then vê a lista sem ações e nenhuma geração é disparada
