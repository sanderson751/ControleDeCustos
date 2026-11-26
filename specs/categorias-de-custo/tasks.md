# Tasks - Categorias de custo e visão mensal por categoria

> Referência obrigatória: usar e manter alinhado com `specs/_template/dod-checklist.md`.

## Fase 1 - Domínio

- [x] `COST_CATEGORIES`, `CostCategory`, `COST_CATEGORY_LABELS`, `Competence` em `src/domain/entities/cost.ts`.
- [x] Regras puras: `isCostCategory`, `normalizeCategory`, `filterCosts`, `sumByCategory`, `spentByCategory`; `validateCostForm` exige categoria.
- [x] `src/domain/rules/competence.ts` (parse/format, navegação entre meses, data sugerida).
- [x] Testes unitários das regras.
- [x] `firestore-structure.md` da feature.

## Fase 2 - Aplicação

- [x] `toCostEntry` normaliza categoria legada para `outros`; create/update gravam `category`.
- [x] `useCompetenceParam` (`?mes=AAAA-MM`) e `CompetencePicker`.
- [x] Campo Categoria no cadastro e na edição (`NativeSelect` do shadcn/ui).
- [x] `CostQuickAddForm` extraído; data manual sugerida fora do mês atual.
- [x] Listagem com coluna e filtro de categoria; navegação de competência em Custos e Início.
- [x] Consolidado por categoria no Início (`CategoryBreakdown`).
- [x] Relatórios: filtro e coluna de categoria; CSV/PDF com categoria.
- [x] Links do menu preservam a competência.
- [x] Snackbar padrão para sucesso/erro/warning.

## Fase 3 - Qualidade

- [x] `npm run lint:fix` e `npm run lint` sem erros.
- [x] Hooks conformes a `react-hooks/exhaustive-deps`.
- [x] Testes de componente/página (Custos, Edição, Início, Relatórios, Shell).
- [x] Regras do Firestore: categoria obrigatória testada no emulador.
- [x] Validação visual em `light` e `dark`.

## Definição de pronto

- [x] Checklist DoD transversal aplicado conforme `specs/_template/dod-checklist.md`.
