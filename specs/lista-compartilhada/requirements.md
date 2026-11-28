# Requirements - lista-compartilhada

## Contexto

Na mesma casa, mais de uma pessoa monta e faz a compra do mercado. O dono de uma lista quer convidar
outra pessoa, pelo e-mail, para ver a lista, montar os itens junto e marcar o que já está no carrinho,
cada um no próprio aparelho, inclusive sem sinal dentro do mercado.

Escopo inicial: **somente a lista de mercado** é compartilhada. Custos, orçamentos, metas, histórico
de compras e a conclusão da compra continuam do dono.

Entregas:

- **D1 — itens por mapa:** base técnica para edição simultânea (sem mudança visível).
- **D2 — convites e lista compartilhada:** convite por e-mail, aceite, edição pelo convidado.

## Requisitos funcionais

### D1 — edição simultânea sem perda

- RF-01: Cada alteração de item (incluir, remover, quantidade, marcar) grava apenas aquele item/campo;
  alterações feitas em itens diferentes, por aparelhos diferentes, se somam.
- RF-02: Marcações feitas sem sinal sincronizam quando a conexão volta sem desfazer o que outro
  aparelho alterou em outros itens.
- RF-03: Listas gravadas no formato antigo continuam abrindo normalmente e são convertidas na primeira
  alteração, sem script de migração.

### D2 — compartilhamento

- RF-04: O dono de uma lista aberta convida uma pessoa pelo e-mail (até 5 participantes por lista).
- RF-05: O convite aparece em Mercado para quem entra no app com aquele e-mail **confirmado**; a pessoa
  aceita ou recusa. Não há envio automático de e-mail (sem servidor); o dono pode enviar o link.
- RF-06: O participante vê a lista (previsto, variação, reposição), inclui/remove/altera itens usando o
  catálogo do dono e marca itens, inclusive no modo mercado e sem sinal.
- RF-07: O participante não renomeia, não exclui, não conclui a compra e não convida outras pessoas;
  pode sair da lista.
- RF-08: O dono vê os participantes e convites pendentes e pode cancelar convite ou remover alguém.
- RF-09: Lista x orçamento, histórico de compras e custos do dono não aparecem para o participante.
- RF-10: Quem entra com e-mail e senha sem confirmar o e-mail vê como confirmar (enviar o link e
  "Já confirmei"); os convites aparecem depois da confirmação, sem sair do app.
- RF-11: Ao excluir uma lista compartilhada, os convites e o acesso de quem só participava dela saem junto.
  Sem conseguir conferir os convites (ex.: sem conexão), a exclusão de lista com participantes é recusada com aviso.
- RF-12: Convidar, aceitar, recusar, cancelar, remover e sair exigem conexão (aviso quando sem sinal);
  sair pede confirmação.
- RF-13: Usuário `guest` pode aceitar convite e participar **somente consultando** (não altera itens).
  Lista concluída continua visível para quem participa (inclusive o total pago), sem edição.
- RF-14: Convite pendente de lista que foi concluída ou excluída continua aparecendo até a pessoa
  recusar; aceitar mostra que a lista não aceita mais participantes. O dono cancela convites também
  em lista concluída.

## Requisitos nao funcionais

- RNF-01: `firestore.rules` é a única barreira: o participante só altera `items` de lista aberta da
  qual participa; ninguém entra numa lista sem convite aceito para o próprio e-mail confirmado.
- RNF-02: Funciona offline como o modo mercado da entrega C (cache persistente do Firestore).
- RNF-03: Tema `light` e `dark` com contraste AA; feedback por `notify()`.
- RNF-04: `npm run verify`, `test:rules` e `test:e2e` verdes; lint sem erros.

## Criterios de aceite (Gherkin)

### Cenario 1 - dois aparelhos, um sem sinal (D1)

Given uma lista aberta com "Arroz" e "Café" aberta em dois aparelhos
And o primeiro aparelho está sem sinal
When o primeiro marca "Arroz" e o segundo marca "Café"
And a conexão do primeiro volta
Then os dois itens ficam marcados no Firestore e nos dois aparelhos

### Cenario 2 - lista no formato antigo (D1)

Given uma lista gravada antes desta entrega (itens em array)
When o usuário altera um item
Then a lista é regravada no formato novo com todos os itens e a alteração

### Cenario 3 - convite aceito (D2)

Given Ana convida "bia@exemplo.com" para a lista "Feira"
When Bia entra com esse e-mail confirmado e aceita o convite
Then "Feira" aparece em "Compartilhadas comigo"
And o item que Bia incluir aparece na hora para Ana

### Cenario 4 - acesso negado (D2)

Given um usuário sem convite aceito para a lista
When ele tenta ler ou alterar a lista ou o catálogo do dono
Then as regras do Firestore negam
