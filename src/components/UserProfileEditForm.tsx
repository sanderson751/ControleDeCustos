'use client'

/**
 * Formulário centralizado para editar perfil de usuário
 * Permite alterar displayName e role (somente para Admin)
 */

import React, { useState } from 'react'
import { type UserProfile, type UserRole } from '../types/rolePermission'
import { getRoleLabel, getRoleDescription } from '../services/rolePermissionService'
import { updateUserProfile } from '../services/userListService'
import { type SnackbarStatus } from './Snackbar'

interface UserProfileEditFormProps {
  user: UserProfile
  onSave: (updatedUser: UserProfile) => void
  onCancel: () => void
  isLoading?: boolean
  onStatusChange?: (status: SnackbarStatus, message: string) => void
}

export const UserProfileEditForm: React.FC<UserProfileEditFormProps> = ({
  user,
  onSave,
  onCancel,
  isLoading = false,
  onStatusChange,
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

      const normalizedName = displayName.trim()

      await updateUserProfile(user.userId, {
        displayName: normalizedName,
        role,
      })

      // chamar callback com usuário atualizado
      const updatedUser: UserProfile = {
        ...user,
        displayName: normalizedName,
        role,
        updatedAt: new Date(),
      }

      onSave(updatedUser)
      onStatusChange?.('success', 'Usuário atualizado com sucesso.')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao salvar perfil'
      setError(message)
      onStatusChange?.('error', message)
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
