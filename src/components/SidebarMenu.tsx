import Icon from '@mdi/react'
import {
  mdiCashMultiple,
  mdiChartBar,
  mdiHomeOutline,
  mdiAccountMultiple,
} from '@mdi/js'
import { Tooltip } from 'react-tooltip'
import { useUserRole } from '../hooks/useUserRole'
import 'react-tooltip/dist/react-tooltip.css'

const BUTTON_ICON_SIZE = 0.9

type SidebarMenuProps = {
  isCollapsed: boolean
  userId: string
  onUserProfilesClick?: () => void
}

interface MenuItem {
  key: string
  label: string
  shortLabel: string
  icon: string
  isDisabled: boolean
  path?: string
  visibleToRoles?: ('admin' | 'standard' | 'guest')[]
}

const allMenuItems: MenuItem[] = [
  {
    key: 'home',
    label: 'Inicio / Boas-vindas',
    shortLabel: 'Inicio',
    icon: mdiHomeOutline,
    isDisabled: false,
    path: '/dashboard',
  },
  {
    key: 'costs',
    label: 'Custos (em breve)',
    shortLabel: 'Custos',
    icon: mdiCashMultiple,
    isDisabled: true,
    path: '/costs',
  },
  {
    key: 'reports',
    label: 'Relatorios (em breve)',
    shortLabel: 'Relat.',
    icon: mdiChartBar,
    isDisabled: true,
    path: '/reports',
  },
  {
    key: 'userProfiles',
    label: 'Perfil de Usuarios',
    shortLabel: 'Usuarios',
    icon: mdiAccountMultiple,
    isDisabled: false,
    path: '/admin/users',
    visibleToRoles: ['admin'], // apenas admin vê este item
  },
]

function SidebarMenu({ isCollapsed, userId, onUserProfilesClick }: SidebarMenuProps) {
  const { role, isLoading } = useUserRole(userId)

  // filtrar itens baseado na role
  const visibleMenuItems = role
    ? allMenuItems.filter((item) => {
        // se visibleToRoles está definido, só mostrar se role está na lista
        if (item.visibleToRoles) {
          return item.visibleToRoles.includes(role)
        }
        // caso contrário, mostrar para todos exceto guest (que só pode visualizar)
        return true
      })
    : []

  // mostrar skeleton enquanto carrega role
  if (isLoading) {
    return (
      <aside
        className="sidebar-menu sidebar-surface collapsed"
        data-testid="sidebar-menu"
        aria-label="Menu lateral"
      >
        <nav className="p-3">
          <ul className="nav flex-column gap-2">
            {[...Array(4)].map((_, index) => (
              <li className="nav-item" key={`skeleton-${index}`}>
                <div className="placeholder-glow">
                  <span className="placeholder col-12" style={{ height: '40px' }}></span>
                </div>
              </li>
            ))}
          </ul>
        </nav>
      </aside>
    )
  }

  const handleMenuItemClick = (key: string) => {
    if (key === 'userProfiles' && onUserProfilesClick) {
      onUserProfilesClick()
    }
  }

  return (
    <>
      <aside
        className={`sidebar-menu sidebar-surface ${isCollapsed ? 'collapsed' : 'expanded'}`}
        data-testid="sidebar-menu"
        data-collapsed={isCollapsed ? 'true' : 'false'}
        aria-label="Menu lateral"
      >
        <nav className="p-3">
          <ul className="nav flex-column gap-2">
            {visibleMenuItems.map((item, index) => {
              const label = isCollapsed ? item.shortLabel : item.label
              const commonClassName = `nav-link sidebar-nav-link ${item.isDisabled ? 'disabled' : 'active'}`

              return (
                <li className="nav-item" key={item.key}>
                  <button
                    type="button"
                    className={commonClassName}
                    disabled={item.isDisabled}
                    aria-label={item.label}
                    aria-current={index === 0 ? 'page' : undefined}
                    data-tooltip-id={isCollapsed ? 'sidebar-menu-tooltip' : undefined}
                    data-tooltip-content={isCollapsed ? item.label : undefined}
                    onClick={() => handleMenuItemClick(item.key)}
                  >
                    <span className="btn-icon-label">
                      <Icon path={item.icon} size={BUTTON_ICON_SIZE} aria-hidden="true" />
                      {!isCollapsed && <span>{label}</span>}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </nav>
      </aside>

      {isCollapsed && <Tooltip id="sidebar-menu-tooltip" place="right" className="sidebar-tooltip" />}
    </>
  )
}

export default SidebarMenu
