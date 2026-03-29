# Tasks - Controle de Acesso

## Fase 1 - Domínio

- [ ] Definir tipo `UserRole` com os três níveis: `admin`, `standard`, `guest`.
- [ ] Definir matriz de permissões (role x ação x recurso).
- [ ] Documentar estrutura Firestore com campo `role` em `users/{userId}`.
- [ ] Definir contrato de service `rolePermissionService` com funções de verificação.
- [ ] Criar tipos TypeScript para `PermissionContext`, `UserProfile` e `UserRolePermission`.

## Fase 2 - Aplicação: Backend de Controle de Acesso

- [x] Criar `rolePermissionService.ts` com funções centralizadas de verificação de permissão.
  - [x] `getUserRole(userId): Promise<UserRole>`
  - [x] `setUserRole(userId, role): Promise<void>`
  - [x] `isPermitted(role, resource, action): boolean`
  - [x] `getMenuItemsForRole(role): MenuItem[]`
- [x] Criar hook `useUserRole(userId)` para carregar e cachear a role.
- [ ] Criar hook `useCanAccess(resource, action)` para verificar permissão individual.
- [x] Atualizar fluxo de persistencia para manter campo `role` ao documento `users/{userId}` e atribuir `admin` ao primeiro usuario.

## Fase 3 - Aplicação: Interface de Gestão de Usuários (Admin only)

- [x] Criar página `UserProfileListPage.tsx`:
  - [ ] Tabela com colunas: Email, Nome, Role, Ações
  - [ ] Skeleton durante carregamento de usuários
  - [ ] Botão "Editar" para cada usuário
  - [x] Acessível somente para Admin
- [ ] Criar componente `UserProfileEditForm.tsx`:
  - [ ] Campo displayName (editável)
  - [ ] Campo email (apenas visualização)
  - [ ] Radio buttons ou select para mudar role (Admin, Standard, Guest)
  - [ ] Botões Salvar e Cancelar
  - [ ] Posicionado centralizado na tela
  - [ ] Validações básicas (displayName obrigatório)
- [ ] Integrar modal/drawer para abrir o formulário ao clicar em Editar
- [x] Implementar chamada server-side para atualizar role via API Next e `setUserRole()`

## Fase 4 - Aplicação: Menu com Controle de Acesso

- [x] Atualizar `SidebarMenu.tsx`:
  - [x] Receber role do usuário autenticado da sessão/layout protegido
  - [x] Filtrar itens de menu baseado em permissões (ocultar "Perfil de Usuários" para non-admin)
  - [x] Re-renderizar menu quando role muda
- [x] Adicionar item "Perfil de Usuários" ao menu:
  - [x] Visível somente para Admin
  - [x] Link/navegação para `/userProfiles`
  - [x] Ícone Material Design Icons apropriado (ex.: `mdiAccountMultiple`)

## Fase 5 - Aplicação: Controle de Acesso em Componentes Existentes

Durante implementação de `controle-de-custos-inicial` e outras features listagens/formulários:

- [ ] Wrappear componentes de listagem (CostEntryTable, etc.) com verificação de `canView()`
- [ ] Ocultar botões de edição quando `!canEdit()`
- [ ] Ocultar botões de adição quando `!canAdd()`
- [ ] Ocultar botões de remoção quando `!canDelete()`
- [ ] Aplicar padrão: `admin` pode tudo, `standard` pode tudo exceto gestão de papéis, `guest` somente visualização

## Fase 6 - Migração de Dados

- [ ] Verificar usuário existente no Firestore
- [ ] Adicionar/atualizar campo `role: "admin"` para usuário existente via Console Firestore ou script
- [ ] Garantir que novos usuários registrados depois recebam `role: "standard"` por padrão

## Fase 7 - Qualidade

- [ ] Teste unitário para `rolePermissionService` (matriz de permissões)
- [ ] Teste de hook `useUserRole` com mock de Firestore
- [ ] Teste de componente `UserProfileListPage` (renderização, carregamento, edição)
- [ ] Teste de componente `UserProfileEditForm` (validação, submissão)
- [ ] Teste de integração: Sidebar filtra menu itens por role
- [ ] Teste de acesso negado: Guest não vê botões de edit, Add, Delete
- [ ] Teste de permissão: Standard não vê "Perfil de Usuários"
- [ ] Validar acessibilidade (aria-labels, focus management no formulário modal)
- [ ] Validar legibilidade e contraste (AA) em tema `light` e `dark` para listagem e formulário de usuários
- [ ] Validar ausência de cores fixas em textos críticos de botões, badges e alertas
- [ ] Validar snackbar de erro/sucesso/warning no topo direito com auto-dismiss de 3s
- [ ] Validar fechamento manual do snackbar via ícone `X` e cor correta por status

## Fase 8 - Documentação e Deploy

- [ ] Atualizar `firestore-structure.md` com exemplo real de dados
- [ ] Documentar política de permissões em comentário no `rolePermissionService`
- [ ] Adicionar nota no README sobre níveis de acesso
- [x] Validar build sem erros
- [ ] Confirmar todos os 10+ testes passando

## Definição de pronto

- [ ] Critérios de aceite atendidos
- [ ] Campo `role` adicionado a documento `users/{userId}` do usuário existente
- [ ] Menu mostra/oculta itens baseado em role
- [ ] Admin consegue acessar "Perfil de Usuários" e editar roles
- [ ] Guest visualiza tudo mas botões de ação ficam ocultos
- [ ] Standard não vê "Perfil de Usuários" nem pode gerenciar roles
- [ ] Testes passando
- [ ] Sem erros de tipagem
- [ ] Formulário de edição centralizado e responsivo
- [ ] Persistencia de dados editaveis de usuario (role e displayName) validada no Firestore
- [ ] Falhas de persistencia validadas com feedback adequado ao usuario
