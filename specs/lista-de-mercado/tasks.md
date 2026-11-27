# Tasks - Lista de mercado

## Entrega A — lista, catálogo, previsão e conclusão

- [x] Entidades e `groceryRules` (validações, busca, previsão, lista x orçamento, conclusão, histórico do produto, quantidade pt-BR).
- [x] `groceryService` (assinaturas, produto/lista com id no cliente, itens, conclusão em lote único) e conversores.
- [x] `useGroceryData` e `useOptimisticListItems`.
- [x] Telas `/grocery` e `/grocery/:listId` (adicionar item, carrinho, quantidade, remover, total previsto, lista x orçamento, concluir, usar novamente); menu "Mercado".
- [x] Regras: três coleções, conclusão com compra nova da própria lista e lançamento no mesmo lote, lista concluída somente leitura, compra imutável.
- [x] Testes unitários, de regras e E2E (lista → conclusão → lançamento → previsão na próxima lista).
- [x] Revisão de QA (edições concorrentes, intervalo médio, teto de intervalo, quantidade pt-BR, integridade da conclusão, total pago, erros do orçamento) com regressões.

## Entrega B — foto da comanda (OCR)

- [ ] Tesseract.js sob demanda, pré-processamento, QR NFC-e, `receiptParser`, revisão e `receiptKey`.

## Entrega C — inteligência

- [ ] Variação de preços e "inflação do mercado", sugestão de reposição, modo mercado (Wake Lock e offline).
