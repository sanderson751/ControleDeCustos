# Tasks - lista-compartilhada

> Referencia obrigatoria: usar e manter alinhado com `specs/_template/dod-checklist.md`.

## D1 — itens por mapa (edição simultânea)

### Domínio e serviço

- [x] `diffListItems` e `toStoredItems` puros com testes (`groceryListItems.ts`).
- [x] Conversor lê array (antigo) e mapa (ordenado por `order`), expõe `legacyItems`, ignora item incompleto.
- [x] `createList` grava mapa; `updateListItems` grava só a diferença com `FieldPath`/`deleteField`.
- [x] `useOptimisticListItems` envia a versão anterior; lista antiga é convertida (regrava tudo).

### Regras e testes

- [x] `firestore.rules`: `items` mapa ou array, ≤ 150.
- [x] Teste de regras: conversão, dois clientes alterando itens diferentes, limite e tipo inválido.
- [x] Testes do serviço, conversor e hook; testes das telas ajustados.
- [x] E2E: dois aparelhos, um sem sinal, marcando itens diferentes — nenhuma marcação se perde.
- [x] E2E da entrega C (lista antiga convertida no primeiro toque) segue verde.
- [x] Revisão do qa-engineer e correções (aba antiga não apaga lista convertida; conversão item a item;
  limpeza de itens incompletos; ordem sem empate; `items` fora da indexação).

## D2 — convites e lista compartilhada

- [ ] Coleção `groceryInvites`, campos de membros na lista e `groceryMembers`, com regras e testes.
- [ ] Índice de grupo de coleções para `memberIds`.
- [ ] Confirmação de e-mail para contas de e-mail e senha.
- [ ] Diálogo Compartilhar (dono), convites e "Compartilhadas comigo" (Mercado), sair da lista.
- [ ] Rotas da lista compartilhada (lista e modo mercado) em modo participante.
- [ ] E2E com dois usuários: convidar, aceitar, editar em tempo real, remover acesso.

## Definicao de pronto

- [ ] Checklist DoD transversal aplicado conforme `specs/_template/dod-checklist.md` (por entrega).
