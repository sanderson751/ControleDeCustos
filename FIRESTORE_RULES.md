# Firestore Security Rules - Controle de Acesso

## Problema: "Missing or insufficient permissions"

Este erro significa que as **Firestore Security Rules** estão bloqueando a leitura da coleção `users` mesmo para o usuário admin.

## Solução: Atualizar Firestore Rules

### Como Atualizar as Rules

1. Abra o [Firebase Console](https://console.firebase.google.com)
2. Navegue até seu projeto
3. Acesse **Firestore Database > Rules**
4. **Copie e cole as regras abaixo**
5. Clique em **Publish**

---

## Firestore Security Rules - Versão Completa

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // ========================================
    // Função auxiliar: verificar se é admin
    // ========================================
    function isAdmin(uid) {
      return get(/databases/$(database)/documents/users/$(uid)).data.role == 'admin';
    }
    
    function isAuthenticated() {
      return request.auth != null;
    }
    
    function isOwner(uid) {
      return request.auth.uid == uid;
    }
    
    // ========================================
    // Coleção: users
    // ========================================
    match /users/{userId} {
      // Próprio perfil: ler e escrever
      allow read: if isOwner(userId);
      allow write: if isOwner(userId) && 
                      !request.resource.data.keys().hasAny(['role']); // não pode mudar role
      
      // Admin: ler todos, escrever todos (incluindo role)
      allow read: if isAdmin(request.auth.uid);
      allow write: if isAdmin(request.auth.uid);
      
      // ========================================
      // Subcoleção: settings
      // ========================================
      match /settings/{docId} {
        allow read, write: if isOwner(userId);
      }
    }
    
    // ========================================
    // Coleção: costEntries (quando implementada)
    // ========================================
    match /users/{userId}/costEntries/{entryId} {
      allow read: if isOwner(userId);
      allow create: if isOwner(userId);
      allow update, delete: if isOwner(userId);
    }
    
    // ========================================
    // Coleção: budgetLimits (quando implementada)
    // ========================================
    match /users/{userId}/budgetLimits/{limitId} {
      allow read: if isOwner(userId);
      allow create: if isOwner(userId);
      allow update, delete: if isOwner(userId);
    }
    
    // Deny all by default
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

---

## Explicação das Regras

### 1. **Leitura do Próprio Perfil**
```javascript
allow read: if isOwner(userId);
```
- Cada usuário pode ler seu próprio perfil

### 2. **Admin Pode Ler Todos**
```javascript
allow read: if isAdmin(request.auth.uid);
```
- **Isso é a regra que estava faltando!**
- Admin consegue fazer `getDocs(collection(db, 'users'))` agora

### 3. **Escrever Próprio Perfil (Sem Mudar Role)**
```javascript
allow write: if isOwner(userId) && 
                !request.resource.data.keys().hasAny(['role']);
```
- Usuário pode editar displayName, email, etc.
- MAS não pode mudar sua própria role (segurança)

### 4. **Admin Escreve Tudo**
```javascript
allow write: if isAdmin(request.auth.uid);
```
- Admin consegue fazer `setDoc` ou `updateDoc` incluindo o campo `role`

---

## Regra Mais Simples (Se Preferir - Menos Segura)

Se quiser uma regra mais simples por enquanto:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      // Seu próprio documento
      allow read, write: if request.auth.uid == userId;
      
      // Admin temporário - permitir tudo
      // TODO: Remover depois que implementar rolePermissionService server-side
      allow read, write: if true; // INSEGURO - Usar apenas durante desenvolvimento
      
      match /settings/{docId} {
        allow read, write: if request.auth.uid == userId;
      }
    }
    
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

⚠️ **IMPORTANTE:** A regra "allow read, write: if true" é APENAS para desenvolvimento. Não use em produção!

---

## Checklist de Implementação

- [ ] Acessou Firebase Console
- [ ] Entrou em Firestore Database > Rules
- [ ] Copie uma das regras acima
- [ ] Clicou em "Publish"
- [ ] Aguardou a publicação (geralmente < 1 minuto)
- [ ] Recarregue a aplicação no navegador
- [ ] Tente novamente acessar "Perfil de Usuários"
- [ ] ✅ Erro deve desaparecer

---

## Testes Após Aplicar as Rules

### Teste 1: Admin consegue listar usuários
- Faça login como admin
- Clique em "Perfil de Usuários"
- ✅ Deve mostrar lista de usuários

### Teste 2: Não-admin não vê menu
- Crie novo usuário (role=standard)
- Faça login
- "Perfil de Usuários" não deve aparecer no menu

### Teste 3: Admin consegue editar perfil
- Como admin, edite um usuário
- Mude a role de um usuário padrão para guest
- ✅ Deve salvar sem erro

### Teste 4: Usuário não consegue mudar própria role
- Como non-admin, tente editar seu próprio perfil
- Role não deve ser editável para você mesmo
- Apenas displayName e email podem ser editados

---

## Troubleshooting

### "Missing or insufficient permissions" persiste

**Verificar:**
1. as rules foram publicadas? (ver "Last published" no console)
2. Aguarde 1-2 minutos e recarregue a aba do navegador
3. Confirme que `role: "admin"` existe no Firestore (não é suficiente estar no código)
4. Limpe cache do navegador (Ctrl+Shift+Delete)

### Admin consegue ler mas não consegue editar

**Causa:** Regra de write não está configurada corretamente
**Solução:** Verifique que `allow write: if isAdmin(...)` está presente

### Todos conseguem ler a coleção users

**Causa:** Está usando regra "insegura" `allow read, write: if true`
**Solução:** Substitua pela regra completa com checking de `isAdmin()`

### Função `isAdmin` retorna erro

**Causa:** Firestore não consegue ler o documento `users/{uid}`
**Solução:** Confirme que o campo `role` existe em todos os documentos de usuário

---

## Próximas Fases de Segurança

1. **Validação Server-Side** (Cloud Functions)
   - Implementar funções que validam role antes de permitir escrita

2. **Auditoria** (Logging)
   - Log de quem mudou que perfil e quando

3. **Multi-Tenant** (Se necessário)
   - Separar dados por organização/workspace

4. **Rate Limiting**
   - Limitar número de escritas por minuto

---

## Legenda

| Símbolo | Significado |
|---------|------------|
| ✅ | Deve funcionar |
| ❌ | Deve ser bloqueado |
| ⚠️ | Cuidado/Importante |
| TODO | Implementar depois |

