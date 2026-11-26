# Tasks - Categorias personalizadas

> Referência obrigatória: usar e manter alinhado com `specs/_template/dod-checklist.md`.

## Fase 1 - Domínio

- [x] `CostCategory` passa a ser `string` (id padrão ou id do documento); `DEFAULT_CATEGORIES`/`DEFAULT_CATEGORY_LABELS`.
- [x] Entidade `CustomCategory`/`CategoryCatalog` e limites (20 categorias, nome até 40).
- [x] `categoryRules`: catálogo (padrão na ordem fixa + personalizadas em ordem alfabética), opções do formulário (ativas + atual arquivada), validação de nome único sem acento/caixa e limite.
- [x] `compareCategoryOrder` e regras de orçamento/consolidado/recorrência aceitando categorias além das padrão.
- [x] Testes unitários.

## Fase 2 - Aplicação

- [x] `categoryService` (assinatura em tempo real, criar, renomear, arquivar/reativar) e caminhos `users/{uid}/categories`.
- [x] `CategoriesProvider` no `AppShell` (fallback: catálogo padrão + aviso em falha).
- [x] Tela **Categorias** (`/categories`) com criação, renomeação em diálogo, arquivar/reativar; `guest` somente leitura; item no menu.
- [x] Formulário de custo, filtros (Custos, Relatórios, Evolução), Orçamentos (arquivadas só quando em uso), Início, alertas, CSV e PDF usando o catálogo.

## Fase 3 - Qualidade

- [x] Regras do Firestore: coleção `categories` (sem exclusão) e `isValidCategory(userId, id)` com `exists()` em custos, orçamentos e recorrências (testes no emulador).
- [x] `npm run verify` e `npm run test:rules` sem erros.
- [x] Revisão de QA.

## Definição de pronto

- [x] Checklist DoD transversal aplicado conforme `specs/_template/dod-checklist.md`.
- [ ] Publicar as regras (`npm run firestore:deploy`) antes do deploy do Hosting.
