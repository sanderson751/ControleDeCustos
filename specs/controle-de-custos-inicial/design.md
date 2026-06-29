# Design - Controle de Custos Inicial

## Visao de solucao

A feature sera implementada no frontend React com separacao entre:

- componentes de interface;
- hooks de orquestracao;
- regras de negocio puras;
- servico de persistencia no Firestore.

Foco funcional da solucao:

- incluir item de menu para acesso rapido ao modulo de custos;
- exibir listagem detalhada por conta;
- separar custos em duas frentes: `fixo` e `variavel`;
- manter cadastro rapido e fluente com campos minimos;
- aplicar mascara monetaria BRL no campo de valor (entrada e edicao);
- definir frente padrao como `variavel`;
- exibir campo de parcelas somente quando frente = `fixo`;
- realizar edicao em formulario separado da listagem;
- atualizar relatorios em tempo real do mes corrente;
- disponibilizar menu de `Relatorios` com filtros por periodo e frente;
- exibir resultados em grid e suportar exportacao CSV/PDF via botao de overflow.

Padrao visual transversal:

- usar Material Design Icons Community (`@mdi/react` + `@mdi/js`) para acoes e navegacao.
- aplicar controle de acesso por role: Admin e Standard com CRUD completo, Guest apenas visualizacao.
- usar tokens semanticos de tema para textos, fundos, bordas, botoes, badges e alertas.
- evitar cores hardcoded para texto critico em componentes com suporte a `light`/`dark`.

## Modelo de dominio

- CostType
  - `fixo`
  - `variavel`
- CostEntry
  - id: string
  - accountName: string
  - amount: number
  - costType: CostType
  - installmentsTotal: number
  - notes?: string
  - competenceMonth: number
  - competenceYear: number
  - createdAt: Timestamp
  - updatedAt: Timestamp

## Regras de negocio

- cadastro rapido exige: `accountName`, `amount`, `costType`.
- `amount` deve ser informado por campo mascarado em BRL e convertido para `number` antes da persistencia.
- `installmentsTotal` assume `1` quando nao informado.
- `installmentsTotal` deve ser inteiro >= 1.
- para `costType = variavel`, `installmentsTotal` e forcado para `1`.
- para `costType = fixo` e `installmentsTotal = N`, a persistencia cria N lancamentos em competencias mensais sequenciais.
- relatorio em tempo real do mes corrente usa filtro por `competenceMonth` e `competenceYear`.
- filtros de listagem devem permitir visualizar: `todos`, `fixo`, `variavel`.
- tela de relatorios usa filtros por `createdAt` (intervalo inclusivo de datas) e `costType` opcional.
- exportacoes (CSV/PDF) devem refletir exatamente o resultado filtrado exibido no grid.
- permissoes seguem controle-de-acesso:
  - Admin: canAdd, canEdit, canDelete, canView
  - Standard: canAdd, canEdit, canDelete, canView
  - Guest: canView apenas
  - Elementos UI de acao devem ser ocultos para usuarios Guest

## Componentes propostos

- CostsMenuEntry (item de menu para modulo de custos)
- CostListPage
- CostListTable
- CostQuickCreateForm
- CostEditFormPage (formulario separado)
- MonthlyCostReportCard
- ReportsPage
- ReportsFilterForm
- ReportsGrid
- ReportsExportOverflow
- GlobalSnackbar

## Hooks propostos

- useCostEntries(month, year, typeFilter)
- useCostQuickCreate()
- useCostEdit(costId)
- useCurrentMonthCostReport(month, year)
- useCanAccess(resource='costs', action='view|add|edit|delete')

## Estrategia de persistencia

- Persistencia principal: Firebase Firestore com subcolecao por usuario.
- Escritas com `serverTimestamp()` para `createdAt` e `updatedAt` quando a data manual nao for informada.
- Em cadastro de custo fixo parcelado, criar um documento por parcela em meses subsequentes (incremento mensal da competencia).
- Leitura por consultas indexadas por `userId`, `competenceYear`, `competenceMonth` e `costType`.
- Leitura para relatorios usando endpoint dedicado (`/api/reports/costs`) com filtro por `createdAt` (inicio/fim) e `costType` opcional.
- Estrutura detalhada em `specs/controle-de-custos-inicial/firestore-structure.md`.
- Controle de acesso aplicado no frontend com ocultacao de acoes sem permissao.

## Compatibilidade de tema e contraste

- Componentes da feature devem respeitar tokens globais de tema (`light`/`dark`).
- Variaveis Bootstrap utilizadas pela feature devem derivar dos tokens do tema ativo.
- Garantir contraste minimo AA em tabelas, formularios e cards de relatorio.
- Snackbar de erro/sucesso/warning deve ser exibido no topo direito, por 3s, com opcao de fechar via `X`.
- Tokens de cor para snackbar devem respeitar status: vermelho, verde e amarelo.

## Exemplo de fluxo

1. Usuario acessa o item de menu `Custos`.
2. Tela de listagem carrega custos do mes corrente com filtro inicial `todos`.
3. Usuario cria custo via formulario rapido com dados minimos.
4. `useCostEntries` persiste no Firestore e sincroniza a listagem.
5. `useCurrentMonthCostReport` recalcula os indicadores em tempo real.
6. Usuario clica em editar e navega para formulario separado (`CostEditFormPage`).
