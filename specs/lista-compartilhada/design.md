# Design - lista-compartilhada

## D1 — itens da lista como mapa

### Problema

Até a entrega C, cada alteração regravava o array `items` inteiro (última escrita vence). Com dois
aparelhos, a gravação de um apagava a do outro — no modo mercado offline, a reconexão desfazia tudo o
que o outro aparelho marcou enquanto isso.

### Solução

- `items` passa a ser um **mapa** `items.{itemId} = { productId, name, quantity, checked, order }`.
- `order` fixa a posição (mapa não tem ordem): índice na criação/conversão; itens incluídos depois
  recebem `Date.now()` (+ deslocamento), ficando depois dos existentes em qualquer aparelho.
- **Gravação por diferença** (`diffListItems`, puro, em `src/domain/rules/groceryListItems.ts`):
  - item novo → `items.{id}` com o objeto completo;
  - campo alterado → `items.{id}.{campo}` (só aquele campo);
  - item removido → `items.{id}` = `deleteField()`.
- `updateListItems(userId, listId, next, previous)` monta um único `updateDoc` com `FieldPath`
  (ids com qualquer caractere) e `updatedAt`. Sem diferença, não grava.
- `useOptimisticListItems` passa a versão anterior (a mais recente local, inclusive com gravações
  pendentes) como `previous`.

### Compatibilidade (sem migração)

- O conversor lê o formato antigo (array) e o novo (mapa, ordenado por `order` e id) e expõe
  `legacyItems`.
- Lista antiga: a primeira alteração chama `convertListItems`, que grava **item a item**
  (`items.{id}` completo, ordem = índice, e `deleteField()` para os removidos). Sobre o array, o
  Firestore troca o campo por um mapa (conversão completa); se outro aparelho já converteu, as
  inclusões e alterações dele em outros itens permanecem. Lista esvaziada grava `items = {}`.
- Regras aceitam `items` como mapa ou array, com tamanho ≤ 150, e **um mapa nunca volta a array**:
  uma aba ainda com a versão anterior do app recebe erro de permissão em vez de apagar a lista.
- Item incompleto (ex.: removido num aparelho enquanto outro mudava um campo, restando só
  `{ checked }`) é ignorado pelo conversor, exposto em `staleItemIds` e apagado na próxima gravação.
- `order` de inclusões: `max(Date.now(), última ordem + 1)` no aparelho, sem empate no mesmo milissegundo.
- `groceryLists.items` fica fora da indexação automática (`fieldOverrides`): mapa de chaves dinâmicas
  sem consulta.

### Trade-offs

- Dois aparelhos que alteram o **mesmo campo do mesmo item** continuam com "última escrita vence"
  (aceitável: é a mesma intenção).
- Dois aparelhos incluindo o **mesmo produto** ao mesmo tempo geram dois itens (o app une só os que
  já estão na tela); a pessoa remove um. Incluir um produto que já está na lista soma a quantidade
  vista na tela: se outro aparelho mudou essa quantidade há instantes, vale a última gravação.
- Durante a conversão, um item que os dois aparelhos têm fica com a versão de quem gravou por último.
- Sem transação: transações não funcionam offline, requisito do modo mercado.

## D2 — convites e lista compartilhada (planejado)

- **Convite** `groceryInvites/{listId}_{email}` (coleção raiz): `ownerId`, `ownerName`, `listId`,
  `listName`, `email` (minúsculas), `status` `pendente|aceito|recusado`, `memberUid`, datas.
  O id fixo impede convite duplicado.
- **Lista** ganha `memberIds[]` (≤ 5), `members` (nome/e-mail para exibição) e `ownerName`.
- **Acesso ao catálogo** `users/{dono}/groceryMembers/{uid}`: libera leitura e criação de produto
  (sempre sem preço) para quem participa de alguma lista do dono.
- **Aceite** em um lote: convite → `aceito`, lista recebe o `uid` em `memberIds`, acesso ao catálogo.
  A regra confere convite aceito, do e-mail do token (`email_verified`), para aquela lista.
- **Participante**: altera só `items`/`updatedAt` de lista aberta; pode se retirar de `memberIds`.
- **Listas do participante**: consulta de grupo de coleções `groceryLists` por
  `memberIds array-contains uid` (índice em `firestore.indexes.json`).
- **Telas**: botão Compartilhar (dono), convites e "Compartilhadas comigo" em Mercado, rotas
  `/grocery/convites` e `/grocery/compartilhada/:donoId/:listId[/shop]`, confirmação de e-mail.
- Sem servidor não há envio de e-mail: o dono compartilha o link (Web Share/WhatsApp/copiar).
