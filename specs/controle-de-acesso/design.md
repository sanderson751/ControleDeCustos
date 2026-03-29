# Design - Controle de Acesso

## Visão de solução

A feature introduz um sistema de controle de acesso baseado em roles que permeia toda a aplicação. 
A estratégia implementa:
- Tipo `UserRole` com três valores imutáveis: `admin`, `standard`, `guest`
- Hook `useUserRole(userId)` para carregar e manter a role autenticada em cache
- Política de visibilidade de menu condicional à role
- Service layer `rolePermissionService` para centralizar lógica de controle de acesso
- Componente dedicado `UserProfileListPage` para gestão de usuários (admin only)
- Formulário `UserProfileEditForm` centralizado para edição de roles

Padrão visual transversal:
- Manter consistência com Material Design Icons Community
- Seguir padrão de skeleton loading durante carregamento de roles
- Aplicar disable/hide baseado em permissões em todos os componentes impactados
- Aplicar tokens semanticos de tema para tabela, badges, botões e alertas (sem cores fixas para texto critico)

## Modelo de domínio

```
UserRole
  - "admin"    (acesso irrestrito)
  - "standard" (acesso a tudo exceto gestão de papéis)
  - "guest"    (visualização apenas)

UserProfile
  - userId: string
  - email: string
  - displayName: string
  - role: UserRole
  - createdAt: Timestamp
  - updatedAt: Timestamp

PermissionContext
  - currentUserRole: UserRole
  - canViewMenu(menuItem): boolean
  - canView(resource): boolean
  - canEdit(resource): boolean
  - canAdd(resource): boolean
  - canDelete(resource): boolean
  - canManageRoles(): boolean
```

## Regras de negócio

- RB-01: `admin` tem `canView`, `canEdit`, `canAdd`, `canDelete` = true para tudo + `canManageRoles` = true
- RB-02: `standard` tem `canView`, `canEdit`, `canAdd`, `canDelete` = true para tudo EXCETO "perfil de usuários" + `canManageRoles` = false
- RB-03: `guest` tem apenas `canView` = true para tudo + `canEdit`, `canAdd`, `canDelete`, `canManageRoles` = false
- RB-04: Menu "Perfil de Usuários" visível somente quando `role === "admin"`
- RB-05: Todos os outros itens de menu visíveis para `standard` e `admin` (ocultos apenas para `guest` que só tem visualização)
- RB-06: Formulário de edição é modal centralizado com campos: displayName, email, role (select com 3 opções)
- RB-07: Menu deve ser re-renderizado quando role muda (e.g., após edição de perfil pelo Admin)

## Componentes propostos

### 1) UserProfileListPage
- Exibe tabela com todos os usuários
- Colunas: Email, Nome, Role, Ações (Editar)
- Skeleton durante carregamento
- Acessível apenas para Admin
- Dispara snackbar para feedback de sucesso/erro/warning

### 2) UserProfileEditForm
- Modal/Card centralizado na tela
- Campos: displayName (text), email (disabled para visualização), role (radio/select com 3 opções)
- Botões: Salvar, Cancelar
- Validações básicas (displayName não vazio)

### 3) SidebarMenu atualizado
- Condição de visibilidade: `canManageRoles()` para "Perfil de Usuários"
- Ocultar menu items não acessíveis à role atual

### 4) Todos os componentes com controle de acesso
- Exemplo: CostEntryForm, CostEntryTable
- Mostrar/ocultar botões de edição, adição, remoção baseado em `canEdit`, `canAdd`, `canDelete`

## Hooks propostos

- `useUserRole(userId)`: carrega a role do usuário com cache local
  - retorna `{ role, isLoading, error }`
- `useCanAccess(resource, action)`: verifica se usuário pode executar ação
  - retorna `{ canPerform: boolean }`

## Services propostos

- `rolePermissionService`: 
  - `getUserRole(userId)`: Promise<UserRole>
  - `setUserRole(userId, role)`: Promise<void>
  - `isPermitted(role, resource, action)`: boolean
  - `getMenuItemsForRole(role)`: MenuItem[]

## Structure visual do formulário de edição

```
┌─────────────────────────────────────┐
│  Editar Perfil de Usuário           │  (título centralizado)
├─────────────────────────────────────┤
│                                     │
│  Email: usuario@example.com         │  (disabled)
│                                     │
│  Nome Completo: [input text]        │
│                                     │
│  Nível de Acesso:                   │
│    ○ Admin                          │
│    ○ Usuário Padrão                │
│    ○ Convidado                      │
│                                     │
│  [Salvar]  [Cancelar]               │  (botões centralizados)
│                                     │
└─────────────────────────────────────┘
```

## Compatibilidade de tema e contraste

- `UserProfileListPage` e `UserProfileEditForm` devem respeitar tokens globais de tema (`light`/`dark`).
- Variaveis Bootstrap usadas pelos componentes devem ser mapeadas para tokens semanticos da aplicação.
- Garantir contraste minimo AA para textos de tabela, badges de role, botões de ação e alertas.
- Snackbar deve aparecer no canto superior direito, durar 3 segundos e permitir fechar por `X`.
- Snackbar deve usar cor semantica por status: vermelho, verde e amarelo.
