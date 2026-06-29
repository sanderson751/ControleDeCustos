'use client'

import Icon from '@mdi/react'
import {
  mdiAccountCircleOutline,
  mdiLogoutVariant,
  mdiMenu,
  mdiWeatherNight,
  mdiWhiteBalanceSunny,
} from '@mdi/js'
import { Tooltip } from 'react-tooltip'
import { ThemeMode } from '../services/uiPreferenceService'
import { UserRole } from '../types/rolePermission'

const BUTTON_ICON_SIZE = 0.9

type GlobalAppBarProps = {
  user: {
    name?: string | null
    email?: string | null
    image?: string | null
    role: UserRole
  }
  isSidebarCollapsed: boolean
  themeMode: ThemeMode
  isLoggingOut: boolean
  onToggleSidebar: () => void
  onToggleTheme: () => void
  onLogout: () => Promise<void>
}

function GlobalAppBar({
  user,
  isSidebarCollapsed,
  themeMode,
  isLoggingOut,
  onToggleSidebar,
  onToggleTheme,
  onLogout,
}: GlobalAppBarProps) {
  const menuTooltipText = isSidebarCollapsed ? 'Expandir menu lateral' : 'Retrair menu lateral'
  const themeTooltipText = themeMode === 'light' ? 'Ativar tema dark' : 'Ativar tema light'
  const userName = user.name?.trim() || user.email || 'Usuario'
  const userInitial = userName.charAt(0).toUpperCase() || 'U'

  return (
    <>
      <header className="navbar sticky-top shadow-sm px-3 py-2 appbar-root appbar-surface">
        <div className="d-flex align-items-center gap-2">
          <button
            type="button"
            className="btn btn-sm appbar-icon-btn .appbar-toggle-btn"
            aria-label={menuTooltipText}
            onClick={onToggleSidebar}
            data-tooltip-id="appbar-tooltip"
            data-tooltip-content={menuTooltipText}
          >
            <Icon path={mdiMenu} size={BUTTON_ICON_SIZE} aria-hidden="true" />
          </button>
          <h1 className="h5 text-white mb-0">Controle de Custos</h1>
        </div>

        <div className="d-flex align-items-center gap-2">
          <div className="d-flex align-items-center gap-2 text-white">
            {user.image ? (
              <img
                src={user.image}
                alt={`Avatar de ${userName}`}
                width={36}
                height={36}
                className="rounded-circle border border-light"
              />
            ) : (
              <span
                className="rounded-circle border border-light d-inline-flex align-items-center justify-content-center fw-semibold"
                style={{ width: '36px', height: '36px' }}
                aria-label={`Inicial de ${userName}`}
              >
                {userInitial}
              </span>
            )}
            <div className="d-none d-md-flex flex-column lh-sm">
              <span className="fw-semibold">{userName}</span>
              <small className="text-white-50">{user.role}</small>
            </div>
          </div>

          <button
            type="button"
            className="btn btn-sm appbar-icon-btn"
            aria-label={themeTooltipText}
            onClick={onToggleTheme}
            data-testid="theme-toggle-button"
            data-tooltip-id="appbar-tooltip"
            data-tooltip-content={themeTooltipText}
          >
            <Icon
              path={themeMode === 'light' ? mdiWeatherNight : mdiWhiteBalanceSunny}
              size={BUTTON_ICON_SIZE}
              aria-hidden="true"
            />
          </button>

          <button
            type="button"
            className="btn btn-sm appbar-icon-btn"
            aria-label="Sair do sistema"
            onClick={onLogout}
            disabled={isLoggingOut}
            data-tooltip-id="appbar-tooltip"
            data-tooltip-content="Sair do sistema"
          >
            {isLoggingOut ? (
              <span className="small">...</span>
            ) : (
              <Icon path={mdiLogoutVariant} size={BUTTON_ICON_SIZE} aria-hidden="true" />
            )}
          </button>
        </div>
      </header>

      <Tooltip id="appbar-tooltip" place="bottom" className="appbar-tooltip" />
    </>
  )
}

export default GlobalAppBar
