# Firestore - Lista de mercado

## `users/{uid}/groceryProducts/{autoId}` — catálogo pessoal

| Campo | Tipo | Regra |
| ----- | ---- | ----- |
| `userId` | string | dono |
| `name` | string | 1–80 |
| `normalizedName` | string | 1–80 (único no app) |
| `unit` | string | `un` \| `kg` \| `g` \| `l` \| `ml` \| `pct` |
| `lastUnitPrice` / `previousUnitPrice` | number \| null | > 0 e ≤ 1e9 |
| `lastPurchasedAt` | timestamp \| null | |
| `lastStore` | string | ≤ 60 |
| `purchaseCount` | int | ≥ 0 |
| `avgIntervalDays` | number \| null | 0–3650 (média de intervalos entre dias distintos) |
| `intervalCount` | int | ≥ 0 (intervalos que compõem a média; retroativas/mesmo dia não contam) |
| `aliases` | list<string> | ≤ 10 (nomes lidos na comanda — entrega B) |
| `createdAt` / `updatedAt` | timestamp | servidor |

## `users/{uid}/groceryLists/{autoId}`

| Campo | Tipo | Regra |
| ----- | ---- | ----- |
| `userId` | string | dono |
| `name` | string | 1–60 |
| `status` | string | `aberta` \| `concluida` |
| `items` | list<map> | ≤ 150 (`id`, `productId`, `name`, `quantity`, `checked`) |
| `purchaseId` | string \| null | compra gerada ao concluir (só em lista concluída) |
| `paidTotal` | number \| null | total pago (só em lista concluída) |
| `completedAt` | timestamp \| null | |
| `createdAt` / `updatedAt` | timestamp | servidor |

O valor previsto não é gravado: é calculado com o `lastUnitPrice` atual dos produtos.

## `users/{uid}/groceryPurchases/{autoId}` — compra registrada (imutável)

| Campo | Tipo | Regra |
| ----- | ---- | ----- |
| `userId` | string | dono |
| `listId` | string \| null | |
| `store` | string | 1–60 |
| `purchasedAt` | timestamp | |
| `total` | number | > 0 e ≤ 1e9 |
| `costEntryId` | string | lançamento criado |
| `items` | list<map> | ≤ 150 (`productId`, `rawName`, `quantity`, `unitPrice`, `lineTotal`) |
| `receiptKey` | string \| null | ≤ 64 (chave da NFC-e/hash — entrega B) |
| `ocrConfidence` | number \| null | 0–100 (entrega B) |
| `createdAt` | timestamp | servidor |

## Persistência

- Conclusão: um `writeBatch` com custo (`costEntries`, categoria padrão `alimentacao`), compra,
  atualização dos produtos com preço informado e lista (`concluida`). Até 150 produtos + 3 escritas.
- Lista: itens gravados como lista inteira (`updateDoc`); no mesmo aparelho, as edições são aplicadas
  sobre a versão mais recente (otimista); entre aparelhos diferentes, a última escrita vence.
- Produto novo e lista nova: id gerado no cliente (`doc()` + `setDoc`), sem esperar o servidor.

## Regras de segurança

- Leitura: dono. Escrita: dono com papel `admin|standard`, `userId` do dono, `keys().hasOnly`, tipos e
  tamanhos acima, carimbos de tempo do servidor.
- `groceryLists` update: somente enquanto `status == 'aberta'` (lista concluída é somente leitura).
  Concluir exige uma compra **nova** (`!exists` antes e `getAfter(...).listId == listId`) no mesmo lote;
  lista aberta não carrega `purchaseId`/`paidTotal`.
- `groceryPurchases` create exige o lançamento (`costEntryId`) gravado no mesmo lote (`existsAfter`).
- Limitação conhecida: as regras não iteram listas, então os mapas de `items` não são validados um a um
  (só o tamanho ≤ 150); o app grava sempre o formato correto e o conversor ignora itens malformados.
- `groceryPurchases`: create e delete; update negado.

## Índices

Nenhum novo (assinaturas das coleções inteiras do usuário).
