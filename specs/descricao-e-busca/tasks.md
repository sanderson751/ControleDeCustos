# Tasks - Descrição do lançamento e busca

> Referência obrigatória: usar e manter alinhado com `specs/_template/dod-checklist.md`.

## Fase 1 - Domínio

- [x] `description` em `CostEntry`/inputs e `MAX_DESCRIPTION_LENGTH`.
- [x] `normalizeSearchText`, `matchesSearch` (conta OU descrição, campos separados) e `filterCosts` com busca.
- [x] `validateCostForm` limita a descrição (texto aparado).
- [x] Testes unitários.

## Fase 2 - Aplicação

- [x] Conversor (legado → `""`), create (todas as parcelas) e update com descrição aparada.
- [x] Campo "Descrição (opcional)" com contador do texto aparado, `aria-describedby` e `aria-invalid` acima do limite.
- [x] Busca na listagem de Custos combinada com filtros (volta à página 1).
- [x] Descrição abaixo da conta na listagem; coluna em Relatórios, CSV e PDF.
- [x] CSV neutraliza fórmulas (`=`, `+`, `-`, `@`, tab, CR).

## Fase 3 - Qualidade

- [x] Regras do Firestore: descrição opcional, texto, até 500 (testes no emulador, inclusive edição de legado).
- [x] Revisão de QA: aprovada; itens menores corrigidos (contador, acessibilidade, semântica da busca, fórmulas no CSV, lacunas de teste).
- [x] `npm run verify` e `npm run test:rules` sem erros.
- [x] Validação visual da tela de Custos.

## Definição de pronto

- [x] Checklist DoD transversal aplicado conforme `specs/_template/dod-checklist.md`.
