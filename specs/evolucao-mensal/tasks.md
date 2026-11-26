# Tasks - Evolução mensal

> Referência obrigatória: usar e manter alinhado com `specs/_template/dod-checklist.md`.

## Fase 1 - Domínio

- [x] `evolutionRules.ts`: competências do período, gasto e orçamento efetivo por mês, indicadores e escala do eixo.
- [x] Testes unitários (cenários 1, 2, 3 e 5; virada de ano; eixo com valores redondos).
- [x] `firestore-structure.md` (somente leitura; sem regras ou índices novos).

## Fase 2 - Aplicação

- [x] `listCostsByCompetenceRange` (`in` por ano) e `listBudgetLimitsByYears`; `loadEvolutionData`.
- [x] `useEvolutionData` sobre `useCompetenceResource` (proteção contra corridas).
- [x] Paleta validada (light `#6c63f2`/`#0a92b8`, dark `#847dff`/`#0aa6cf`) como tokens `--chart-spent`/`--chart-budget`.
- [x] `MonthlyEvolutionChart` (SVG): colunas ≤ 24px, linha 2px, marcadores com anel, grade sólida, rótulo só no último mês, tooltip por mouse/teclado.
- [x] `EvolutionTable` (visão em tabela).
- [x] `EvolutionPage` com filtros em uma linha e indicadores; item "Evolução" no menu (preserva `?mes=`).

## Fase 3 - Qualidade

- [x] Testes de serviço, gráfico, tabela e página.
- [x] `npm run verify` sem erros.
- [x] Validação visual em `light` e `dark`.

## Definição de pronto

- [x] Checklist DoD transversal aplicado conforme `specs/_template/dod-checklist.md`.
