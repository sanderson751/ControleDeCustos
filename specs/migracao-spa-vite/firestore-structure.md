# Firestore Structure - Migração para SPA

## Coleções (sem mudança de esquema)

```
users/{uid}
  uid, email, emailNormalized, displayName, photoURL, provider,
  role ("admin" | "standard" | "guest"), status, createdAt, updatedAt,
  lastLoginAt, lastLogoutAt

users/{uid}/settings/profile
  userId, currency ("BRL"), locale ("pt-BR"),
  ui { theme ("light" | "dark"), sidebarCollapsed (bool) }, updatedAt

users/{uid}/costEntries/{entryId}
  userId, accountName, amount, costType ("fixo" | "variavel"),
  installmentsTotal, competenceYear, competenceMonth, createdAt, updatedAt
```

Mudanças de comportamento:

- Padrão de `ui.theme` para novos usuários passa a ser `dark`.
- `settings/profile` é criado apenas no primeiro login (antes era sobrescrito com padrões a cada login, apagando a preferência de tema — bug corrigido).

## Operações de escrita (todas no client)

| Operação | Serviço | Escrita |
| --- | --- | --- |
| Primeiro login/cadastro | `userService.ensureUserProfile` | transação: `set users/{uid}` (role `standard`) + `set settings/profile` |
| Logins seguintes | `userService.ensureUserProfile` | transação: `update users/{uid}` sem `role`/`createdAt` |
| Logout | `userService.markUserLogout` | `update users/{uid}` (status offline) |
| Admin edita usuário | `userService.updateUserByAdmin` | `update users/{outro}`: `displayName`, `role`, `updatedAt` |
| Usuário edita o próprio nome | `userService.updateOwnDisplayName` | `update users/{uid}`: `displayName`, `updatedAt` |
| Preferências | `uiPreferenceService.updateUiPreferences` | `set settings/profile` com merge |
| Criar custo | `costService.createCostEntry` | `writeBatch` com 1 documento por parcela |
| Editar custo | `costService.updateCostEntry` | `update` (parcelas normalizadas) |
| Excluir custo | `costService.deleteCostEntry` | `delete` |

## Regras de segurança (`firestore.rules`)

- `users/{uid}`: `get` pelo dono ou admin; `list` só admin; `create` pelo dono com `role == "standard"`;
  `update` pelo dono sem alterar `role`/`createdAt`; `update` por admin em **outro** usuário restrito a
  `displayName`/`role`/`updatedAt` com papel válido; `delete` negado.
- `settings/{doc}`: leitura/escrita apenas pelo dono.
- `costEntries/{id}`: leitura pelo dono; escrita pelo dono com papel `admin|standard`, `userId` do dono e
  validação de tipos/limites (conta 1–200, valor > 0, frente válida, parcelas 1–120, mês 1–12).
- `budgetLimits/{id}`: leitura pelo dono; escrita pelo dono com papel `admin|standard`.
- Documentos legados sem `role` são tratados como `standard`.

Cobertura: `tests/rules/firestore.rules.test.ts` (`npm run test:rules`).

## Índices

Inalterados (`firestore.indexes.json`). Consultas usadas:

- Mês corrente: `competenceYear ==` + `competenceMonth ==` (sem índice composto; ordenação no client).
- Relatório: `createdAt >= / <=` + `orderBy(createdAt desc)` e, com frente, `costType ==` → índice `costType ASC, createdAt DESC`.

## Migração de dados

- Usuários email/senha: sem ação (uid já era do Firebase Auth).
- Usuários Google legados (uid = `sub` do Google): `npm run migrate:legacy-google-users` (simulação) e
  `-- --apply` para importar no Firebase Auth com o mesmo uid e provedor `google.com` vinculado.
- Primeiro admin: definir `role: "admin"` no documento `users/{uid}` pelo Console (já existe na base atual).
