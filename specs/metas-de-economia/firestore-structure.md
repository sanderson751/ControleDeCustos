# Firestore - Metas de economia

## `users/{uid}/savingsGoals/{autoId}`

| Campo | Tipo | Regra |
| ----- | ---- | ----- |
| `userId` | string | dono |
| `name` | string | 1–60 |
| `targetAmount` | number | > 0 e ≤ 1.000.000.000 |
| `deadlineYear` / `deadlineMonth` | int \| null | ambos nulos ou ambos válidos (2000–2100 / 1–12) |
| `createdAt` / `updatedAt` | timestamp | |

## `users/{uid}/goalContributions/{autoId}`

| Campo | Tipo | Regra |
| ----- | ---- | ----- |
| `userId` | string | dono |
| `goalId` | string | meta existente do usuário |
| `amount` | number | ≠ 0; depósito > 0, retirada < 0; \|valor\| ≤ 1.000.000.000 |
| `date` | timestamp | data da movimentação |
| `note` | string | ≤ 200 |
| `createdAt` | timestamp | |

## Consultas

- Assinatura das duas coleções inteiras do usuário (sem índice).

## Regras de segurança

```txt
function isValidGoal(data) {
  return data.keys().hasOnly(['userId','name','targetAmount','deadlineYear','deadlineMonth','createdAt','updatedAt'])
    && data.name is string && data.name.size() > 0 && data.name.size() <= 60
    && data.targetAmount is number && data.targetAmount > 0 && data.targetAmount <= 1000000000
    && ((data.get('deadlineYear', null) == null && data.get('deadlineMonth', null) == null)
      || (data.get('deadlineYear', null) is int && data.deadlineYear >= 2000 && data.deadlineYear <= 2100
        && data.get('deadlineMonth', null) is int && data.deadlineMonth >= 1 && data.deadlineMonth <= 12));
}

function isValidContribution(userId, data) {
  return data.keys().hasOnly(['userId','goalId','amount','date','note','createdAt'])
    && data.goalId is string
    && exists(/databases/$(database)/documents/users/$(userId)/savingsGoals/$(data.goalId))
    && data.amount is number
    && ((data.amount > 0 && data.amount <= 1000000000) || (data.amount < 0 && data.amount >= -1000000000))
    && data.date is timestamp
    && data.get('note', '') is string && data.get('note', '').size() <= 200;
}

match /savingsGoals/{goalId} {
  allow read: if isOwner(userId);
  allow create: if isOwner(userId) && canWriteCosts() && request.resource.data.userId == userId && isValidGoal(request.resource.data);
  allow update: if isOwner(userId) && canWriteCosts() && !changedKeys().hasAny(['userId','createdAt']) && isValidGoal(request.resource.data);
  allow delete: if isOwner(userId) && canWriteCosts();
}

match /goalContributions/{contributionId} {
  allow read: if isOwner(userId);
  allow create: if isOwner(userId) && canWriteCosts() && request.resource.data.userId == userId && isValidContribution(userId, request.resource.data);
  allow update: if false;
  allow delete: if isOwner(userId) && canWriteCosts();
}
```

## Persistência

- Excluir meta: lotes de `commitInChunks` com a exclusão da **meta primeiro** e depois as das movimentações. Se um lote seguinte falhar, a exclusão já parece completa: movimentações sem meta são ignoradas pelo app.
- Datas: `date` da movimentação entre 2000 e o dia seguinte ao do servidor; `createdAt`/`updatedAt`, quando enviados, iguais ao horário do servidor.

## Índices

Nenhum novo.
