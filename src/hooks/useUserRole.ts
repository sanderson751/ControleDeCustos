/**
 * Hook para carregar e gerenciar a role do usuário autenticado
 * Implementa cache local para otimização e skeleton loading
 */

import { useEffect, useState } from 'react';

import { getUserRole } from '../services/rolePermissionService';
import { UserRole } from '../types/rolePermission';

interface UseUserRoleResult {
  role: UserRole | null;
  isLoading: boolean;
  error: Error | null;
}

export function useUserRole(userId?: string): UseUserRoleResult {
  const [role, setRole] = useState<UserRole | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (!userId) {
      setRole(null)
      setIsLoading(false)
      return
    }

    let isMounted = true

    const loadRole = async () => {
      try {
        setIsLoading(true)
        setError(null)

        const loadedRole = await getUserRole(userId)

        if (isMounted) {
          setRole(loadedRole)
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err : new Error(String(err)))
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    loadRole()

    return () => {
      isMounted = false
    }
  }, [userId])

  return { role, isLoading, error };
}
