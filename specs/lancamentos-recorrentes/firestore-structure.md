# Firestore - Lançamentos recorrentes automáticos

## Coleção nova: `users/{uid}/recurringCosts/{autoId}`

| Campo | Tipo | Regra |
| ----- | ---- | ----- |
| `userId` | string | dono |
| `accountName` | string | 1–200 |
| `amount` | number | > 0 e ≤ 1.000.000.000 |
| `costType` | string | `fixo` \| `variavel` |
| `category` | string | padrão ou personalizada existente do usuário |
| `description` | string | ≤ 500 |
| `dayOfMonth` | int | 1–28 |
| `startYear` / `startMonth` | int | 2000–2100 / 1–12 |
| `active` | bool | pausada quando false |
| `lastGeneratedYear` / `lastGeneratedMonth` | int \| null | cursor do último mês gerado |
| `createdAt` / `updatedAt` | timestamp | |

## Lançamentos gerados: `users/{uid}/costEntries/rec-{recurringId}-{AAAA-MM}`

Custo comum (`installmentsTotal` 1, competência do mês, `createdAt` = dia configurado ao
meio-dia) com o campo opcional novo `recurringId` (string ≤ 40).

## Consultas

- Recorrências do usuário: leitura da subcoleção inteira (sem índice).

## Persistência

- Geração: uma transação por recorrência (lê a recorrência; grava até 24 ocorrências + cursor).
- Pausar: somente `active: false`. Reativar: transação que ajusta o cursor para o mês anterior ao atual.

## Regras de segurança

```txt
function isValidRecurringCost(userId, data) {
  return data.keys().hasOnly(['userId','accountName','amount','costType','category','description',
      'dayOfMonth','startYear','startMonth','active','lastGeneratedYear','lastGeneratedMonth',
      'createdAt','updatedAt'])
    && data.accountName is string && data.accountName.size() > 0 && data.accountName.size() <= 200
    && data.amount is number && data.amount > 0 && data.amount <= 1000000000
    && data.costType in ['fixo', 'variavel']
    && isValidCategory(userId, data.category)
    && data.get('description', '') is string && data.get('description', '').size() <= 500
    && data.dayOfMonth is int && data.dayOfMonth >= 1 && data.dayOfMonth <= 28
    && data.startYear is int && data.startYear >= 2000 && data.startYear <= 2100
    && data.startMonth is int && data.startMonth >= 1 && data.startMonth <= 12
    && data.active is bool
    && (data.get('lastGeneratedYear', null) == null || data.lastGeneratedYear is int)
    && (data.get('lastGeneratedMonth', null) == null
      || (data.lastGeneratedMonth is int && data.lastGeneratedMonth >= 1 && data.lastGeneratedMonth <= 12));
}

match /recurringCosts/{recurringId} {
  allow read: if isOwner(userId);
  allow create: if isOwner(userId) && canWriteCosts()
    && request.resource.data.userId == userId && isValidRecurringCost(userId, request.resource.data);
  allow update: if isOwner(userId) && canWriteCosts()
    && !changedKeys().hasAny(['userId', 'createdAt'])
    && isValidRecurringCost(userId, request.resource.data);
  allow delete: if isOwner(userId) && canWriteCosts();
}
```

`isValidCost` passa a aceitar `recurringId` opcional (alfanumérico, até 40) e, quando presente, o id
do documento deve ser `rec-<recurringId>-<AAAA-MM>` (`isValidOccurrenceId`). O cursor exige ano e
mês juntos (ambos nulos ou ambos válidos).

## Índices

Nenhum novo.
