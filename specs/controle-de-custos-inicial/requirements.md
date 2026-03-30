# Requirements - Controle de Custos Inicial

## Contexto

Como usuario, quero registrar e acompanhar custos por categoria para controlar meu orçamento mensal.

## Requisitos funcionais

- RF-01: cadastrar lancamento de custo com valor, data, categoria e descricao opcional.
- RF-02: listar lancamentos do mes selecionado com total acumulado.
- RF-03: editar e excluir lancamento existente.
- RF-04: definir limite de orçamento por categoria para um mes.
- RF-05: exibir alertas de 80% e 100% do limite por categoria.

## Requisitos nao funcionais

- RNF-01: layout responsivo para mobile, tablet e desktop.
- RNF-02: operacao principal de cadastro em ate 2 segundos em rede normal.
- RNF-03: cobertura minima de testes para fluxos criticos de cadastro e alertas.

## Criterios de aceite (Gherkin)

### Cenario 1 - Cadastro valido
Given que o usuario esta na tela de novo lancamento
When ele informa valor 150,00, categoria Alimentacao e data valida
Then o sistema salva o lancamento e atualiza o total do mes

### Cenario 2 - Validacao de valor
Given que o usuario preenche valor 0
When tenta salvar o lancamento
Then o sistema bloqueia o envio e mostra mensagem de erro

### Cenario 3 - Alerta de limite
Given que a categoria Transporte tem limite mensal de 500,00
And os lancamentos somam 520,00 no mes
When a tela de resumo e exibida
Then o sistema mostra alerta de estouro para Transporte
