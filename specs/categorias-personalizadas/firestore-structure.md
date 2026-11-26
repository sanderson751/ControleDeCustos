# Firestore Structure - Categorias personalizadas

## Subcoleção nova

Caminho: `users/{userId}/categories/{categoryId}` (id gerado pelo Firestore)

Campos:

- `userId`: string
- `name`: string (1–40)
- `archived`: boolean
- `createdAt`, `updatedAt`: Timestamp

## Campos que referenciam categoria

- `costEntries.category`, `budgetLimits.category`, `recurringBudgets.category`: id padrão
  (`moradia | alimentacao | transporte | saude | educacao | lazer | outros`) **ou** id de um
  documento existente em `users/{userId}/categories`.
- Ids de orçamento continuam `AAAA-MM-<categoria>` (ids gerados pelo Firestore são alfanuméricos).

## Consultas

- Catálogo: `onSnapshot(users/{uid}/categories)` (volume pequeno, ≤ 20 documentos).

## Operações de persistência

- Create: `addDoc` com `name` aparado, `archived: false`.
- Update: `name` (renomear) ou `archived` (arquivar/reativar) + `updatedAt`.
- Delete: não permitido (preserva o histórico).
- Unicidade de nome e limite de 20: validados no app.

## Regras de segurança

```txt
function isDefaultCategory(category) {
  return category in ['moradia', 'alimentacao', 'transporte', 'saude', 'educacao', 'lazer', 'outros'];
}

function isValidCategory(userId, category) {
  return category is string
    && (isDefaultCategory(category)
      || (category.matches('^[A-Za-z0-9]{1,40}$')
        && exists(/databases/$(database)/documents/users/$(userId)/categories/$(category))));
}

function isValidCategoryDoc(data) {
  return data.keys().hasOnly(['userId', 'name', 'archived', 'createdAt', 'updatedAt'])
    && data.name is string && data.name.size() > 0 && data.name.size() <= 40
    && data.name.matches('.*[^ ].*')
    && data.archived is bool;
}

match /categories/{categoryId} {
  allow read: if isOwner(userId);
  allow create: if isOwner(userId) && canWriteCosts()
    && request.resource.data.userId == userId && isValidCategoryDoc(request.resource.data);
  allow update: if isOwner(userId) && canWriteCosts()
    && !changedKeys().hasAny(['userId', 'createdAt'])
    && isValidCategoryDoc(request.resource.data);
  allow delete: if false;
}
```

`isValidCost`, `isValidBudget` e `isValidRecurringBudget` passam a usar `isValidCategory(userId, ...)`.

Observações:

- O formato `^[A-Za-z0-9]{1,40}$` garante ids seguros no caminho do `exists()` e no id
  `AAAA-MM-<categoria>` dos orçamentos (ids automáticos do Firestore têm 20 caracteres
  alfanuméricos). Lançamentos legados com texto livre (ex.: "Alimentação") são lidos como
  `outros` pelo conversor.
- As regras **não** bloqueiam categoria arquivada (o arquivamento é uma regra de UI; editar
  lançamentos antigos continua permitido).
- Cada categoria personalizada distinta em uma requisição custa um acesso (`exists()`), e
  batches têm limite de acessos a documentos. O `budgetService` grava em lotes de até
  **10 categorias personalizadas distintas** (atômico no caso comum; com mais categorias,
  lotes sequenciais). Coberto no emulador.
- Unicidade do nome e limite de 20 são garantidos pelo app, que bloqueia criar/renomear/
  arquivar enquanto o catálogo carrega ou falha.
- "Copiar mês anterior" em Orçamentos considera apenas as linhas exibidas no mês: limite de
  categoria arquivada sem uso no mês atual não é copiado.

## Índices

- Nenhum novo.
