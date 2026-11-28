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

- [x] Regras puras (`groceryShareRules`): e-mail, id do convite, validação do convite, acesso ao catálogo.
- [x] Coleção `groceryInvites`, campos de membros na lista e `groceryMembers`, com regras.
- [x] Testes de regras (`tests/rules/groceryShare.rules.test.ts`): convite, leitura, aceite, intrusos,
  e-mail não confirmado, guest, sair/remover, lista concluída.
- [x] Índice de grupo de coleções para `memberIds`.
- [x] Confirmação de e-mail (`sendVerificationEmail`, `refreshEmailVerification`).
- [x] Serviço `groceryShareService` e limpeza ao excluir lista, com testes.
- [x] Diálogo Compartilhar (dono), convites e "Compartilhadas comigo" (Mercado), sair da lista.
- [x] Rotas da lista compartilhada (lista e modo mercado) em modo participante, com testes de tela.
- [x] E2E com dois usuários: convidar, confirmar e-mail, aceitar, editar em tempo real, remover acesso.
- [x] Revisão do qa-engineer e correções (participante não trava a própria remoção; convite antigo não
  reabre a lista; id com o dono e `ownerEmail`; limpeza da exclusão sem perder acessos; mensagens
  específicas; lista concluída com remover/cancelar; ações exigem conexão; confirmação ao sair).

## Definicao de pronto

- [ ] Checklist DoD transversal aplicado conforme `specs/_template/dod-checklist.md` (por entrega).
