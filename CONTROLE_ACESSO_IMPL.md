# Guia de Finalização: Controle de Acesso

## Status da Implementação ✅

A feature **controle-de-acesso** foi migrada para Next.js + Auth.js e esta funcional no build de producao:

- ⚠️ Suite de testes ainda precisa ser adaptada ao App Router/Auth.js
- ✅ Build sem erros no Next.js
- ✅ TypeScript sem erros
- ✅ Componentes, layouts e rotas protegidas integrados
- ✅ Matriz de permissões configurada
- ✅ Validação server-side para rotas e APIs sensíveis

## Papel Admin Inicial

### Instrução 1: Via Firebase Console (Recomendado)

1. Abra o [Firebase Console](https://console.firebase.google.com)
2. Navegue até seu projeto
3. Acesse **Firestore Database**
4. Abra a coleção **users**
5. Locate o documento com seu uid (exemplo: `u_abc123xyz`)
6. **Edite o documento** e adicione (ou atualize):
   ```json
   {
     "role": "admin"
   }
   ```
7. Salve as alterações

### Observação Atual

Com a migração atual, o primeiro usuário persistido pela camada server-side recebe `role: admin` automaticamente. Se a base já estiver populada, a promoção manual continua sendo o caminho para usuários legados.

### Script Local (Para Desenvolvimento)

Se você tem Firebase Admin SDK configurado localmente:

```typescript
import * as admin from "firebase-admin";

const db = admin.firestore();
const userId = "seu-uid-aqui";

await db.collection("users").doc(userId).update({
  role: "admin",
  updatedAt: admin.firestore.FieldValue.serverTimestamp(),
});

console.log(`Usuário ${userId} migrado para admin`);
```

## Como Testar a Feature

### 1. Verificar rota `/userProfiles`

- Faça login
- Role Admin deve fazer o item "Perfil de Usuários" aparecer no menu lateral
- Clique para abrir a página de gestão de usuários

### 2. Verificar Permissões

#### Admin (após migração):

- ✅ Vê "Perfil de Usuários" no menu
- ✅ Consegue acessar página de gestão
- ✅ Consegue editar roles de outros usuários
- ✅ Vê todos os campos sem restrição

#### Standard (novo usuário):

- ❌ NÃO vê "Perfil de Usuários" no menu
- ✅ Consegue editar seus próprios dados (exceto role)
- ✅ Consegue acessar custos, relatórios (quando implementados)

#### Guest:

- ❌ Nenhum botão de ação visível
- ✅ Consegue visualizar conteúdo apenas

### 3. Verificar proteção de rota e API

- Acessos não autenticados devem redirecionar para `/login`
- Acesso não-admin a `/userProfiles` deve redirecionar para `/home`
- APIs `/api/users` e `/api/users/[userId]` devem recusar usuários sem role Admin

## Estrutura Criada

```
src/
├── types/
│   └── rolePermission.ts        # Tipos e interfaces
├── services/
│   └── rolePermissionService.ts # Matriz de permissões
├── hooks/
│   ├── useUserRole.ts           # Carrega role
│   └── useCanAccess.ts          # Verifica permissões
├── components/
│   │   ├── UserProfileEditForm.tsx # Formulário modal
│   │   ├── UserProfileEditForm.css
│   │   ├── SidebarMenu.tsx      # Filtrado por role
│   └── ...
├── app/
│   ├── (protected)/userProfiles/page.tsx
│   └── api/users/
└── views/
   └── UserProfileListPage.tsx  # Gestão de usuários (admin)
```

## Matriz de Permissões

| Role         | costEntries | budgetLimits | userProfiles   | settings |
| ------------ | ----------- | ------------ | -------------- | -------- |
| **admin**    | ✅ Full     | ✅ Full      | ✅ Full+manage | ✅ Edit  |
| **standard** | ✅ Full     | ✅ Full      | ❌ None        | ✅ Edit  |
| **guest**    | 👁️ View     | 👁️ View      | ❌ None        | 👁️ View  |

- ✅ Full = view + add + edit + delete
- 👁️ View = apenas leitura
- ❌ None = sem acesso
- \+ manage = pode gerenciar roles de outros usuários

## Próximos Passos (Roadmap)

1. **Integração em controle-de-custos** (já está preparado)
   - Botões de edit/delete/add ficam ocultos para Guest
   - Validações server-side (backend)

2. **Revisão de regras Firestore** (segurança)
   - As regras atuais continuam orientadas a `request.auth.uid`; validar se ainda serão usadas por clientes diretos ou se toda escrita ficará somente no backend

3. **Auditoria de Ações** (logging)
   - Registrar quem mudou role de quem e quando

4. **Multi-tenancy** (escala)
   - Suportar múltiplas organizações se necessário

## Suporte e Troubleshooting

### "Erro ao carregar role do usuário"

**Causa:** Sessão ausente, role inexistente ou falha na API protegida
**Solução:** Validar sessão Auth.js, documento `users/{uid}` e logs do servidor Next

### "Perfil de Usuários" não aparece no menu

**Causa:** Seu usuário não é admin
**Solução:** Execute a migração (instruções acima)

### Não conseguo editar role de outro usuário

**Causa:** Você não é admin
**Solução:** Peça para um admin aumentar sua role ou execute migração

## Resumo de Implementação

| Área                      | Status                                    |
| ------------------------- | ----------------------------------------- |
| **Especificações**        | ✅ Completo (4 arquivos SDD)              |
| **Tipos TypeScript**      | ✅ Completo                               |
| **Serviço de Permissões** | ✅ Completo                               |
| **Hooks**                 | ✅ Completo                               |
| **Componentes**           | ✅ Completo                               |
| **Integração Menu**       | ✅ Completo                               |
| **Testes Unitários**      | ⏳ Precisam migrar para o setup Next      |
| **Build**                 | ✅ Sem erros                              |
| **Migração Usuário**      | ⏳ Manual (instruções acima)              |
| **Segurança Backend**     | ✅ Aplicada nas rotas Next/API principais |

---

**Data de Implementação:** 5 de Abril de 2026  
**Duração:** ~2 horas de implementação  
**Commits:** 8+ (estrutura, tipos, serviços, hooks, componentes, testes, docs)
