# Requirements - Categorias de custo e visão mensal por categoria

## Contexto

Como usuário, quero classificar cada lançamento em uma categoria e navegar entre meses de
competência para entender para onde o dinheiro está indo em cada mês (steering de produto:
"Todo lançamento deve possuir categoria" e "Visão mensal consolidada por categoria").

## Requisitos funcionais

- RF-01: todo lançamento deve possuir uma categoria entre as categorias padrão: Moradia, Alimentação, Transporte, Saúde, Educação, Lazer e Outros.
- RF-02: o cadastro rápido e a edição de custo devem exigir a seleção de categoria.
- RF-03: lançamentos antigos sem categoria devem ser exibidos e consolidados como "Outros".
- RF-04: a listagem de custos deve exibir a categoria e permitir filtrar por categoria, em conjunto com o filtro por frente.
- RF-05: as telas Início e Custos devem permitir navegar entre competências (mês anterior, próximo e voltar ao mês atual); a competência fica na URL (`?mes=AAAA-MM`).
- RF-06: ao visualizar uma competência diferente da atual, o cadastro rápido deve sugerir a data de criação dentro da competência visualizada.
- RF-07: a tela Início deve exibir o consolidado do mês por categoria (valor gasto e participação no total), ordenado do maior para o menor.
- RF-08: relatórios devem exibir a coluna Categoria, permitir filtrar por categoria e incluir a categoria nas exportações CSV e PDF.

## Requisitos não funcionais

- RNF-01: o consolidado por categoria deve ser calculado por função pura testada (`sumByCategory`).
- RNF-02: a categoria deve ser validada nas regras do Firestore (somente valores da lista padrão).
- RNF-03: toda interface compatível com `light` e `dark` sem perda de legibilidade.
- RNF-04: contraste mínimo AA (texto normal >= 4.5:1, texto grande >= 3:1).
- RNF-05: proibido usar cor fixa para texto crítico quando o fundo variar por tema.
- RNF-06: operações com erro/sucesso/warning exibem snackbar (top-right, 3s, `X`, vermelho/verde/amarelo).
- RNF-07: a categoria é persistida no Firestore em `users/{uid}/costEntries/{id}.category`.
- RNF-08: cada escrita tem critério de sucesso e falha de persistência.
- RNF-09: `npm run verify` sem erros e `npm run test:rules` verde.

## Regras de negócio

- RB-01: a categoria é obrigatória e pertence à lista padrão (valores persistidos sem acento: `moradia`, `alimentacao`, `transporte`, `saude`, `educacao`, `lazer`, `outros`).
- RB-02: o consolidado mensal considera a competência do lançamento.
- RB-03: parcelas de um custo fixo herdam a categoria do cadastro.

## Critérios de aceite (Gherkin)

### Cenário 1 - Cadastro com categoria

Given um usuário standard na tela Custos
When preencher conta, valor, frente e categoria "Alimentação" e clicar em "Adicionar custo"
Then o lançamento é persistido com `category = "alimentacao"`
And um snackbar verde confirma o cadastro

### Cenário 2 - Categoria obrigatória

Given o formulário de cadastro sem categoria selecionada
When clicar em "Adicionar custo"
Then nada é gravado
And um snackbar amarelo informa "Selecione uma categoria."

### Cenário 3 - Filtro por categoria

Given lançamentos de Moradia e Lazer no mês
When filtrar por "Lazer"
Then apenas os lançamentos de Lazer são listados

### Cenário 4 - Navegação de competência

Given a tela Custos na competência 11/2026
When clicar em "Mês anterior"
Then a URL passa a `?mes=2026-10`
And os lançamentos e totais de 10/2026 são exibidos
And o cadastro rápido sugere uma data dentro de 10/2026

### Cenário 5 - Consolidado por categoria

Given lançamentos de Moradia (R$ 2.000) e Alimentação (R$ 500) no mês
When abrir a tela Início
Then "Moradia" aparece primeiro com R$ 2.000,00 e 80% do total
And "Alimentação" aparece com R$ 500,00 e 20% do total

### Cenário 6 - Lançamento legado

Given um lançamento salvo antes desta feature, sem categoria
When ele é exibido em qualquer tela
Then aparece como "Outros"

### Cenário 7 - Falha de persistência

Given uma falha de rede ou permissão ao salvar
When o usuário cadastrar ou editar um custo
Then um snackbar vermelho informa a falha e o formulário mantém os dados

## Fora de escopo

- Categorias personalizadas pelo usuário.
- Descrição livre do lançamento.
