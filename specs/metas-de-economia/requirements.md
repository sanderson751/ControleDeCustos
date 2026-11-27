# Requirements - Metas de economia

## Contexto

O app mostra para onde o dinheiro vai, mas não ajuda a guardar. O usuário quer definir objetivos
("Reserva de emergência", "Viagem", "Carro"), registrar quanto guardou e ver quanto falta e quanto
precisa guardar por mês para chegar lá no prazo.

## Requisitos funcionais

- RF-01: nova tela **Metas** (`/goals`) com as metas do usuário em cartões: nome, valor guardado, valor-alvo, barra de progresso, quanto falta, prazo e situação.
- RF-02: criar meta com **nome** (1–60, único sem acento/caixa), **valor-alvo** (> 0) e **prazo opcional** (mês/ano, a partir do mês atual).
- RF-03: **registrar movimentação** em uma meta: **depósito** ou **retirada**, valor (> 0), data (até hoje) e observação opcional (até 200). Retirada não pode passar do valor guardado.
- RF-04: **histórico** das movimentações da meta (mais recentes primeiro), com exclusão de movimentação (com confirmação). Um depósito não pode ser excluído se o saldo ficar negativo.
- RF-05: cálculo por meta:
  - guardado = soma dos depósitos − soma das retiradas;
  - progresso em % (arredondado para baixo, no máximo 100%);
  - falta = alvo − guardado (mínimo 0);
  - com prazo: **quanto guardar por mês** = falta ÷ meses restantes (incluindo o mês atual).
- RF-06: situação: **Concluída** (guardado ≥ alvo), **Atrasada** (prazo já passou sem atingir o alvo), **Em andamento** (demais).
- RF-07: editar nome, valor-alvo e prazo da meta; excluir a meta (com confirmação), o que remove também suas movimentações.
- RF-08: no **Início**, um resumo "Metas de economia": quanto foi guardado no mês visualizado (depósitos − retiradas) e o progresso das até 3 metas **não concluídas** mais urgentes (atrasadas primeiro, depois prazo mais próximo; sem prazo por último), com link para Metas.
- RF-09: `guest` visualiza metas e histórico, sem criar, editar, registrar ou excluir.
- RF-10: alterações refletem em tempo real (outras abas/dispositivos).

## Requisitos não funcionais

- RNF-01: validações e cálculos (progresso, situação, valor mensal necessário, guardado no mês) em funções puras testadas, com aritmética em centavos.
- RNF-02: `firestore.rules`: metas e movimentações com dono, papel `admin|standard` para escrita, campos e tipos validados; movimentação só para meta existente do próprio usuário; movimentações não são editadas (exclui e registra de novo).
- RNF-03: tema light/dark com contraste AA (progresso com tokens semânticos); snackbar padrão.
- RNF-04: `npm run verify` e `npm run test:rules` sem erros.

## Critérios de aceite (Given/When/Then)

### Cenário 1 — criar e acompanhar
- Given hoje é 27/11/2026
- When o usuário cria "Viagem" com alvo R$ 6.000 e prazo 04/2027 e deposita R$ 1.200
- Then o cartão mostra R$ 1.200 de R$ 6.000 (20%), falta R$ 4.800 e "Guardar R$ 800,00 por mês" (6 meses: de 11/2026 a 04/2027)

### Cenário 2 — retirada
- Given a meta tem R$ 1.200 guardados
- When o usuário tenta retirar R$ 1.500
- Then aparece "A retirada não pode ser maior que o valor guardado (R$ 1.200,00)." e nada é gravado

### Cenário 3 — concluída
- Given guardado R$ 6.000 de R$ 6.000
- Then a situação é "Concluída" e o progresso é 100%

### Cenário 4 — atrasada
- Given prazo 10/2026 e guardado R$ 3.000 de R$ 6.000 em 11/2026
- Then a situação é "Atrasada" (em destaque) e o cartão mostra "Prazo vencido em out/2026: faltam R$ 3.000,00"

### Cenário 5 — Início
- Given depósitos de R$ 500 e uma retirada de R$ 100 em novembro
- When o usuário abre o Início em 11/2026
- Then o resumo mostra "Guardado no mês: R$ 400,00"

### Cenário 6 — exclusão
- Given uma meta com 3 movimentações
- When o usuário exclui a meta e confirma
- Then a meta e as movimentações deixam de existir

### Cenário 7 — guest
- Given um usuário `guest`
- When acessa `/goals`
- Then vê metas e histórico sem ações
