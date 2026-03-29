# Firestore Structure - Controle de Acesso

## Coleção raiz

- `users/{userId}` (documento existente)
  - Novo campo: `role` (UserRole enum string: "admin" | "standard" | "guest")

## Documentos impactados

### 1) users/{userId} - Extensão do documento de perfil

Caminho:
- `users/{userId}`

Campos adicionados:
- `role`: string (enum: "admin", "standard", "guest")
  - valor padrão para primeiro usuário: "admin"
  - valor padrão para novos usuários: "standard"

Campos existentes preservados:
- `displayName`: string
- `email`: string
- `currency`: string (ex.: "BRL")
- `settings`: map (subcolecção)
  - `profile`: document com `ui` (sidebar, theme) e outras preferências

Exemplo de documento atualizado:

```json
{
  "userId": "u_123",
  "displayName": "João Silva",
  "email": "joao@example.com",
  "currency": "BRL",
  "role": "admin",
  "createdAt": "2026-01-15T10:00:00.000Z",
  "updatedAt": "2026-04-05T14:30:00.000Z"
}
```

## Subcolecções (sem alterações estruturais)

As subcolecções existentes (`costEntries`, `budgetLimits`, etc.) não sofrem alterações estruturais diretas. 
O controle de acesso é aplicado em nível de aplicação através de verificações de $role antes de exibir/permitir operações.

### Referência de subcolecções existentes:

- `users/{userId}/settings/profile` (preferências de UI)
  - `sidebarCollapsed`: boolean
  - `theme`: string ("light" | "dark")
  - `updatedAt`: Timestamp

- `users/{userId}/costEntries/{entryId}` (será implementado)
  - Todos os usuários com permissão podem ler, `standard` e `admin` podem escrever

- `users/{userId}/budgetLimits/{limitId}` (será implementado)
  - Todos os usuários com permissão podem ler, `standard` e `admin` podem escrever

## Consultas principais

### Consulta 1: Carregar role do usuário autenticado
```
db.collection('users').doc(userId).get()
  .then(doc => doc.data().role)
```

### Consulta 2: Atualizar role de um usuário (Admin only)
```
db.collection('users').doc(targetUserId).update({
  role: 'admin' | 'standard' | 'guest',
  updatedAt: serverTimestamp()
})
```

### Consulta 3: Listar todos os usuários com suas roles (Admin only)
```
db.collection('users')
  .select('displayName', 'email', 'role', 'createdAt')
  .get()
  .then(snapshot => snapshot.docs.map(doc => doc.data()))
```

### Consulta 4: Contar usuários por role (Analytics, future)
```
db.collection('users')
  .where('role', '==', 'admin')
  .get()
  .then(snapshot => snapshot.size)
```

## Operacoes de persistencia obrigatorias

- Escrita create: novos usuarios devem ser criados com `role: "standard"` por padrao.
- Escrita update: alteracoes de perfil de acesso devem persistir no documento `users/{userId}` com `updatedAt`.
- Escrita delete: nao aplicavel para esta feature.
- Tratamento de falha: em erro de permissao/rede, manter UI consistente com ultimo estado persistido e exibir feedback ao usuario.

## Índices compostos sugeridos

Nenhum índice composto é necessário inicialmente, pois:
- Leitura de role é por documento individual (userId)
- Listagem de todos os usuários é uma única coleção sem filtros compostos
- Filtros por role são utilizados apenas para analytics (implementado posteriormente)

## Migração de dados existentes

Ao implementar a feature:
1. O usuário existente no banco (primeiro usuário criado) deve ter `role: "admin"` adicionado
2. Novos usuários criados após a feature terão `role: "standard"` por padrão
3. Query de atualização obrigatória antes de ativar feature completa:

```
Para cada documento em users/:
  UPDATE users/{userId} SET role = "admin" WHERE userId = "{existingUserId}"
```

## Regras de segurança Firestore (Futura implementação)

```
// Draft apenas para documentação futura
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Leitura próprio perfil: sempre permitido
    match /users/{userId} {
      allow read: if request.auth.uid == userId;
      allow update: if request.auth.uid == userId && 
                       !request.resource.data.role.changed();
    }
    
    // Gestão de roles: somente admin
    match /users/{targetUserId} {
      allow write: if isAdmin(request.auth.uid) && 
                      hasRole('admin');
    }
    
    // subcolecções: aplicar permissões por role
    match /users/{userId}/costEntries/{entryId} {
      allow read: if canView(request.auth.uid);
      allow write: if canEdit(request.auth.uid);
      allow delete: if canDelete(request.auth.uid);
    }
  }
  
  function isAdmin(uid) {
    return get(/databases/$(database)/documents/users/$(uid)).data.role == 'admin';
  }
}
```

Esta implementação será realizada em fase posterior (após validar frontend).

## Convencao

- Firestore e a fonte final da verdade para dados de perfil de acesso; estado local e cache de interface.
