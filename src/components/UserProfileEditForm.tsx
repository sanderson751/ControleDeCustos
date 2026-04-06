/**
 * Formulário centralizado para editar perfil de usuário
 * Permite alterar displayName e role (somente para Admin)
 */

import React, { useState } from 'react'
import { UserProfile, UserRole } from '../types/rolePermission'
import { setUserRole } from '../services/rolePermissionService'
import { getRoleLabel, getRoleDescription } from '../services/rolePermissionService'
import './UserProfileEditForm.css'

interface UserProfileEditFormProps {
  user: UserProfile
  onSave: (updatedUser: UserProfile) => void
  onCancel: () => void
  isLoading?: boolean
}

export const UserProfileEditForm: React.FC<UserProfileEditFormProps> = ({
  user,
  onSave,
  onCancel,
  isLoading = false,
}) => {
  const [displayName, setDisplayName] = useState(user.displayName)
  const [role, setRole] = useState<UserRole>(user.role)
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // validações
    if (!displayName.trim()) {
      setError('Nome completo é obrigatório')
      return
    }

    try {
      setIsSaving(true)
      setError(null)

      // atualizar role se mudou
      if (role !== user.role) {
        await setUserRole(user.userId, role)
      }

      // chamar callback com usuário atualizado
      const updatedUser: UserProfile = {
        ...user,
        displayName: displayName.trim(),
        role,
        updatedAt: new Date(),
      }

      onSave(updatedUser)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar perfil')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="user-profile-edit-form-overlay">
      <div className="user-profile-edit-form-container">
        <h2>Editar Perfil de Usuário</h2>

        <form onSubmit={handleSubmit} className="user-profile-edit-form">
          {/* Email - apenas leitura */}
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={user.email}
              disabled
              className="form-control form-control-disabled"
            />
            <small className="text-muted">Email não pode ser alterado</small>
          </div>

          {/* Nome completo - editável */}
          <div className="form-group">
            <label htmlFor="displayName">Nome Completo *</label>
            <input
              id="displayName"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="form-control"
              placeholder="Digite o nome completo"
              disabled={isSaving || isLoading}
            />
          </div>

          {/* Nível de Acesso - radio buttons */}
          <fieldset className="form-group">
            <legend>Nível de Acesso</legend>
            <div className="role-options">
              {(['admin', 'standard', 'guest'] as const).map((roleOption) => (
                <div key={roleOption} className="role-option">
                  <label className="role-label">
                    <input
                      type="radio"
                      name="role"
                      value={roleOption}
                      checked={role === roleOption}
                      onChange={(e) => setRole(e.target.value as UserRole)}
                      disabled={isSaving || isLoading}
                    />
                    <span className="role-title">{getRoleLabel(roleOption)}</span>
                    <span className="role-description">
                      {getRoleDescription(roleOption)}
                    </span>
                  </label>
                </div>
              ))}
            </div>
          </fieldset>

          {/* Mensagem de erro */}
          {error && <div className="alert alert-danger" role="alert">{error}</div>}

          {/* Botões */}
          <div className="form-actions">
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isSaving || isLoading}
            >
              {isSaving ? 'Salvando...' : 'Salvar'}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onCancel}
              disabled={isSaving || isLoading}
            >
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
