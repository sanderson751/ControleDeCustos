# Firestore Structure - <nome-da-feature>

## Colecao raiz

- `users/{userId}`
  - campos do perfil minimo do usuario

## Subcolecoes

### 1) <nome-da-colecao-principal>

Caminho:
- `users/{userId}/<colecao>/{docId}`

Campos:
- `userId`: string
- `year`: number
- `month`: number
- `createdAt`: Timestamp
- `updatedAt`: Timestamp

Exemplo:

```json
{
  "userId": "u_123",
  "year": 2026,
  "month": 3,
  "createdAt": "SERVER_TIMESTAMP",
  "updatedAt": "SERVER_TIMESTAMP"
}
```

## Consultas principais

- Consulta 1: filtros e ordenacao.
- Consulta 2: filtros e ordenacao.

## Indices compostos sugeridos

- Indice 1:
  - campoA ASC
  - campoB DESC

## Regras de seguranca (base)

```txt
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

## Convencoes

- Usar `serverTimestamp()` em `createdAt` e `updatedAt`.
- Denormalizar campos de consulta frequente (ex.: `year`, `month`).
