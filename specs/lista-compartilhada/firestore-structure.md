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

## D2 — compartilhamento

### `groceryInvites/{ownerId}_{listId}_{email}` (coleção raiz)

| Campo | Tipo | Regra |
| ----- | ---- | ----- |
| `ownerId` | string | dono (quem cria) |
| `ownerName` | string | 1–80 |
| `ownerEmail` | string | igual ao e-mail do token de quem convida |
| `listId` / `listName` | string | lista própria, aberta e com vaga; nome 1–60 |
| `email` | string | minúsculas, formato válido, ≤ 120, diferente do e-mail do dono; compõe o id |
| `status` | string | `pendente` (criação) → `aceito` \| `recusado` (pela convidada) |
| `memberUid` | string \| null | uid de quem aceitou |
| `createdAt` / `respondedAt` | timestamp | servidor |

- Leitura: dono (`ownerId`) ou e-mail confirmado igual a `email`.
- Consultas: `ownerId ==` + `listId ==` (dono); `email ==` + `status == pendente` (convidada).
- Delete: dono ou convidada (ou documento inexistente, para os lotes de remover/sair).
- Aceite: a regra da lista exige o convite **pendente antes** e **aceito depois** do lote.

### `users/{uid}/groceryLists/{listId}` (campos novos)

| Campo | Tipo | Regra |
| ----- | ---- | ----- |
| `ownerName` | string | ≤ 80 |
| `memberIds` | list<string> | ≤ 5; vazio na criação; só cresce pelo aceite (concat do próprio uid) |
| `members` | map<uid, {name, email}> | ≤ 5; a entrada do aceite tem o e-mail do token |

- Participante: lê (regra de grupo `/{path=**}/groceryLists`), altera só `items`/`updatedAt` em lista
  aberta (papel admin/standard), sai removendo só o próprio uid.
- Dono: só remove participantes (inclusive em lista concluída); não inclui ninguém.

### `users/{uid}/groceryMembers/{memberUid}`

`ownerId`, `memberUid`, `email` (do token), `name`, `listId`, `createdAt`. Criado/atualizado pela
própria pessoa só se ela estiver em `memberIds` da lista indicada (`getAfter`); apagado pelo dono ou
pela pessoa. Libera leitura de `groceryProducts` do dono e criação de produto **sem histórico**.

### Índices

- `fieldOverrides` `groceryLists.memberIds`: `array-contains` também no escopo de grupo de coleções.
