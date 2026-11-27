# Design - Lista de mercado (entrega A)

```
GroceryPage (/grocery) ──────────┐
GroceryListPage (/grocery/:id) ──┴─► useGroceryData(userId)
                                       ├─ subscribeToProducts   users/{uid}/groceryProducts
                                       └─ subscribeToLists      users/{uid}/groceryLists
                                       ▼
                         groceryRules (puro): previsão, validações, orçamento, conclusão
                                       ▼
                         groceryService.completeList → writeBatch (custo + compra + produtos + lista)
```

## Domínio

- `src/domain/entities/grocery.ts`: `GroceryProduct`, `GroceryList`, `GroceryListItem`,
  `GroceryPurchase`, unidades e limites.
- `src/domain/rules/groceryRules.ts`:
  - `validateProductName`, `validateListName`, `validateQuantity`;
  - `addItemToList` (soma quantidade se o produto já está na lista);
  - `forecastList(list, products)` → itens com preço/total previsto, total, sem histórico;
  - `listBudgetCheck(forecast, spent, limit)` → reaproveita `getBudgetStatus`/`getConsumedPercent`
    (`src/domain/rules/budgetRules.ts`);
  - `validateCompletion` e `buildCompletion(list, products, input, now)` → custo, compra e
    atualizações de produto (`applyPurchaseToProduct`: anterior ← último, último ← pago, contagem,
    intervalo médio incremental, loja);
  - `reuseList(list)` → itens desmarcados para uma lista nova.

## Serviço (`src/services/groceryService.ts`)

Assinaturas, `createProduct`, `createList`, `updateListItems`, `deleteList`, `completeList` (lote
único via `writeBatch`; ids de custo e compra gerados antes para referência cruzada).

## Estado da lista (`useOptimisticListItems`)

Cada edição parte da versão mais recente dos itens (ref), a tela atualiza na hora e o retorno do
servidor só volta a valer quando não há gravações pendentes. Evita que toques rápidos (blur + clique,
duplo toque, produto novo sendo criado) se anulem.

## UI

- `GroceryPage`: nova lista, listas abertas (itens, total previsto), concluídas (data, total pago,
  "Usar novamente", excluir).
- `GroceryListPage`: `AddItemForm` (busca no catálogo + produto novo com unidade), quantidade, tabela de itens
  (pegar, quantidade, preço previsto ou "sem histórico", total, remover), rodapé com total previsto,
  `ListBudgetCard` (Alimentação do mês via `useMonthBudgets` + `useMonthCosts`) e
  `CompleteListDialog`.
- Menu "Mercado" (`ShoppingCartIcon`). `guest` somente leitura.

## Decisões

- Previsão calculada, nunca gravada: a próxima lista sempre reflete o último preço pago.
- Lista concluída somente leitura; reaproveitar = nova lista ("Usar novamente").
- Um custo único por compra em Alimentação (decisão do usuário); a compra guarda os itens para o histórico.
