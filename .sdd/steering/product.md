# Product Steering

## Objetivo do produto

Construir um sistema web de controle de custos para pessoas e pequenos times registrarem, categorizarem e analisarem despesas, com foco em previsibilidade de caixa.

## Problemas que resolvemos

- Falta de visibilidade sobre para onde o dinheiro está indo.
- Dificuldade de comparar gasto real versus orçamento planejado.
- Ausência de alertas para estouro de limite por categoria.

## Escopo de negócio inicial

- Cadastro de lançamentos de custo (valor, data, categoria, descrição).
- Edição e exclusão de lançamentos.
- Visão mensal consolidada por categoria.
- Definição de orçamento mensal por categoria.
- Alertas quando o gasto ultrapassar 80% e 100% do orçamento.

## Regras de negócio principais

- Todo lançamento deve possuir categoria e valor maior que zero.
- Categorias padrão: Moradia, Alimentação, Transporte, Saúde, Educação, Lazer, Outros.
- O orçamento é definido por mês e categoria.
- O consolidado mensal considera data de competência do lançamento.

## Exemplo de cenário

Para março de 2026, o usuário define R$ 1.200,00 para Alimentação. Ao registrar custos que somem R$ 980,00, o sistema exibe alerta de 80%. Ao atingir R$ 1.220,00, exibe alerta de estouro.

## Métricas de sucesso

- 90% dos usuários conseguem registrar um custo em menos de 20 segundos.
- Redução de pelo menos 15% em gastos excedentes após 3 meses de uso.
