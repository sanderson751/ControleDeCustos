# Tasks - Controle de Custos Inicial

## Fase 1 - Dominio e contratos

- [ ] Criar tipos `CostEntry`, `BudgetLimit`, `CostCategory` em `src/domain/entities`.
- [ ] Criar regras `calculateCategoryTotals` e `calculateBudgetStatus` em `src/domain/rules`.
- [ ] Escrever testes unitarios para regras de negocio.

## Fase 2 - Persistencia e hooks

- [ ] Criar servico `costFirestoreService` para CRUD no Firestore.
- [ ] Configurar cliente Firebase (`src/services/firebase/firebaseClient.ts`).
- [ ] Implementar mapeadores `fromFirestore` e `toFirestore` para entidades de dominio.
- [ ] Criar colecoes e indices conforme `firestore-structure.md` no projeto Firebase.
- [ ] Criar hook `useCostEntries` com operacoes de adicionar/editar/remover.
- [ ] Criar hook `useBudgetLimits` para limites por categoria.

## Fase 3 - Interface

- [ ] Implementar `CostEntryForm` com validacoes.
- [ ] Implementar `CostEntryTable` com acoes de editar/excluir.
- [ ] Implementar `MonthlySummary` e `CategoryBudgetCard` responsivos com Bootstrap 5.

## Fase 4 - Qualidade

- [ ] Criar testes de interface para cadastro valido e invalido.
- [ ] Criar teste de regressao para alerta de estouro de orcamento.
- [ ] Validar acessibilidade basica (labels, foco, contraste).

## Definicao de pronto

- Todos os criterios de aceite dos requisitos atendidos.
- Testes passando no pipeline local.
- Sem erros TypeScript.
- Layout responsivo validado em mobile e desktop.
