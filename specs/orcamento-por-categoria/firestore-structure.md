# Firestore Structure - Orçamento mensal por categoria

## Subcoleção

Caminho: `users/{userId}/budgetLimits/{budgetId}` — `budgetId = "AAAA-MM-categoria"` (ex.: `2026-03-alimentacao`).

Campos:

- `userId`: string
- `year`: number (int, 2000–2100)
- `month`: number (int, 1–12)
- `category`: string (`moradia | alimentacao | transporte | saude | educacao | lazer | outros`)
- `limit`: number (> 0, <= 1.000.000.000)
- `createdAt`: Timestamp
- `updatedAt`: Timestamp

Exemplo:

```json
{
  "userId": "u_123",
  "year": 2026,
  "month": 3,
  "category": "alimentacao",
  "limit": 1200,
  "createdAt": "SERVER_TIMESTAMP",
  "updatedAt": "SERVER_TIMESTAMP"
}
```

## Consultas principais

- Orçamentos da competência: `where(year == Y) + where(month == M)`.
- Mês anterior (cópia): mesma consulta com a competência anterior.

## Operações de persistência

- Create: `set` com todos os campos (`createdAt`/`updatedAt` = `serverTimestamp()`).
- Update: somente `limit` e `updatedAt`.
- Delete: hard delete quando o limite é apagado no formulário.
- Todas as alterações de uma gravação vão em um único `writeBatch` (atômico).
- Falha: snackbar vermelho, valores digitados preservados.

## Índices

- Nenhum índice novo (consulta só com igualdades). O índice existente `year ASC, month ASC, category ASC` permanece.

## Regras de segurança

```txt
function isValidBudget(data) {
  return data.category in CATEGORIAS
    && data.year is int && data.year >= 2000 && data.year <= 2100
    && data.month is int && data.month >= 1 && data.month <= 12
    && data.limit is number && data.limit > 0 && data.limit <= 1000000000;
}

match /budgetLimits/{budgetId} {
  allow read: if isOwner(userId);
  allow create: if isOwner(userId) && canWriteCosts()
    && request.resource.data.userId == userId && isValidBudget(request.resource.data)
    && budgetId == expectedBudgetId(request.resource.data); // AAAA-MM-categoria
  allow update: if isOwner(userId) && canWriteCosts()
    && !changedKeys().hasAny(['userId', 'year', 'month', 'category', 'createdAt'])
    && isValidBudget(request.resource.data);
  allow delete: if isOwner(userId) && canWriteCosts();
}
```
