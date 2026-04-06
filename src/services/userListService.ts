/**
 * Service para carregar e gerenciar perfis de usuários
 * Com verificações de permissão baseadas em role
 */

import {
  collection,
  getDocs,
  query,
  where,
  doc,
  getDoc,
} from 'firebase/firestore'
import { db } from '../firebase'
import { UserRole, UserProfile } from '../types/rolePermission'

/**
 * Carrega todos os usuários do sistema (apenas para admin)
 * REQUER: Firestore Rules permitir leitura de 'users' para admin
 */
export async function loadAllUsers(): Promise<UserProfile[]> {
  try {
    const usersRef = collection(db, 'users')
    const q = query(usersRef)
    const snapshot = await getDocs(q)

    const users: UserProfile[] = snapshot.docs.map((doc) => {
      const data = doc.data()
      return {
        userId: doc.id,
        email: data.email || '',
        displayName: data.displayName || '',
        role: (data.role || 'standard') as UserRole,
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(),
        updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : new Date(),
      }
    })

    return users
  } catch (error) {
    console.error('Erro ao carregar usuários:', error)
    throw error
  }
}

/**
 * Carrega um usuário específico pelo ID
 */
export async function loadUser(userId: string): Promise<UserProfile | null> {
  try {
    const userRef = doc(db, 'users', userId)
    const snapshot = await getDoc(userRef)

    if (!snapshot.exists()) {
      return null
    }

    const data = snapshot.data()
    return {
      userId: snapshot.id,
      email: data.email || '',
      displayName: data.displayName || '',
      role: (data.role || 'standard') as UserRole,
      createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(),
      updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : new Date(),
    }
  } catch (error) {
    console.error(`Erro ao carregar usuário ${userId}:`, error)
    throw error
  }
}

/**
 * Carrega usuários por role (para análise/filtros)
 */
export async function loadUsersByRole(role: UserRole): Promise<UserProfile[]> {
  try {
    const usersRef = collection(db, 'users')
    const q = query(usersRef, where('role', '==', role))
    const snapshot = await getDocs(q)

    return snapshot.docs.map((doc) => {
      const data = doc.data()
      return {
        userId: doc.id,
        email: data.email || '',
        displayName: data.displayName || '',
        role: (data.role || 'standard') as UserRole,
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(),
        updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : new Date(),
      }
    })
  } catch (error) {
    console.error(`Erro ao carregar usuários com role ${role}:`, error)
    throw error
  }
}
