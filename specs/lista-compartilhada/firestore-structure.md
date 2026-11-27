# Firestore Structure - lista-compartilhada

## D1 — `users/{uid}/groceryLists/{listId}.items`

Formato atual (mapa por id do item):

| Campo | Tipo | Regra |
| ----- | ---- | ----- |
| `items` | map<itemId, map> | ≤ 150 entradas |
| `items.{id}.productId` | string | produto do catálogo do dono |
| `items.{id}.name` | string | nome no momento da inclusão |
| `items.{id}.quantity` | number | > 0 |
| `items.{id}.checked` | bool | no carrinho |
| `items.{id}.order` | number | posição: índice na criação/conversão; `Date.now()` para incluídos depois |

```json
{
  "items": {
    "3f1c…": { "productId": "p1", "name": "Arroz 5kg", "quantity": 2, "checked": false, "order": 0 },
    "9a2b…": { "productId": "p2", "name": "Café", "quantity": 1, "checked": true, "order": 1795000000000 }
  }
}
```

Formato antigo (array de `{ id, productId, name, quantity, checked }`) continua aceito pelas regras e
pelo conversor; a primeira alteração converte item a item (`convertListItems`).

### Operações

- create (`createList`): mapa completo (`toStoredItems`).
- update (`updateListItems`): um `updateDoc` com os caminhos alterados —
  `items.{id}` (inclusão), `items.{id}.{campo}` (alteração), `items.{id}` = `deleteField()` (remoção,
  inclusive de sobras incompletas) e `updatedAt`.
- conversão (`convertListItems`): `items.{id}` completo para cada item e `deleteField()` para os
  removidos; lista vazia grava `items = {}`.
- Conclusão e exclusão: sem mudança.

### Regras

- `isValidGroceryList`: `(items is map || items is list) && items.size() <= 150`.
- update: `!(resource.data.items is map) || request.resource.data.items is map` (mapa não volta a array).
- Conteúdo de cada item não é validado nas regras (não iteram mapas); o conversor ignora itens
  malformados.

### Índices

- `fieldOverrides`: `groceryLists.items` sem indexação (mapa de chaves dinâmicas, sem consulta).

## D2 — planejado

- `groceryInvites/{listId}_{email}` (raiz): `ownerId`, `ownerName`, `listId`, `listName`, `email`,
  `status`, `memberUid`, `createdAt`, `respondedAt`.
- `users/{uid}/groceryLists/{listId}`: + `memberIds` (list ≤ 5), `members` (map), `ownerName`.
- `users/{uid}/groceryMembers/{memberUid}`: acesso do participante ao catálogo do dono.
- Índice: `groceryLists.memberIds` (array-contains) no escopo de grupo de coleções.
