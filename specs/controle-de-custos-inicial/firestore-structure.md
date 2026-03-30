# Firestore Structure - Controle de Custos

Este documento define a estrutura de dados que sera criada no Firestore posteriormente para suportar a feature inicial de controle de custos.

## Colecao raiz

- `users` (collection)
  - `{userId}` (document)
    - `displayName`: string
    - `email`: string
    - `currency`: string (ex.: "BRL")
    - `createdAt`: Timestamp
    - `updatedAt`: Timestamp

## Subcolecoes por usuario

### 1) Lancamentos de custos

Caminho:
- `users/{userId}/costEntries/{entryId}`

Campos:
- `userId`: string
- `date`: Timestamp
- `year`: number
- `month`: number (1-12)
- `amount`: number
- `category`: string
- `description`: string
- `createdAt`: Timestamp
- `updatedAt`: Timestamp

Exemplo de documento:

```json
{
  "userId": "u_123",
  "date": "2026-03-10T00:00:00.000Z",
  "year": 2026,
  "month": 3,
  "amount": 189.9,
  "category": "Alimentacao",
  "description": "Supermercado semanal",
  "createdAt": "SERVER_TIMESTAMP",
  "updatedAt": "SERVER_TIMESTAMP"
}
```

### 2) Limites de orcamento

Caminho:
- `users/{userId}/budgetLimits/{budgetId}`

Campos:
- `userId`: string
- `year`: number
- `month`: number
- `category`: string
- `limit`: number
- `createdAt`: Timestamp
- `updatedAt`: Timestamp

Exemplo de documento:

```json
{
  "userId": "u_123",
  "year": 2026,
  "month": 3,
  "category": "Alimentacao",
  "limit": 1200,
  "createdAt": "SERVER_TIMESTAMP",
  "updatedAt": "SERVER_TIMESTAMP"
}
```

## Categorias recomendadas

- Moradia
- Alimentacao
- Transporte
- Saude
- Educacao
- Lazer
- Outros

## Consultas principais esperadas

- Listar lancamentos por mes:
  - filtro: `year == 2026` e `month == 3`
  - ordenacao: `date desc`

- Consolidar por categoria no mes:
  - filtro: `year == X` e `month == Y`

- Buscar limite por categoria no mes:
  - filtro: `year == X` e `month == Y` e `category == "Alimentacao"`

## Indices compostos sugeridos

### costEntries

1. Campos:
- `year` (ASC)
- `month` (ASC)
- `date` (DESC)

2. Campos:
- `year` (ASC)
- `month` (ASC)
- `category` (ASC)
- `date` (DESC)

### budgetLimits

1. Campos:
- `year` (ASC)
- `month` (ASC)
- `category` (ASC)

## Regras de seguranca (referencia)

```txt
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;

      match /costEntries/{entryId} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }

      match /budgetLimits/{budgetId} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }
    }
  }
}
```

## Convencoes de implementacao

- Sempre preencher `year` e `month` para reduzir custo de consulta.
- Usar `serverTimestamp()` em `createdAt` e `updatedAt`.
- Em update, preservar `createdAt` e atualizar apenas `updatedAt`.
- Padronizar `category` com enum local para evitar variacoes de escrita.
