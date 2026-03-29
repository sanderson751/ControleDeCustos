# Requirements - Controle de Custos Inicial

## Contexto

Como usuario, quero acessar um menu de custos para registrar e acompanhar gastos de forma simples, com detalhamento da conta e relatorios em tempo real do mes corrente.

## Requisitos funcionais

- RF-01: o sistema deve exibir no menu principal um item de acesso a tela de custos.
- RF-02: a tela de custos deve listar os lancamentos com os campos: conta, valor, data de criacao e total de parcelas.
- RF-03: cada lancamento deve pertencer obrigatoriamente a uma frente de custo: `fixo` ou `variavel`.
- RF-04: a listagem deve permitir filtro por frente de custo (`fixo`, `variavel`, `todos`).
- RF-05: o sistema deve permitir adicionar novo custo de forma rapida, com apenas os campos obrigatorios:
  - conta
  - valor
  - frente de custo (`fixo` ou `variavel`)
  - total de parcelas (padrao 1)
- RF-06: a data de criacao deve ser preenchida automaticamente pelo sistema no cadastro rapido, com opcao de ajuste manual.
- RF-07: deve ser possivel editar um custo existente em um formulario separado da tela de listagem, acessado pela rota `/costs/[costId]/edit`.
- RF-08: o formulario de edicao deve carregar os dados atuais e permitir salvar ou cancelar sem alterar o registro.
- RF-09: o sistema deve atualizar os relatorios de gastos do mes corrente apos criar, editar ou remover um custo, usando a fonte de dados protegida por sessao.
- RF-10: o controle de acesso deve seguir as diretrizes de perfis ja definidas em controle-de-acesso:
  - Admin: pode visualizar, adicionar, editar e remover custos
  - Standard: pode visualizar, adicionar, editar e remover custos
  - Guest: pode apenas visualizar custos
- RF-11: para usuario `Guest`, botoes de adicionar, editar e remover devem ser ocultos na interface.

## Requisitos nao funcionais

- RNF-01: layout responsivo para mobile, tablet e desktop.
- RNF-02: fluxo de cadastro rapido deve concluir em ate 2 segundos em rede normal.
- RNF-03: verificacao de permissao na interface deve ocorrer em <= 100ms.
- RNF-04: listagem e formularios devem manter legibilidade em temas `light` e `dark`.
- RNF-05: contraste minimo AA para textos de tabela, filtros e formularios.
- RNF-06: operacoes de cadastro/edicao/exclusao devem exibir snackbar no topo direito para erro, sucesso e warning.
- RNF-07: snackbar com auto-dismiss de 3 segundos e opcao de fechar com icone `X`.
- RNF-08: cores por status: erro (vermelho), sucesso (verde), warning (amarelo).
- RNF-09: Firestore deve ser a fonte final da verdade para dados de custos e relatorios.
- RNF-10: operacoes de escrita (create/update/delete) devem definir tratamento de sucesso e falha de persistencia.

## Regras de negocio

- RB-01: todo custo cadastrado deve conter total de parcelas >= 1.
- RB-02: quando nao informado pelo usuario, total de parcelas deve assumir valor `1`.
- RB-03: custo `fixo` representa recorrencia previsivel; custo `variavel` representa recorrencia nao previsivel.
- RB-04: relatorio do mes corrente deve considerar apenas custos com competencia no mes/ano atual.
- RB-05: itens de acao para usuarios sem permissao devem ser ocultos (nao apenas desabilitados).

## Criterios de aceite (Gherkin)

### Cenario 1 - Acesso ao menu de custos

Given que o usuario autenticado esta na aplicacao
When o menu principal for renderizado
Then o item de menu "Custos" deve estar visivel conforme suas permissoes

### Cenario 2 - Cadastro rapido valido

Given que o usuario esta na tela de custos
When informa conta "Energia", valor 220,00, frente "fixo" e salva
Then o sistema deve criar o custo com total de parcelas igual a 1 por padrao
And o relatorio do mes corrente deve ser atualizado em tempo real

### Cenario 3 - Listagem detalhada

Given que existem custos cadastrados no mes
When o usuario visualiza a listagem de custos
Then cada item deve exibir conta, valor, data de criacao e total de parcelas
And deve ser possivel filtrar por custos fixos, variaveis ou todos

### Cenario 4 - Edicao em formulario separado

Given que o usuario tem permissao de edicao
When clica em editar um custo da listagem
Then o sistema deve abrir um formulario separado da tela de listagem
And ao salvar, a listagem e o relatorio do mes corrente devem ser atualizados

### Cenario 5 - Controle de acesso para convidado

Given que um usuario com role Guest acessa a tela de custos
When a interface for exibida
Then todos os botoes de adicionar, editar e remover devem estar ocultos
And apenas a visualizacao da listagem e dos relatorios deve ser permitida
