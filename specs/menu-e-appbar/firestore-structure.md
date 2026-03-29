# Firestore Structure - menu-e-appbar

## Colecao raiz

- `users/{userId}`
  - perfil do usuario autenticado

## Subcolecoes

### 1) Preferencias de interface

Caminho:
- `users/{userId}/settings/profile`

Campos:
- `userId`: string
- `ui`: map
  - `sidebarCollapsed`: boolean
- `createdAt`: Timestamp (opcional quando criar documento)
- `updatedAt`: Timestamp

Exemplo:

```json
{
  "userId": "u_123",
  "ui": {
    "sidebarCollapsed": false
  },
  "createdAt": "SERVER_TIMESTAMP",
  "updatedAt": "SERVER_TIMESTAMP"
}
```

## Consultas principais

- Consulta 1: carregar preferencias de layout do usuario autenticado em `users/{userId}/settings/profile`.
- Consulta 2: atualizar somente `ui.sidebarCollapsed` ao alternar menu.
- Consulta 3: carregar campo `role` do documento `users/{userId}` para filtrar itens de menu (integrado com controle-de-acesso).

## Operacoes de persistencia obrigatorias

- Escrita create: garantir criacao de `users/{userId}/settings/profile` quando inexistente.
- Escrita update: persistir alteracao de `ui.sidebarCollapsed` com `updatedAt`.
- Escrita delete: nao aplicavel para esta feature.
- Tratamento de falha: em erro de permissao/rede, manter fallback de layout seguro e exibir feedback ao usuario.

## Indices compostos sugeridos

- Nao ha necessidade de indice composto para esta feature.
- Leitura por caminho direto de documento nao exige indice composto.

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

- Usar `serverTimestamp()` em `updatedAt`.
- Persistir `ui.sidebarCollapsed` apenas para usuario autenticado.
- Tratar ausencia de preferencias com fallback seguro (expandido no desktop, retraido no mobile).
- Firestore e a fonte final da preferencia de layout; estado local e cache de interface.
