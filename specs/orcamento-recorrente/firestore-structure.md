# Firestore Structure - Orçamento recorrente

## Subcoleção nova

Caminho: `users/{userId}/recurringBudgets/{budgetId}` — `budgetId = "AAAA-MM-categoria"` (mês de início da vigência).

Campos:

- `userId`: string
- `year`: number (int, 2000–2100) — início da vigência
- `month`: number (int, 1–12) — início da vigência
- `category`: string (categorias padrão)
- `limit`: number (> 0, <= 1.000.000.000) **ou** `null` (encerra a recorrência a partir deste mês)
- `createdAt`: Timestamp
- `updatedAt`: Timestamp

Exemplo (histórico de Alimentação):

```json
[
  { "id": "2026-03-alimentacao", "year": 2026, "month": 3, "category": "alimentacao", "limit": 1200 },
  { "id": "2026-06-alimentacao", "year": 2026, "month": 6, "category": "alimentacao", "limit": 1500 },
  { "id": "2026-09-alimentacao", "year": 2026, "month": 9, "category": "alimentacao", "limit": null }
]
```

## Relação com `budgetLimits`

- `budgetLimits/{AAAA-MM-categoria}` continua representando o orçamento de **um único mês** e
  prevalece sobre a recorrência naquele mês (exceção).

## Consultas principais

- Vigências do usuário: `getDocs(recurringBudgets)` (sem filtro; volume pequeno).
- Exceções do mês: `budgetLimits where(year ==) where(month ==)` (inalterado).

## Operações de persistência

- Create: `set` com todos os campos quando não há vigência no mês.
- Update: somente `limit` e `updatedAt` quando já há vigência iniciada no mesmo mês.
- Delete: somente para vigências **futuras** substituídas por "Este mês em diante" (o encerramento é uma vigência com `limit: null`, preservando o histórico passado).
- Atomicidade: o mesmo `writeBatch` contém exceções mensais e vigências.
- Falha: snackbar vermelho; nada é gravado.

## Índices

- Nenhum índice novo.

## Regras de segurança

```txt
function isValidRecurringBudget(data) {
  return isValidCategory(data.category)
    && data.year is int && data.year >= 2000 && data.year <= 2100
    && data.month is int && data.month >= 1 && data.month <= 12
    && (data.limit == null
      || (data.limit is number && data.limit > 0 && data.limit <= 1000000000));
}

match /recurringBudgets/{budgetId} {
  allow read: if isOwner(userId);
  allow create: if isOwner(userId) && canWriteCosts()
    && request.resource.data.userId == userId
    && isValidRecurringBudget(request.resource.data)
    && budgetId == expectedBudgetId(request.resource.data);
  allow update: if isOwner(userId) && canWriteCosts()
    && !changedKeys().hasAny(['userId', 'year', 'month', 'category', 'createdAt'])
    && isValidRecurringBudget(request.resource.data);
  allow delete: if isOwner(userId) && canWriteCosts();
}
```
