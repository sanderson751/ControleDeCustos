# Firestore Structure - Evolução mensal

## Coleções

Nenhuma coleção ou campo novo. Leitura de:

- `users/{uid}/costEntries` — `competenceYear`, `competenceMonth`, `amount`, `category`, `costType`.
- `users/{uid}/budgetLimits` — exceções mensais (`year`, `month`, `category`, `limit`).
- `users/{uid}/recurringBudgets` — vigências recorrentes.

## Consultas principais

- Custos do período: `where("competenceYear", "in", [anos do período])` (até 2 anos para 12 meses); meses fora do período descartados no client.
- Orçamentos mensais do período: `where("year", "in", [anos])`.
- Vigências: coleção inteira do usuário (volume pequeno).

## Operações de persistência

- Somente leitura (sem create/update/delete).
- Falha de leitura: snackbar vermelho e mensagem na tela.

## Índices

- Nenhum novo: `in` em campo único usa o índice automático.

## Regras de segurança

- Inalteradas: leitura restrita ao dono (`isOwner(userId)`) já cobre as três coleções.
