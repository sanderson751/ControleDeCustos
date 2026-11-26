# Requirements - Orçamento mensal por categoria e alertas

## Contexto

Como usuário, quero definir quanto posso gastar por categoria em cada mês e ser alertado
quando me aproximo (80%) ou ultrapasso (100%) esse limite, para ter previsibilidade de caixa
(steering de produto: "Definição de orçamento mensal por categoria" e "Alertas quando o gasto
ultrapassar 80% e 100% do orçamento").

## Requisitos funcionais

- RF-01: nova tela **Orçamentos** (`/budgets`) para definir o limite mensal de cada categoria na competência selecionada.
- RF-02: a tela exibe, por categoria: gasto do mês, limite, percentual consumido, valor restante e status.
- RF-03: deixar o limite em branco remove o orçamento daquela categoria no mês.
- RF-04: ação "Copiar do mês anterior" preenche o formulário com os limites da competência anterior (gravação somente ao salvar).
- RF-05: status por categoria: **sem orçamento**, **dentro do orçamento** (< 80%), **atenção** (>= 80% e < 100%) e **estourado** (>= 100%).
- RF-06: a tela Início exibe alertas para categorias em atenção ou estouradas na competência visualizada.
- RF-07: ao cadastrar um custo que faça uma categoria passar para atenção ou estouro, exibir snackbar amarelo de alerta.
- RF-08: o consolidado por categoria do Início mostra o percentual do orçamento quando houver limite.
- RF-09: `guest` visualiza orçamentos e alertas, mas não edita.

## Requisitos não funcionais

- RNF-01: cálculo de status e alertas em funções puras testadas (`budgetRules.ts`).
- RNF-02: orçamentos persistidos em `users/{uid}/budgetLimits/{AAAA-MM-categoria}` com validação nas regras do Firestore.
- RNF-03: compatibilidade `light`/`dark` com contraste AA; status usa tokens `--success`, `--warning`, `--danger` sempre acompanhados de texto (não depender só de cor).
- RNF-04: proibido usar cor fixa para texto crítico quando o fundo variar por tema.
- RNF-05: snackbar padrão (top-right, 3s, `X`, vermelho/verde/amarelo).
- RNF-06: cada escrita tem critério de sucesso e falha de persistência.
- RNF-07: `npm run verify` sem erros e `npm run test:rules` verde.

## Regras de negócio

- RB-01: o orçamento é definido por mês e categoria (único por par competência + categoria).
- RB-02: o limite é um valor maior que zero (máximo R$ 1.000.000.000,00).
- RB-03: o gasto considerado é a soma dos lançamentos da competência na categoria.
- RB-04: limiares: atenção a partir de 80% do limite; estouro a partir de 100%.

## Critérios de aceite (Gherkin)

### Cenário 1 - Definir orçamento

Given um usuário standard na tela Orçamentos em 03/2026
When informar R$ 1.200,00 para Alimentação e clicar em "Salvar orçamentos"
Then o documento `users/{uid}/budgetLimits/2026-03-alimentacao` é gravado com `limit = 1200`
And um snackbar verde confirma a gravação

### Cenário 2 - Alerta de 80% (exemplo do steering)

Given orçamento de R$ 1.200,00 para Alimentação em 03/2026
And lançamentos de Alimentação somando R$ 980,00
When abrir a tela Início em 03/2026
Then é exibido alerta de atenção para Alimentação com 81% consumido (percentual arredondado para baixo)

### Cenário 3 - Alerta de estouro

Given o cenário anterior
When cadastrar um custo de Alimentação de R$ 240,00 (total R$ 1.220,00)
Then um snackbar amarelo informa que Alimentação estourou o orçamento
And a tela Início passa a exibir o alerta de estouro

### Cenário 4 - Remover orçamento

Given orçamento definido para Lazer
When apagar o valor e salvar
Then o documento do orçamento de Lazer é removido
And Lazer passa a "sem orçamento"

### Cenário 5 - Copiar do mês anterior

Given orçamentos definidos em 02/2026
When abrir 03/2026 e clicar em "Copiar do mês anterior"
Then o formulário é preenchido com os limites de 02/2026 sem gravar até "Salvar orçamentos"

### Cenário 6 - Valor inválido

Given um limite igual a zero
When salvar
Then nada é gravado e um snackbar amarelo informa o erro de validação

### Cenário 7 - Guest

Given um usuário guest
When abrir Orçamentos
Then vê limites e status, sem campos editáveis nem botões de gravação
And as regras do Firestore negam qualquer escrita em `budgetLimits`

### Cenário 8 - Falha de persistência

Given uma falha de rede ou permissão
When salvar orçamentos
Then um snackbar vermelho informa a falha e os valores digitados são mantidos

## Fora de escopo

- Orçamento recorrente automático (sem cópia manual).
- Notificações fora do app (email/push).
