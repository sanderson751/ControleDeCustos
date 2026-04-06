import Icon from '@mdi/react'
import { mdiLogoutVariant, mdiMenu, mdiWeatherNight, mdiWhiteBalanceSunny } from '@mdi/js'
import { Tooltip } from 'react-tooltip'
import 'react-tooltip/dist/react-tooltip.css'
import { ThemeMode } from '../services/uiPreferenceService'

const BUTTON_ICON_SIZE = 0.9

type GlobalAppBarProps = {
  isSidebarCollapsed: boolean
  themeMode: ThemeMode
  isLoggingOut: boolean
  onToggleSidebar: () => void
  onToggleTheme: () => void
  onLogout: () => void
}

function GlobalAppBar({
  isSidebarCollapsed,
  themeMode,
  isLoggingOut,
  onToggleSidebar,
  onToggleTheme,
  onLogout,
}: GlobalAppBarProps) {
  const menuTooltipText = isSidebarCollapsed ? 'Expandir menu lateral' : 'Retrair menu lateral'
  const themeTooltipText =
    themeMode === 'light' ? 'Ativar tema dark' : 'Ativar tema light'

  return (
    <>
      <header className="navbar sticky-top shadow-sm px-3 py-2 appbar-root appbar-surface">
        <div className="d-flex align-items-center gap-2">
          <button
            type="button"
            className="btn btn-sm appbar-icon-btn"
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
