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

## Entrega B — foto da comanda

```
Foto ─► receiptReader (lib): canvas (escala, cinza, contraste) ─► BarcodeDetector (QR NFC-e, se houver)
                             ─► Tesseract.js (import dinâmico; /ocr: worker, core LSTM, por best_int)
     ─► receiptParser (puro): itens, total, data, loja, chave ─► receiptReview (puro): decisões
     ─► CompleteListDialog: preenche campos + ReceiptReview ─► buildCompletion (receipt) ─► lote único
```

- `src/lib/receiptReader.ts`: `readReceipt(file, { onProgress, signal, timeoutMs })` → texto, confiança,
  chave do QR. Decodifica a foto já reduzida (`createImageBitmap` com `resizeWidth`), mostra o
  progresso também na carga do OCR, pode ser cancelada e desiste após 2 min; o worker é sempre encerrado.
- `src/domain/rules/receiptParser.ts`: `parseReceiptText` — itens nos padrões de cupom NFC-e e
  CF-e SAT (com ou sem "X", preço com 3 casas, tributo entre parênteses, `=`/`*`, código de
  tributação, linha quebrada), desconto do item e item cancelado; correção de O/l/S/B em números e
  "RS"/"R5" no lugar de R$; total por prioridade (a pagar > total − desconto > total > valor pago sem
  troco); data de emissão; loja; CNPJ; chave de acesso com DV conferido.
  `matchReceiptLine`: apelido > semelhança (nota alta só quando todas as palavras do catálogo
  aparecem e a primeira bate). `receiptKeyOf`: chave da NFC-e ou `h-<CNPJ|loja>-<dia>-<centavos>`
  (sem data não há chave).
- `src/domain/rules/receiptReview.ts`: associação **global** por nota (lista e catálogo), linhas
  repetidas juntas, preço por item da lista (unidade diferente — kg na comanda, un na lista — divide
  pela quantidade da lista) e `ReceiptCompletion`. O apelido só é aprendido com nota ≥ 0,9 ou
  escolha do usuário; sugestões incertas aparecem marcadas na revisão.
- Diálogo: a leitura guarda os valores de antes e o que preencheu; descartar ou trocar o destino de
  uma linha só desfaz campos que o usuário não editou. A chave é recalculada na conclusão com os
  valores finais e a duplicidade, conferida de novo.
- `buildCompletion` gera `newProducts` (ligados aos itens da compra por `newProductLinks`), apelidos e
  limita a compra a 150 itens; `completeList` cria tudo no mesmo lote com o registro
  `groceryReceiptKeys/{chave}`, que garante a unicidade nas regras.
- Arquivos do OCR copiados de `node_modules` para `public/ocr/<versão>/` por `npm run ocr:assets`
  (pré-`dev`/`build`/`test:e2e`; fora do git). Servidos pelo próprio Hosting com cache de 1 ano
  (a versão no caminho, `__OCR_VERSION__` no `vite.config.ts`, troca quando os pacotes mudam).
  O rewrite da SPA não cobre `/ocr/*` (regex no `firebase.json`): arquivo ausente responde 404 em vez
  do `index.html` com cache longo. Os dados do idioma ficam no IndexedDB por versão (`cachePath`).
- Sem data lida na comanda (e sem o usuário alterar a data), não há chave: a data padrão (hoje) não
  identifica a compra. Com a duplicidade marcada, corrigir loja/data/total gera outra chave e libera.

## Entrega C — inteligência

- `src/domain/rules/groceryInsights.ts` (puro, testado): `priceTrend`/`formatTrend`,
  `marketInflation` (cesta de 1 unidade por produto recomprado no mês — o volume de itens caros não
  esconde a variação dos baratos), `restockSuggestions` (≥ 2 compras, intervalo médio conhecido,
  dias desde a última ≥ 0,8 × média) e `shopProgress` (previsto do carrinho em centavos).
- Componentes: `PriceTrendBadge` (tokens `danger`/`success` com texto e ícone), `PriceHistorySection`
  (em `/grocery`), `RestockCard` (na lista aberta).
- `GroceryShopPage` (`/grocery/:listId/shop`): reaproveita `useGroceryData`, `useOptimisticListItems`
  (marcação otimista e sequencial) e `CompleteListDialog`. Hooks `useWakeLock` (pede de novo ao voltar
  para a aba; negado/sem suporte só não mostra o aviso) e `useOnlineStatus`.
- Offline: `initializeFirestore` com `persistentLocalCache` + `persistentMultipleTabManager` em
  `src/lib/firebase.ts` (vale para o app inteiro: dados já vistos abrem sem sinal e gravações ficam na
  fila mesmo com a página fechada). `logout` chama `clearLocalCache` (`terminate` +
  `clearIndexedDbPersistence`) antes do `signOut`, para não deixar dados num aparelho compartilhado; o
  `AuthProvider` recarrega no login quando a sessão termina (nesta e nas outras abas, encerradas pela
  exclusão do cache). O registro de saída espera no máximo 3 s (sem sinal não confirma) e, com gravações
  pendentes (`waitForPendingWrites`), a saída pede confirmação.
- Sem sinal: a lista pré-carrega a tela do modo mercado; concluir não espera o commit (fica na fila e
  avisa); exportar relatório é bloqueado (a consulta viria incompleta do cache).
- Sem mudança no modelo de dados nem em `firestore.rules` (o histórico já tinha `previousUnitPrice`,
  `purchaseCount`, `avgIntervalDays` e `intervalCount`).

## Decisões

- Previsão calculada, nunca gravada: a próxima lista sempre reflete o último preço pago.
- Lista concluída somente leitura; reaproveitar = nova lista ("Usar novamente").
- Um custo único por compra em Alimentação (decisão do usuário); a compra guarda os itens para o histórico.
