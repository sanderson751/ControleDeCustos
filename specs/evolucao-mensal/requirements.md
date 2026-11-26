# Requirements - Evolução mensal

## Contexto

Como usuário, quero ver como meus gastos evoluíram mês a mês e compará-los com o orçamento,
para identificar tendências (meses atípicos, categorias que crescem) e ajustar o planejamento.

## Requisitos funcionais

- RF-01: nova tela **Evolução** (`/evolution`) no menu, disponível para todos os papéis (somente leitura).
- RF-02: gráfico de colunas com o **gasto total por mês de competência** e uma linha com o **orçamento efetivo** do mês (exceção mensal ou recorrente), no mesmo eixo em R$.
- RF-03: filtros em uma única linha acima do conteúdo: mês final (seletor de competência, `?mes=`), período (**6 ou 12 meses**), categoria (todas ou uma) e frente (todas, fixo, variável).
- RF-04: com categoria "Todas", o orçamento é a soma dos limites efetivos das categorias no mês; com uma categoria, o limite efetivo daquela categoria.
- RF-05: com frente "Fixo" ou "Variável", a linha de orçamento não é exibida (orçamentos não são por frente) e a tela explica o motivo.
- RF-06: tooltip por mês (mouse e teclado) com gasto, orçamento e diferença; meses acima do orçamento indicados por texto.
- RF-07: alternância para **visão em tabela** com os mesmos dados (mês, gasto, orçamento, situação).
- RF-08: indicadores do período: média mensal, mês de maior gasto, variação do último mês em relação ao anterior e quantidade de meses acima do orçamento.
- RF-09: meses sem lançamentos aparecem com gasto zero (o eixo de tempo é contínuo).

## Requisitos não funcionais

- RNF-01: agregações em funções puras testadas (`evolutionRules.ts`).
- RNF-02: no máximo 2 consultas de custos (filtro `competenceYear in [...]`) e 1 de orçamentos mensais por carregamento; sem novos índices.
- RNF-03: paleta validada pelo validador de paleta (CVD, faixa de luminosidade, contraste) em light e dark; cores por tokens.
- RNF-04: marcas finas (colunas ≤ 24px, cantos de 4px no topo, base reta), linha de 2px, marcadores ≥ 8px com anel de 2px na cor da superfície, grade em linhas finas sólidas.
- RNF-05: legenda sempre presente (duas séries); rótulo direto apenas no último mês.
- RNF-06: identidade nunca só por cor (legenda + forma: coluna x linha) e valores acessíveis sem hover (tabela).
- RNF-07: snackbar padrão em falha de carregamento.
- RNF-08: `npm run verify` e `npm run test:rules` sem erros.

## Regras de negócio

- RB-01: o gasto de um mês é a soma dos lançamentos da competência que atendem aos filtros.
- RB-02: um mês está "acima do orçamento" quando o gasto ≥ orçamento (mesmo critério de estouro, comparação em centavos).
- RB-03: a variação do último mês é percentual sobre o mês anterior; indefinida quando o mês anterior é zero.

## Critérios de aceite (Gherkin)

### Cenário 1 - Evolução dos últimos 6 meses

Given lançamentos de 06/2026 a 11/2026
When abrir Evolução em 11/2026 com período de 6 meses
Then o gráfico exibe 6 colunas de jun/2026 a nov/2026 com o gasto de cada mês
And o último mês exibe o valor como rótulo

### Cenário 2 - Orçamento no gráfico

Given orçamento recorrente de R$ 1.000,00 para Lazer desde 08/2026
When filtrar a categoria Lazer
Then a linha de orçamento aparece a partir de ago/2026 com R$ 1.000,00
And meses com gasto de Lazer ≥ R$ 1.000,00 aparecem como "acima do orçamento" no tooltip e na tabela

### Cenário 3 - Filtro de frente

Given o filtro de frente "Fixo"
When o gráfico é exibido
Then apenas custos fixos são somados
And a linha de orçamento não aparece, com aviso explicando que orçamentos não são por frente

### Cenário 4 - Tabela

Given o gráfico carregado
When escolher "Ver tabela"
Then uma tabela lista cada mês com gasto, orçamento e situação

### Cenário 5 - Indicadores

Given gastos de R$ 100, R$ 300 e R$ 200 nos últimos 3 meses de um período
Then a média mensal considera todos os meses do período
And o mês de maior gasto é o de R$ 300
And a variação do último mês é -33%

### Cenário 6 - Falha de carregamento

Given falha de rede ou permissão
When abrir Evolução
Then um snackbar vermelho informa a falha

## Fora de escopo

- Séries empilhadas por categoria (7 séries excedem a recomendação de cores; usar o filtro de categoria).
- Previsão/projeção de gastos.
