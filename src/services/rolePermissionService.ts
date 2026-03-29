import { requestJson } from './httpClient'

/**
 * Service centralizado para controle de acesso baseado em roles
 * Implementa matriz de permissões e funções de verificação
 */
import {
  UserRole,
  PermissionAction,
  PermissionResource,
  PermissionContext,
  MenuItem,
} from '../types/rolePermission';

/**
 * Matriz de permissões: define quais ações cada role pode fazer em cada recurso
 * true = permitido, false = negado
 */
const permissionMatrix: Record<UserRole, Record<PermissionResource, Record<PermissionAction, boolean>>> = {
  admin: {
    costEntries: { view: true, add: true, edit: true, delete: true, manage_roles: false },
    budgetLimits: { view: true, add: true, edit: true, delete: true, manage_roles: false },
    userProfiles: { view: true, add: true, edit: true, delete: true, manage_roles: true },
    settings: { view: true, add: false, edit: true, delete: false, manage_roles: false },
  },
  standard: {
    costEntries: { view: true, add: true, edit: true, delete: true, manage_roles: false },
    budgetLimits: { view: true, add: true, edit: true, delete: true, manage_roles: false },
    userProfiles: { view: false, add: false, edit: false, delete: false, manage_roles: false },
    settings: { view: true, add: false, edit: true, delete: false, manage_roles: false },
  },
  guest: {
    costEntries: { view: true, add: false, edit: false, delete: false, manage_roles: false },
    budgetLimits: { view: true, add: false, edit: false, delete: false, manage_roles: false },
    userProfiles: { view: false, add: false, edit: false, delete: false, manage_roles: false },
    settings: { view: true, add: false, edit: false, delete: false, manage_roles: false },
  },
};

/**
 * Carrega a role de um usuário do Firestore
 */
export async function getUserRole(userId: string): Promise<UserRole> {
  try {
    const response = await requestJson<{ role: UserRole }>(`/api/users/${userId}/role`)
    return response.role
  } catch (error) {
    console.error('Erro ao carregar role do usuário:', error)
    return 'standard'
  }
}

/**
 * Atualiza a role de um usuário no Firestore (apenas admin pode fazer isso)
 */
export async function setUserRole(userId: string, newRole: UserRole): Promise<void> {
  try {
    await requestJson(`/api/users/${userId}`, {
      method: 'PATCH',
      body: JSON.stringify({ role: newRole }),
    })
  } catch (error) {
    console.error('Erro ao atualizar role do usuário:', error)
    throw error
  }
}

/**
 * Carrega múltiplas roles para cache local (otimização de performance)
 * Útil para páginas que listam múltiplos usuários
 */
export async function getUserRoles(userIds: string[]): Promise<Map<string, UserRole>> {
  const roleMap = new Map<string, UserRole>();

  try {
    const rolePromises = userIds.map((userId) => getUserRole(userId));
    const roles = await Promise.all(rolePromises);

    userIds.forEach((userId, index) => {
      roleMap.set(userId, roles[index]);
    });

    return roleMap;
  } catch (error) {
    console.error('Erro ao carregar múltiplas roles:', error);
    throw error;
  }
}

/**
 * Verifica se uma role pode executar uma ação em um recurso
 */
export function isPermitted(
  role: UserRole,
  resource: PermissionResource,
  action: PermissionAction
): boolean {
  return permissionMatrix[role]?.[resource]?.[action] ?? false;
}

/**
 * Retorna um contexto de permissões para uma role específica
 */
export function createPermissionContext(userRole: UserRole): PermissionContext {
  return {
    userRole,
    canView: (resource: PermissionResource) => isPermitted(userRole, resource, 'view'),
    canAdd: (resource: PermissionResource) => isPermitted(userRole, resource, 'add'),
    canEdit: (resource: PermissionResource) => isPermitted(userRole, resource, 'edit'),
    canDelete: (resource: PermissionResource) => isPermitted(userRole, resource, 'delete'),
    canManageRoles: () => isPermitted(userRole, 'userProfiles', 'manage_roles'),
  };
}

/**
 * Retorna lista de itens de menu filtrados pela role
 * Oculta itens inacessíveis baseado em permissões
 */
export function getMenuItemsForRole(role: UserRole): MenuItem[] {
  const allMenuItems: MenuItem[] = [
    {
      id: 'home',
      label: 'Início',
      icon: 'mdiHomeOutline',
      path: '/dashboard',
    },
    {
      id: 'costs',
      label: 'Custos',
      icon: 'mdiCashMultiple',
      path: '/costs',
    },
    {
      id: 'reports',
      label: 'Relatórios',
      icon: 'mdiChartBar',
      path: '/reports',
    },
    {
      id: 'userProfiles',
      label: 'Perfil de Usuários',
      icon: 'mdiAccountMultiple',
      path: '/admin/users',
      requiredRole: 'admin', // visível apenas para admin
      visibleTo: ['admin'], // redundante mas explícito
    },
  ];

  // filtrar itens baseado em permissões
  return allMenuItems.filter((item) => {
    // se requiredRole está definido, verificar se user tem essa role
    if (item.requiredRole) {
      return role === item.requiredRole;
    }

    // caso contrário, item é visível a todos (guest pode visualizar)
    return true;
  });
}

/**
 * Descrição legível da role para UI
 */
export function getRoleLabel(role: UserRole): string {
  const labels: Record<UserRole, string> = {
    admin: 'Admin',
    standard: 'Usuário Padrão',
    guest: 'Convidado',
  };

  return labels[role] || role;
}

/**
 * Descrição detalhada da role para tooltips/help
 */
export function getRoleDescription(role: UserRole): string {
  const descriptions: Record<UserRole, string> = {
    admin: 'Acesso total a todas as funcionalidades e configurações do sistema',
    standard:
      'Acesso a todas as funcionalidades exceto configurações de controle de papéis de usuários',
    guest: 'Acesso de visualização apenas (leitura) em todas as telas do sistema',
  };

  return descriptions[role] || '';
}
