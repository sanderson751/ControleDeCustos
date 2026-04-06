/**
 * Página de gestão de perfis de usuários
 * Exibe lista de todos os usuários do sistema com suas roles
 * Acessível apenas para usuários com role 'admin'
 */

import React, { useState, useEffect } from 'react'
import { db } from '../firebase'
import { UserProfile, UserRole } from '../types/rolePermission'
import { getRoleLabel } from '../services/rolePermissionService'
import { loadAllUsers } from '../services/userListService'
import { UserProfileEditForm } from '../components/UserProfileEditForm'
import './UserProfileListPage.css'

interface UserProfileListPageProps {
  onClose?: () => void
}

export const UserProfileListPage: React.FC<UserProfileListPageProps> = ({ onClose }) => {
  const [users, setUsers] = useState<UserProfile[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null)
  const [isEditFormOpen, setIsEditFormOpen] = useState(false)

  useEffect(() => {
    loadUsers()
  }, [])

  const loadUsers = async () => {
    try {
      setIsLoading(true)
      setError(null)

      const loadedUsers = await loadAllUsers()
      setUsers(loadedUsers)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar usuários')
    } finally {
      setIsLoading(false)
    }
  }

  const handleEditClick = (user: UserProfile) => {
    setSelectedUser(user)
    setIsEditFormOpen(true)
  }

  const handleSaveUser = async (updatedUser: UserProfile) => {
    // atualizar lista local com usuário editado
    setUsers((prevUsers) =>
      prevUsers.map((u) => (u.userId === updatedUser.userId ? updatedUser : u))
    )

    setIsEditFormOpen(false)
    setSelectedUser(null)

    // pequena notificação de sucesso (poderia ser toast)
    console.log('Usuário atualizado com sucesso:', updatedUser.displayName)
  }

  const handleCancelEdit = () => {
    setIsEditFormOpen(false)
    setSelectedUser(null)
  }

  if (error && !users.length) {
    return (
      <div className="user-profile-list-page">
        <div className="page-header">
          <h1>Perfil de Usuários</h1>
          {onClose && (
            <button className="btn btn-secondary btn-sm" onClick={onClose}>
              Voltar
            </button>
          )}
        </div>
        <div className="alert alert-danger">Erro ao carregar usuários: {error}</div>
      </div>
    )
  }

  return (
    <div className="user-profile-list-page">
      <div className="page-header">
        <h1>Perfil de Usuários</h1>
        {onClose && (
          <button className="btn btn-secondary btn-sm" onClick={onClose}>
            Voltar
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="loading-container">
          <div className="spinner-border" role="status">
            <span className="visually-hidden">Carregando usuários...</span>
          </div>
        </div>
      ) : users.length === 0 ? (
        <div className="empty-state">
          <p>Nenhum usuário encontrado no sistema</p>
        </div>
      ) : (
        <div className="table-container">
          <table className="users-table">
            <thead>
              <tr>
                <th>Email</th>
                <th>Nome Completo</th>
                <th>Nível de Acesso</th>
                <th>Data de Criação</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.userId} className="user-row">
                  <td className="email">{user.email}</td>
                  <td className="display-name">{user.displayName}</td>
                  <td className="role">
                    <span className={`badge badge-role badge-${user.role}`}>
                      {getRoleLabel(user.role)}
                    </span>
                  </td>
                  <td className="created-at">
                    {user.createdAt.toLocaleDateString('pt-BR')}
                  </td>
                  <td className="actions">
                    <button
                      className="btn btn-sm btn-primary"
                      onClick={() => handleEditClick(user)}
                      title="Editar usuário"
                    >
                      Editar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {isEditFormOpen && selectedUser && (
        <UserProfileEditForm
          user={selectedUser}
          onSave={handleSaveUser}
          onCancel={handleCancelEdit}
          isLoading={isLoading}
        />
      )}
    </div>
  )
}
