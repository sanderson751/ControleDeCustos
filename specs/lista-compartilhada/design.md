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

## D2 — convites e lista compartilhada

### Decisões

- Compartilhamento **por lista** (pedido do usuário); só o dono conclui (o lançamento é dele).
- Sem servidor (plano Spark) não há e-mail de convite: o convite fica guardado para o e-mail e o dono
  envia o link `/grocery/convites` (Web Share no celular, cópia no computador).
- Convite só vale para **e-mail confirmado** (`email_verified` no token): sem isso, alguém poderia
  criar conta com o e-mail de outra pessoa e pegar o convite. Google já vem confirmado; e-mail e senha
  confirma pelo link do Firebase (`sendEmailVerification`) e "Já confirmei" faz `reload` + token novo.

### Dados e operações (`groceryShareService`)

- **Convidar** (`inviteToList`): lote com o convite `groceryInvites/{ownerId}_{listId}_{email}` (pendente) e
  `ownerName` na lista. Convite antigo do mesmo e-mail (recusado/aceito) é apagado antes.
- **Aceitar** (`acceptInvite`): um lote — convite `aceito` + `memberUid`; lista com
  `memberIds: arrayUnion(uid)` e `members.{uid}`; `users/{dono}/groceryMembers/{uid}`. As regras
  conferem um contra o outro com `getAfter`.
- **Recusar**: convite `recusado`. **Cancelar**: o dono apaga o convite.
- **Sair** (`leaveList`) / **remover** (`removeMember`): lista sem o uid, convite apagado e, se a pessoa
  não participa de outra lista do mesmo dono (consulta por `memberIds`), o acesso ao catálogo também.
- **Excluir lista**: `listShareCleanup` reúne convites da lista e acessos de quem só estava nela;
  `deleteList` apaga tudo no mesmo lote.
- **Listas compartilhadas comigo**: consulta de grupo de coleções `groceryLists` com
  `memberIds array-contains uid`. **Uma lista**: assinatura do documento (`subscribeToList`); ao perder
  o acesso a assinatura falha e a tela mostra a mensagem.

### Telas

- **Lista (dono)**: botão Compartilhar / "Compartilhada (N)" abre `ShareListDialog` (e-mail,
  participantes com Remover, convites com status, Enviar link).
- **Mercado**: `GroceryInvitesCard` (confirmação de e-mail ou convites com Aceitar/Recusar) e
  "Compartilhadas comigo"; listas próprias mostram "compartilhada com N pessoas".
- **Lista e modo mercado do participante**: rotas `/grocery/compartilhada/:ownerId/:listId[/shop]`
  (mesmas telas). `useGroceryList` assina o documento da lista e o catálogo do dono; itens e
  produtos novos gravam no caminho do dono. Sem conclusão, orçamento, compartilhar nem "Usar
  novamente"; botão "Sair da lista".
- `/grocery/convites` redireciona para Mercado (link estável para o convite).

### Riscos e limites

- Convite só entra **pendente → aceito no mesmo lote** do aceite (`get` antes, `getAfter` depois): um
  convite antigo não reabre a lista. O id inclui o dono (`{ownerId}_{listId}_{email}`) e o convite
  traz `ownerEmail` conferido pelo token (o nome é livre; o e-mail mostrado não).
- Apagar convite inexistente é permitido: remover/sair não trava se o convite já sumiu.
- `members` só tem chaves de `memberIds`; o participante grava `updatedAt` só com o horário do servidor.
- O conteúdo de cada item não é validado nas regras (não iteram mapas): um participante mal-intencionado
  pode gravar itens grandes até o limite do documento; o dono o remove e exclui a lista.
- Até 5 participantes por lista (convites pendentes contam na tela; as regras limitam `memberIds`).
- Removido enquanto sem sinal: as alterações pendentes da pessoa são recusadas ao sincronizar.
- O acesso ao catálogo vale para o dono inteiro (não por lista): quem participa de uma lista vê os
  preços do catálogo do dono — necessário para a previsão e o autocomplete.
