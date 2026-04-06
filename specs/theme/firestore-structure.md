# Firestore Structure - theme

## Colecao raiz

- `users/{userId}`
  - documento principal do perfil do usuario

## Subcolecoes

### 1) Preferencias de interface

Caminho:
- `users/{userId}/settings/profile`

Campos:
- `userId`: string
- `ui`: map
  - `theme`: string (`light` ou `dark`)
  - `sidebarCollapsed`: boolean (opcional, ja usado por outra feature)
- `updatedAt`: Timestamp

Exemplo:

```json
{
  "userId": "u_123",
  "ui": {
    "theme": "dark",
    "sidebarCollapsed": false
  },
  "updatedAt": "SERVER_TIMESTAMP"
}
```

## Consultas principais

- Consulta 1: obter preferencia de tema por caminho direto em `users/{userId}/settings/profile`.
- Consulta 2: atualizar apenas `ui.theme` no mesmo documento com `merge`.

## Indices compostos sugeridos

- Nao ha necessidade de indice composto nesta feature.
- Operacoes ocorrem por leitura/gravação direta de documento.

## Regras de seguranca (base)

```txt
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;

      match /settings/{docId} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }
    }
  }
}
```

## Convencoes

- Fallback para `light` quando `ui.theme` estiver ausente/invalido.
- Usar `serverTimestamp()` em `updatedAt`.
- Atualizar `ui.theme` com `setDoc(..., { merge: true })` para nao sobrescrever outras preferencias de `ui`.
