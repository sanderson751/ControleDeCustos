# Structure Steering

## Estrutura recomendada

src/
  components/
    costs/
    shared/
  hooks/
  pages/
  services/
  domain/
    entities/
    rules/
  utils/
  tests/

## Convenções de nomes

- Componentes: PascalCase.tsx
- Hooks: useNomeDoHook.ts
- Utilitários: camelCase.ts
- Testes: NomeDoArquivo.test.tsx ou NomeDoArquivo.test.ts

## Responsabilidade por pasta

- `domain/entities`: tipos e contratos de domínio (CostEntry, Budget).
- `domain/rules`: regras puras de negócio (cálculo de orçamento, alertas).
- `components/costs`: componentes específicos de controle de custos.
- `services`: integração com Firebase Firestore e mapeadores de dados.

## Exemplo de feature

Feature "Lançamentos":
- `components/costs/CostEntryForm.tsx`
- `components/costs/CostEntryList.tsx`
- `domain/rules/costCalculations.ts`
- `hooks/useCostEntries.ts`
- `tests/costs/CostEntryForm.test.tsx`
