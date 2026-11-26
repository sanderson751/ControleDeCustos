# Requirements - Orçamento recorrente

## Contexto

Como usuário, quero definir o orçamento de uma categoria uma única vez e que ele valha para os
meses seguintes, sem precisar copiar mês a mês, mantendo a possibilidade de ajustar um mês
específico e sem alterar o histórico de meses anteriores.

## Requisitos funcionais

- RF-01: na tela Orçamentos, cada categoria possui o modo de aplicação **"Só este mês"** ou **"Este mês em diante"** (recorrente).
- RF-02: no modo "Este mês em diante", o valor passa a valer para a competência visualizada e todas as seguintes, até ser alterado ou encerrado.
- RF-03: alterar o valor recorrente em um mês cria uma nova vigência a partir daquele mês; meses anteriores continuam com o valor antigo.
- RF-04: deixar o valor em branco no modo "Este mês em diante" encerra a recorrência a partir daquele mês (meses anteriores mantêm o orçamento).
- RF-05: o modo "Só este mês" define uma exceção apenas para a competência visualizada; a recorrência continua nos meses seguintes.
- RF-06: quando houver orçamento mensal (exceção) e recorrente para o mesmo mês, prevalece o mensal.
- RF-07: a tela indica a origem do limite de cada categoria: "Recorrente desde <mês>" ou "Somente neste mês"; quando há exceção sobre uma recorrência, exibe o valor recorrente como referência.
- RF-08: Início (alertas e consolidado) e Custos (alerta pós-cadastro) consideram o limite efetivo (exceção mensal ou recorrente).
- RF-09: guest visualiza a origem dos limites, sem editar.
- RF-10: "Este mês em diante" substitui também as vigências futuras da categoria (alterações já agendadas para meses posteriores são removidas), e a legenda avisa antes de salvar.
- RF-11: "Copiar do mês anterior" não altera categorias em "Este mês em diante" (a recorrência já governa o mês); o aviso lista as categorias mantidas.
- RF-12: "Só este mês" com valor igual ao recorrente cria a exceção (fixa o valor do mês); com valor vazio sobre uma recorrência ativa nada é gravado e um aviso amarelo orienta usar "Este mês em diante" para encerrar.
- RF-13: a legenda de origem acompanha o rascunho (antes de salvar) e descreve o efeito: nova vigência, encerramento ou substituição de alterações futuras.

## Requisitos não funcionais

- RNF-01: resolução do limite efetivo e plano de gravação em funções puras testadas.
- RNF-02: vigências recorrentes persistidas em `users/{uid}/recurringBudgets/{AAAA-MM-categoria}` e validadas por `firestore.rules`.
- RNF-03: gravação atômica (um `writeBatch` com orçamentos mensais e recorrentes).
- RNF-04: compatibilidade `light`/`dark` com contraste AA; sem cores fixas para texto.
- RNF-05: snackbar padrão (top-right, 3s, `X`, vermelho/verde/amarelo).
- RNF-06: `npm run verify` e `npm run test:rules` sem erros.

## Regras de negócio

- RB-01: o limite efetivo de uma categoria em um mês é: exceção mensal, se existir; senão a vigência recorrente mais recente iniciada até aquele mês; senão "sem orçamento".
- RB-02: uma vigência encerrada (sem valor) interrompe a recorrência a partir do seu mês.
- RB-03: o valor recorrente segue as mesmas regras do orçamento mensal (> 0 e <= R$ 1.000.000.000,00).

## Critérios de aceite (Gherkin)

### Cenário 1 - Criar recorrência

Given a categoria Alimentação sem orçamento em 03/2026
When escolher "Este mês em diante", informar R$ 1.200,00 e salvar
Then é gravada a vigência `2026-03-alimentacao` com limite 1200
And Alimentação aparece com R$ 1.200,00 em 03/2026, 04/2026 e meses seguintes
And em 02/2026 continua sem orçamento

### Cenário 2 - Alterar a recorrência a partir de um mês

Given recorrência de R$ 1.200,00 desde 03/2026
When em 06/2026 alterar para R$ 1.500,00 em "Este mês em diante" e salvar
Then 03/2026 a 05/2026 continuam com R$ 1.200,00
And 06/2026 em diante passam a R$ 1.500,00

### Cenário 3 - Exceção em um mês

Given recorrência de R$ 1.200,00 desde 03/2026
When em 07/2026 escolher "Só este mês", informar R$ 2.000,00 e salvar
Then 07/2026 usa R$ 2.000,00 e indica a recorrência de R$ 1.200,00 como referência
And 08/2026 volta a usar R$ 1.200,00

### Cenário 4 - Encerrar a recorrência

Given recorrência ativa desde 03/2026
When em 09/2026 apagar o valor em "Este mês em diante" e salvar
Then a partir de 09/2026 a categoria fica sem orçamento
And 03/2026 a 08/2026 mantêm o orçamento recorrente

### Cenário 5 - Alertas com orçamento recorrente

Given recorrência de R$ 1.000,00 para Lazer desde 01/2026
And gastos de Lazer de R$ 850,00 em 04/2026
When abrir o Início em 04/2026
Then é exibido alerta de atenção para Lazer (85%)

### Cenário 6 - Falha de persistência

Given uma falha de rede ou permissão
When salvar orçamentos recorrentes
Then nada é gravado (batch atômico), um snackbar vermelho é exibido e os valores digitados são mantidos

### Cenário 7 - Guest

Given um usuário guest
When abrir Orçamentos
Then vê a origem de cada limite sem controles de edição
And as regras do Firestore negam escrita em `recurringBudgets`

## Fora de escopo

- Desativar o orçamento apenas em um mês mantendo a recorrência (exceção "sem limite").
- Recorrência com periodicidade diferente de mensal.
