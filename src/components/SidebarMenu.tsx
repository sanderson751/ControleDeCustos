'use client'

import Icon from '@mdi/react'
import {
  mdiCashMultiple,
  mdiChartBar,
  mdiHomeOutline,
  mdiAccountMultiple,
} from '@mdi/js'
import { Tooltip } from 'react-tooltip'
import { UserRole } from '../types/rolePermission'

const BUTTON_ICON_SIZE = 0.9

type SidebarMenuProps = {
  isCollapsed: boolean
  userId: string
  role: UserRole
  currentPath?: string | null
  onNavigate?: (path: string) => void
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
    path: '/home',
  },
  {
    key: 'costs',
    label: 'Custos',
    shortLabel: 'Custos',
    icon: mdiCashMultiple,
    isDisabled: false,
    path: '/costs',
  },
  {
    key: 'reports',
    label: 'Relatorios',
    shortLabel: 'Relat.',
    icon: mdiChartBar,
    isDisabled: false,
    path: '/reports',
  },
  {
    key: 'userProfiles',
    label: 'Perfil de Usuarios',
    shortLabel: 'Usuarios',
    icon: mdiAccountMultiple,
    isDisabled: false,
    path: '/userProfiles',
    visibleToRoles: ['admin'], // apenas admin vê este item
  },
]

function SidebarMenu({ isCollapsed, userId, role, currentPath, onNavigate }: SidebarMenuProps) {
  void userId

  const visibleMenuItems = allMenuItems.filter((item) => {
    if (item.visibleToRoles) {
      return item.visibleToRoles.includes(role)
    }

    return true
  })

  const handleMenuItemClick = (item: MenuItem) => {
    if (item.isDisabled || !item.path) {
      return
    }

    if (onNavigate) {
      onNavigate(item.path)
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
            {visibleMenuItems.map((item) => {
              const label = isCollapsed ? item.shortLabel : item.label
              const commonClassName = `nav-link sidebar-nav-link ${item.isDisabled ? 'disabled' : 'active'}`

              return (
                <li className="nav-item" key={item.key}>
                  <button
                    type="button"
                    className={commonClassName}
                    disabled={item.isDisabled}
                    aria-label={item.label}
                    aria-current={
                      item.path && currentPath?.startsWith(item.path) ? 'page' : undefined
                    }
                    data-tooltip-id={isCollapsed ? 'sidebar-menu-tooltip' : undefined}
                    data-tooltip-content={isCollapsed ? item.label : undefined}
                    onClick={() => handleMenuItemClick(item)}
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
