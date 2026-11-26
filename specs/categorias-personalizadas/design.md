# Design - Categorias personalizadas

## Visão de solução

O id de categoria passa a ser um texto (`CostCategory = string`). As 7 padrão mantêm seus ids
(`moradia`, `alimentacao`...); as personalizadas são documentos em `users/{uid}/categories`
com id gerado pelo Firestore. Um **catálogo** (padrão + personalizadas) é montado por função
pura e distribuído por `CategoriesProvider` (assinatura em tempo real no shell autenticado).
Sem provider, o contexto devolve o catálogo padrão — páginas e testes antigos seguem válidos.

## Modelo de domínio

- `DEFAULT_CATEGORIES` / `DEFAULT_CATEGORY_LABELS` (antigos `COST_CATEGORIES` / `COST_CATEGORY_LABELS`).
- `CustomCategory { id, name, archived }`.
- `CategoryOption { id, label, isDefault, archived }`.
- `CategoryCatalog { options, ids, activeIds, labelOf(id) }` — ordem: padrão (ordem fixa) e depois personalizadas por nome.

## Regras puras (`categoryRules.ts`)

- `buildCategoryCatalog(customs)` e `DEFAULT_CATALOG`.
- `validateCategoryName(name, catalog, { excludeId? })` → vazio, > 40 caracteres, duplicado (normalizado sem acento/caixa).
- `canCreateCategory(customs)` → limite de 20.
- `selectableCategories(catalog, currentId?)` → ativas + a atual (se arquivada) para o formulário.
- `labelOf` → rótulo; id desconhecido → "Categoria removida".

## Ajustes nas regras existentes

- `normalizeCategory`: qualquer texto não vazio é mantido; vazio/não-texto → `outros`.
- `validateCostForm`: categoria obrigatória (texto não vazio).
- Funções que percorriam as 7 categorias recebem a lista de ids:
  `spentByCategory(entries, ids)`, `summarizeBudgets(entries, limits, ids)`,
  `planBudgetChanges(current, desired)` e `planMonthBudgetChanges` iteram as chaves informadas;
  `resolveEffectiveBudgets` usa as categorias presentes nos dados (exceções + vigências).
- Apresentação recebe `labelOf` (`describeBudgetAlert`, exportações CSV/PDF).

## Componentes

- `CategoriesProvider` + `useCategories()` → `{ catalog, customs, isLoading, error }`.
- `CategoriesPage` (`/categories`): criação, renomeação (diálogo), arquivar/reativar; guest somente leitura.
- `CostFormFields`: opções de `selectableCategories` (arquivada atual marcada "(arquivada)").
- Filtros de Custos, Relatórios e Evolução: todas as categorias do catálogo.
- `BudgetsPage`: linhas = categorias ativas + arquivadas com gasto/orçamento no mês.

## Persistência

- `categoryService`: `subscribeToCategories`, `createCategory`, `renameCategory`, `setCategoryArchived`.
- Regras: ver `firestore-structure.md`.
