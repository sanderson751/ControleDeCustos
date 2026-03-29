/**
 * Hook para verificar permissões de um usuário para recursos específicos
 * Utiliza a role carregada para determinar se ação é permitida
 */

import { useMemo } from 'react';
import { useUserRole } from './useUserRole';
import {
  createPermissionContext,
  isPermitted,
} from '../services/rolePermissionService';
import { PermissionAction, PermissionResource } from '../types/rolePermission';

interface UseCanAccessResult {
  can: (action: PermissionAction, resource: PermissionResource) => boolean;
  canView: (resource: PermissionResource) => boolean;
  canAdd: (resource: PermissionResource) => boolean;
  canEdit: (resource: PermissionResource) => boolean;
  canDelete: (resource: PermissionResource) => boolean;
  canManageRoles: () => boolean;
  isLoading: boolean;
}

export function useCanAccess(userId?: string): UseCanAccessResult {
  const { role, isLoading } = useUserRole(userId);

  const permissionContext = useMemo(() => {
    if (!role) {
      return null;
    }
    return createPermissionContext(role);
  }, [role]);

  const can = (action: PermissionAction, resource: PermissionResource) => {
    if (!role) return false;
    return isPermitted(role, resource, action);
  };

  return {
    can,
    canView: (resource: PermissionResource) => can('view', resource),
    canAdd: (resource: PermissionResource) => can('add', resource),
    canEdit: (resource: PermissionResource) => can('edit', resource),
    canDelete: (resource: PermissionResource) => can('delete', resource),
    canManageRoles: () => permissionContext?.canManageRoles() ?? false,
    isLoading,
  };
}
