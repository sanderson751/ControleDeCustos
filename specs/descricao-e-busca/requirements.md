# Requirements - Descrição do lançamento e busca

## Contexto

Como usuário, quero registrar uma observação livre em cada lançamento (ex.: "presente de
aniversário da Ana", "parcela 2 do notebook") e encontrar lançamentos rapidamente digitando
parte da conta ou da descrição. O steering de produto prevê lançamentos com "valor, data,
categoria, descrição".

## Requisitos funcionais

- RF-01: o cadastro rápido e a edição de custo possuem o campo opcional **Descrição** (até 500 caracteres, com contador).
- RF-02: parcelas de um custo fixo herdam a descrição do cadastro.
- RF-03: a listagem de Custos exibe a descrição abaixo do nome da conta quando houver.
- RF-04: a listagem de Custos possui um campo **Buscar** que filtra, sem diferenciar maiúsculas/minúsculas nem acentos, pela conta ou descrição, combinado com os filtros de frente e categoria.
- RF-05: Relatórios exibem a descrição e a incluem nas exportações CSV e PDF.
- RF-06: lançamentos antigos sem descrição continuam válidos (descrição vazia).

## Requisitos não funcionais

- RNF-01: normalização da busca e validação da descrição em funções puras testadas.
- RNF-02: `description` validada em `firestore.rules` (opcional, texto, até 500 caracteres).
- RNF-03: compatibilidade `light`/`dark` com contraste AA; sem cores fixas para texto.
- RNF-04: snackbar padrão (top-right, 3s, `X`, vermelho/verde/amarelo).
- RNF-05: `npm run verify` e `npm run test:rules` sem erros.

## Regras de negócio

- RB-01: a descrição é opcional; espaços nas pontas são removidos; vazia é gravada como `""`.
- RB-02: descrições acima de 500 caracteres não são aceitas (warning no formulário e negação nas regras).

## Critérios de aceite (Gherkin)

### Cenário 1 - Cadastro com descrição

Given o formulário de cadastro rápido
When preencher os campos obrigatórios e a descrição "Presente da Ana"
Then o lançamento é gravado com `description = "Presente da Ana"`
And a listagem mostra a descrição abaixo da conta

### Cenário 2 - Edição da descrição

Given um lançamento existente
When alterar a descrição na edição e salvar
Then a nova descrição é gravada

### Cenário 3 - Busca

Given lançamentos "Mercado" (descrição "feira da semana") e "Farmácia"
When digitar "FEIRA" na busca
Then apenas "Mercado" é listado
And ao digitar "farmacia" (sem acento) apenas "Farmácia" é listado

### Cenário 4 - Limite de tamanho

Given uma descrição com 501 caracteres
When tentar salvar
Then nada é gravado e um snackbar amarelo informa o limite

### Cenário 5 - Relatórios

Given lançamentos com descrição
When abrir Relatórios ou exportar CSV/PDF
Then a coluna Descrição é exibida e exportada

### Cenário 6 - Lançamento legado

Given um lançamento sem o campo `description`
When exibi-lo ou editá-lo
Then a descrição aparece vazia e a edição grava `description = ""`

## Fora de escopo

- Busca no servidor (a busca filtra os lançamentos já carregados da competência).
- Anexos (comprovantes).
