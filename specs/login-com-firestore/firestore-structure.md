# Firestore Structure - Login e Cadastro

## Objetivo

Definir a estrutura minima para suportar:
- criacao de conta com email/senha
- login com email/senha
- login com Google
- logout com atualizacao de status do usuario

## Colecao raiz

- `users/{uid}`

Campos esperados em `users/{uid}`:
- `uid`: string
- `displayName`: string
- `email`: string
- `photoURL`: string
- `provider`: string (`password` ou `google.com`)
- `status`: string (`online` ou `offline`)
- `createdAt`: Timestamp
- `updatedAt`: Timestamp
- `lastLoginAt`: Timestamp
- `lastLogoutAt`: Timestamp (opcional no primeiro login)

## Subcolecao de configuracoes

Caminho:
- `users/{uid}/settings/profile`

Campos esperados:
- `userId`: string
- `currency`: string (padrao `BRL`)
- `locale`: string (padrao `pt-BR`)
- `updatedAt`: Timestamp

## Como a estrutura e criada

1. No cadastro/login, o app executa upsert em `users/{uid}`.
2. Se usuario nao existir, cria com `createdAt` e demais campos.
3. Se existir, atualiza dados principais e `lastLoginAt`.
4. Em paralelo, garante `users/{uid}/settings/profile` com valores default.
5. No logout, atualiza `status = offline` e `lastLogoutAt`.

## Operacoes de persistencia obrigatorias

- Escrita create: criar `users/{uid}` no primeiro login/cadastro com timestamps obrigatorios.
- Escrita update: atualizar dados de perfil e login (`updatedAt`, `lastLoginAt`) sem sobrescrever `createdAt`.
- Escrita delete: nao aplicavel para esta feature.
- Tratamento de falha: bloquear conclusao do fluxo com estado inconsistente e exibir feedback ao usuario.

## Regras de seguranca

Arquivo de regras:
- `firestore.rules`

Regra principal:
- usuario autenticado so acessa os documentos do proprio `uid`.

## Indices compostos

Arquivo de indices:
- `firestore.indexes.json`

Inclui indices para consultas futuras de:
- `costEntries`
- `budgetLimits`

## Deploy no projeto Firebase

Com Firebase CLI configurado no projeto:

```bash
firebase login
firebase use controle-de-custos-46093
firebase deploy --only firestore:rules,firestore:indexes
```
