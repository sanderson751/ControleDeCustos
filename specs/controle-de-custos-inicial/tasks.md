# Tasks - Controle de Custos Inicial

## Fase 1 - Dominio e contratos

- [ ] Criar tipos `CostEntry` e `CostType` em `src/domain/entities`.
- [ ] Definir validadores de negocio para `installmentsTotal >= 1` e `costType` obrigatorio.
- [ ] Escrever testes unitarios para regras de cadastro rapido e filtros por tipo.

## Fase 2 - Persistencia e hooks

- [x] Criar servico server-side de custos para CRUD no Firestore.
- [x] Expor API Next (`/api/costs` e `/api/costs/[costId]`) mantendo a estrutura `services` no client.
- [x] Expor API Next para relatorios (`/api/reports/costs`) com filtros por periodo e frente.
- [x] Implementar serializacao e mapeamento entre API e entidades de dominio.
- [x] Implementar criacao de lancamentos mensais subsequentes para custos `fixo` parcelados.
- [ ] Criar colecoes e indices conforme `firestore-structure.md` no projeto Firebase.
- [ ] Criar hook `useCostEntries(month, year, typeFilter)` com operacoes de listar/adicionar/editar/remover.
- [ ] Criar hook `useCurrentMonthCostReport` para atualizacao em tempo real dos relatorios do mes corrente.

## Fase 3 - Interface

- [ ] Adicionar item de menu `Custos` no menu principal respeitando permissoes por role.
- [x] Habilitar item de menu `Relatorios` no menu lateral.
- [ ] Implementar `CostQuickCreateForm` com apenas campos obrigatorios e fluxo fluente.
- [x] Aplicar mascara monetaria BRL no campo de valor (cadastro rapido e edicao).
- [x] Definir frente padrao como `variavel` no cadastro rapido.
- [x] Exibir campo de parcelas somente quando frente = `fixo`.
- [ ] Implementar `CostListTable` com colunas: conta, valor, data de criacao e total de parcelas.
- [ ] Implementar filtros na listagem por `fixo`, `variavel` e `todos`.
- [x] Implementar `CostEditFormPage` em rota/tela separada da listagem (`/costs/[costId]/edit`).
- [x] Implementar `MonthlyCostReportCard` com refresh apos create/update/delete usando a API protegida.
- [x] Implementar tela `ReportsPage` com filtros por data inicial/final e frente de custo.
- [x] Implementar visualizacao dos resultados de relatorios em grid responsiva.
- [x] Implementar botao de overflow `Exportar` com opcoes CSV e PDF.
- [ ] Integrar snackbar para feedback de erro/sucesso/warning (top-right, 3s, fechar com `X`).

## Fase 4 - Qualidade

- [x] Criar testes de interface para cadastro rapido valido e validacao de campos obrigatorios.
- [ ] Criar testes de interface para filtro de custos fixos e variaveis.
- [ ] Criar testes de interface para filtros e exportacao da tela de relatorios.
- [x] Criar teste de regressao para edicao em formulario separado.
- [x] Criar testes para visibilidade condicional do campo de parcelas por frente de custo.
- [ ] Criar teste de permissao para esconder acoes de CRUD para role `Guest`.
- [ ] Validar acessibilidade basica (labels, foco, contraste).
- [ ] Validar legibilidade em tema `light` e `dark` para formulario rapido, tabela e formulario de edicao.
- [ ] Validar que filtros e estados de botoes mantem contraste AA nos dois temas.
- [ ] Validar comportamento do snackbar (tempo de 3s, fechamento por `X`, cor por status).

## Definicao de pronto

- Todos os criterios de aceite dos requisitos atendidos.
- Testes passando no pipeline local.
- Sem erros TypeScript.
- Layout responsivo validado em mobile e desktop.
- Persistencia create/update/delete validada no Firestore para custos.
- Falhas de persistencia validadas com feedback ao usuario.
