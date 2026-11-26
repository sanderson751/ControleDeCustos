# Structure Steering

## Estrutura oficial

```
src/
  main.tsx, App.tsx          # bootstrap e providers globais
  index.css                  # tokens de tema (Tailwind v4 + shadcn)
  domain/
    entities/                # tipos e contratos de domínio (CostEntry, UserProfile, UserRole)
    rules/                   # regras puras de negócio (totais, parcelas, validação, permissões)
  services/                  # integração com Firebase Auth/Firestore e conversores
  providers/                 # contextos globais (AuthProvider, ThemeProvider)
  hooks/                     # hooks de dados e estado
  routes/                    # router, guards e navegação
  pages/                     # uma tela por rota (lazy-loaded)
  components/
    ui/                      # shadcn/ui (gerado pela CLI)
    layout/                  # shell autenticado (sidebar, app bar)
    shared/                  # componentes reutilizáveis de composição
    costs/                   # componentes específicos de custos
    users/                   # componentes específicos de usuários
  lib/                       # utilitários (firebase, moeda, datas, erros, notify, exportação)
  test/                      # setup, factories, mocks e helpers de teste
tests/rules/                 # testes de firestore.rules no emulador
scripts/                     # scripts operacionais (migrações)
```

## Convenções de nomes

- Componentes e páginas: `PascalCase.tsx`
- Hooks: `useNomeDoHook.ts`
- Utilitários e serviços: `camelCase.ts`
- Testes: ao lado do arquivo testado, `NomeDoArquivo.test.ts(x)`
- Imports absolutos com `@/` (alias de `src/`)

## Responsabilidade por pasta

- `domain/entities`: tipos e contratos de domínio (CostEntry, Budget, UserProfile).
- `domain/rules`: regras puras de negócio (cálculos, validações, matriz de permissões).
- `services`: único ponto de acesso ao Firebase; mapeia documentos para entidades.
- `pages`: orquestram hooks/serviços e compõem componentes; sem acesso direto ao Firebase.
- `components/ui`: primitives do shadcn/ui; evitar edição manual (exceto ajustes de tokens).

## Exemplo de feature

Feature "Orçamento por categoria":

- `domain/entities/budget.ts`
- `domain/rules/budgetRules.ts` + `budgetRules.test.ts`
- `services/budgetService.ts` + `budgetService.test.ts`
- `hooks/useMonthBudgets.ts`
- `components/costs/BudgetProgressCard.tsx`
- `pages/BudgetsPage.tsx` + `BudgetsPage.test.tsx`
- `firestore.rules` + `tests/rules/firestore.rules.test.ts`
