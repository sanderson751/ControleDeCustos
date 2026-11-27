# Requirements - Lista de mercado

> Plano completo: 3 entregas. **A**: lista, catálogo de produtos, previsão pelo histórico,
> conclusão com total manual e lista x orçamento. **B**: foto da comanda (OCR no navegador).
> **C**: variação de preços, sugestão de reposição e modo mercado.

## Contexto

O app registra gastos, mas não ajuda a planejar o mercado. O usuário quer uma lista de compras cujo
valor previsto venha **somente do que ele pagou na última compra** de cada produto (ele não tem os
preços atualizados) e que, ao concluir a compra, vire automaticamente um lançamento de mercado.

## Requisitos funcionais (entrega A)

- RF-01: nova área **Mercado** (`/grocery`) com as listas abertas e o histórico de listas concluídas.
- RF-02: criar lista com nome (1–60; padrão "Compra de DD/MM").
- RF-03: adicionar itens à lista escolhendo um produto do **catálogo pessoal** (busca sem acento/caixa) ou
  criando um produto novo (nome 1–80, único sem acento/caixa; unidade: un, kg, g, l, ml, pct). Quantidade
  > 0 e ≤ 9999 (até 3 casas para kg/l; vírgula é o separador decimal e "1.000" em g/ml é mil). O mesmo
  produto não se repete na lista (a quantidade é somada).
- RF-04: cada item mostra quantidade, **preço unitário previsto** (último preço pago) e **total previsto**
  (preço × quantidade). Produto nunca comprado aparece como **"sem histórico"**. Não existe digitação de
  preço na lista.
- RF-05: a lista mostra o **total previsto** e quantos itens estão sem histórico; itens podem ser marcados
  como pegos, ter a quantidade alterada ou ser removidos.
- RF-06: **lista x orçamento**: com orçamento de Alimentação no mês, mostra gasto atual + previsto da lista
  contra o limite, com alerta em 80% (atenção) e 100% (estouro). Sem orçamento, informa que não há.
- RF-07: **concluir compra**: informar loja (padrão "Mercado"), data (até hoje) e **total pago**
  (obrigatório); opcionalmente o **preço unitário pago** de cada item. Ao confirmar, de uma vez:
  - cria o custo "Mercado — <loja>" em **Alimentação** (variável), no total pago, na data da compra,
    com descrição "Lista: <nome>";
  - registra a compra (itens com preço pago) para o histórico;
  - atualiza o último preço de cada produto com preço informado (o anterior é guardado para a variação);
  - marca a lista como concluída (somente leitura).
- RF-08: lista concluída pode ser **usada novamente**: cria uma lista aberta com os mesmos itens desmarcados,
  já com a previsão pelos preços mais recentes.
- RF-09: excluir lista (com confirmação); o lançamento e a compra registrados permanecem.
- RF-10: `guest` visualiza listas e previsões, sem criar, editar ou concluir.
- RF-11: tudo em tempo real entre abas/dispositivos. Edições rápidas em sequência no mesmo aparelho
  (quantidade + marcar, duplo toque, incluir produto novo) nunca se anulam, e a tela não espera o servidor
  (4G do mercado). A lista de compras concluídas mostra o **total pago**.

## Requisitos funcionais (entrega B — foto da comanda)

- RF-12: no diálogo de conclusão, **Fotografar comanda** (câmera no celular, arquivo no computador). A
  imagem é lida **no próprio aparelho** (OCR Tesseract.js em português, sem envio a servidor) com
  barra de progresso.
- RF-13: a leitura preenche **loja, data e total pago** (prefere "VALOR A PAGAR" a "VALOR TOTAL") e o
  **preço pago** de cada item da lista reconhecido.
- RF-14: **revisão** dos itens lidos: cada linha da comanda vai para um item da lista, um produto do
  catálogo, um **produto novo** (já com o preço) ou é ignorada. Sugestão automática por apelido
  aprendido e semelhança de nomes (marca e medidas não atrapalham; "BISCOITO DE ARROZ" não vira "Arroz").
- RF-15: o nome lido vira **apelido** do produto, para a próxima comanda já reconhecer sozinha —
  só quando o usuário escolheu o destino ou a associação automática é segura.
- RF-16: **comanda já lançada** (mesma chave da NFC-e — QR Code ou texto — ou mesma loja + dia + total)
  bloqueia a conclusão com aviso; é possível descartar a leitura e concluir manualmente.
- RF-17: foto ilegível, total divergente da soma dos itens (≥ 5%) ou confiança baixa pedem conferência;
  nada é gravado sem a confirmação do usuário.

## Requisitos funcionais (entrega C — inteligência)

- RF-18: **variação de preço** por produto (último preço pago × anterior: "+12%", "−5%", "estável"),
  com ícone e texto (nunca só cor), ao lado do preço previsto na lista.
- RF-19: **"Seus preços"** em Mercado: **sua inflação do mercado** no mês (cesta com uma unidade de cada
  produto recomprado no mês: soma dos preços atuais ÷ soma dos anteriores), maiores altas e quedas, e o
  histórico resumido de cada produto (anterior, último, variação, data e loja da última compra).
- RF-20: **"Talvez esteja acabando"**: na lista aberta, produtos comprados ao menos 2 vezes, fora da lista,
  cuja última compra já atingiu 80% do intervalo médio entre compras ("comprado a cada ~7 dias · última há
  9 dias"), com botão para adicionar (quantidade 1). Até 6, os mais atrasados primeiro.
- RF-21: **modo mercado** (`/grocery/:listId/shop`): itens grandes para marcar no corredor, soma em tempo
  real do previsto do que já está no carrinho (itens sem histórico ficam fora da soma, com aviso), progresso
  e "Concluir compra". A tela fica ligada enquanto aberta (Screen Wake Lock, quando o navegador permite).
- RF-22: **sem sinal**: marcar itens funciona offline e sincroniza quando a conexão volta (cache persistente
  do Firestore no aparelho), com aviso "Sem conexão". A tela do modo mercado é baixada ao abrir a lista
  (não há app offline completo: abrir o app do zero sem sinal não funciona). Concluir a compra sem sinal
  salva no aparelho e avisa que sincroniza depois. Ao sair da conta, o cache local é apagado em todas as
  abas (que recarregam no login); com alterações ainda não sincronizadas, a saída pede confirmação.

## Requisitos não funcionais

- RNF-01: previsão, validações, atualização do produto após a compra e lista x orçamento em funções puras
  testadas (centavos).
- RNF-02: `firestore.rules`: três coleções novas com dono, papel `admin|standard` para gravar, campos e
  tamanhos validados; compra imutável; lista concluída não é editada.
- RNF-03: conclusão grava custo + compra + produtos + lista em um único lote atômico.
- RNF-04: tema light/dark, snackbar padrão, `npm run verify`, `test:rules` e `test:e2e` verdes.

## Critérios de aceite (Given/When/Then)

### Cenário 1 — primeira compra
- Given uma lista com "Arroz 5kg" (2 un) e "Café" (1 un), nunca comprados
- When o usuário abre a lista
- Then os dois itens aparecem "sem histórico" e o total previsto é R$ 0,00 (2 itens sem histórico)

### Cenário 2 — conclusão
- Given a lista do cenário 1
- When conclui informando loja "Assaí", total R$ 60,00, Arroz R$ 25,90 e Café R$ 8,20
- Then surge o custo "Mercado — Assaí" de R$ 60,00 em Alimentação e a lista fica concluída

### Cenário 3 — previsão pelo histórico
- Given o cenário 2
- When o usuário usa a lista novamente
- Then Arroz prevê R$ 25,90 × 2 = R$ 51,80, Café R$ 8,20 e o total previsto é R$ 60,00

### Cenário 4 — lista x orçamento
- Given orçamento de Alimentação R$ 500 e R$ 420 já gastos no mês
- When a lista prevê R$ 60,00
- Then aparece atenção: "R$ 480,00 de R$ 500,00 (96%)"

### Cenário 5 — guest
- Given um `guest`
- Then vê as listas sem ações de criar, editar ou concluir
