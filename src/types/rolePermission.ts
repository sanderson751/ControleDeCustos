/**
 * Tipos para o sistema de controle de acesso baseado em roles
 */

/**
 * Níveis de acesso do sistema
 * - admin: acesso irrestrito a todas as funcionalidades e permissões
 * - standard: acesso a tudo exceto gestão de papéis de usuários
 * - guest: visualização apenas (read-only) em todas as telas
 */
export type UserRole = 'admin' | 'standard' | 'guest';

/**
 * Ações que podem ser realizadas em recursos
 */
export type PermissionAction = 'view' | 'add' | 'edit' | 'delete' | 'manage_roles';

/**
 * Recursos do sistema que podem ter controle de acesso
 */
export type PermissionResource =
  | 'costEntries'
  | 'budgetLimits'
  | 'userProfiles'
  | 'settings';

/**
 * Contexto de permissão para um usuário
 */
export interface PermissionContext {
  userRole: UserRole;
  canView(resource: PermissionResource): boolean;
  canAdd(resource: PermissionResource): boolean;
  canEdit(resource: PermissionResource): boolean;
  canDelete(resource: PermissionResource): boolean;
  canManageRoles(): boolean;
}

/**
 * Extensão do UserProfile com informações de controle de acesso
 */
export interface UserProfile {
  userId: string;
  email: string;
  displayName: string;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * MenuItem com informações de permissão
 */
export interface MenuItem {
  id: string;
  label: string;
  icon: string;
  path: string;
  requiredRole?: UserRole; // undefined = acessível a todos (exceto guest se for ação)
  visibleTo?: UserRole[]; // undefined = visível a todos com acesso leitura
}
